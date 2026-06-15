import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GasReadingService } from '../gas-reading/gas-reading.service';

@Injectable()
export class AnalysisService {
  constructor(
    private prisma: PrismaService,
    private gasReadingService: GasReadingService,
  ) {}

  async getDashboardStats() {
    const [furnaceCount, gasReadingCount, chargeCount, scanCount] = await Promise.all([
      this.prisma.furnace.count(),
      this.prisma.gasReading.count(),
      this.prisma.chargeEntry.count(),
      this.prisma.chargeScan.count(),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCharges = await this.prisma.chargeEntry.count({
      where: { workDate: { gte: today, lt: tomorrow } },
    });

    const totalUsage = await this.prisma.chargeEntry.aggregate({
      where: { usage: { not: null } },
      _sum: { usage: true },
    });

    return {
      furnaceCount,
      gasReadingCount,
      chargeCount,
      scanCount,
      todayCharges,
      totalUsage: totalUsage._sum.usage || 0,
    };
  }

  async getUsageTrend(furnaceId: number, startDate: Date, endDate: Date) {
    this.assertReasonableRange(startDate, endDate);
    const readings = await this.gasReadingService.findByFurnaceAndTimeRange(furnaceId, startDate, endDate);
    
    const dailyData: Record<string, { min: number; max: number; readings: number }> = {};
    
    for (const reading of readings) {
      const dateKey = reading.ts.toISOString().split('T')[0];
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { min: Infinity, max: -Infinity, readings: 0 };
      }
      dailyData[dateKey].min = Math.min(dailyData[dateKey].min, reading.gasCumulative);
      dailyData[dateKey].max = Math.max(dailyData[dateKey].max, reading.gasCumulative);
      dailyData[dateKey].readings++;
    }

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      min: data.min === Infinity ? 0 : data.min,
      max: data.max === -Infinity ? 0 : data.max,
      usage: data.max - data.min,
      readings: data.readings,
    }));
  }

  async getTemperatureTrend(furnaceId: number, startDate: Date, endDate: Date) {
    this.assertReasonableRange(startDate, endDate);
    const readings = await this.gasReadingService.findByFurnaceAndTimeRange(furnaceId, startDate, endDate);
    
    const hourlyData: Record<string, { temps: number[] }> = {};
    
    for (const reading of readings) {
      const hourKey = reading.ts.toISOString().slice(0, 13) + ':00:00';
      if (!hourlyData[hourKey]) {
        hourlyData[hourKey] = { temps: [] };
      }
      if (reading.temp) {
        hourlyData[hourKey].temps.push(reading.temp);
      }
    }

    return Object.entries(hourlyData).map(([hour, data]) => ({
      hour,
      avgTemp: data.temps.length > 0 ? data.temps.reduce((a, b) => a + b, 0) / data.temps.length : 0,
      minTemp: data.temps.length > 0 ? Math.min(...data.temps) : 0,
      maxTemp: data.temps.length > 0 ? Math.max(...data.temps) : 0,
    }));
  }

  async getUsageByShift(furnaceId?: number, startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (furnaceId) where.furnaceId = furnaceId;
    if (startDate || endDate) {
      where.workDate = {};
      if (startDate) where.workDate.gte = startDate;
      if (endDate) where.workDate.lte = endDate;
    }

    const charges = await this.prisma.chargeEntry.findMany({
      where,
      include: { furnace: true },
    });

    const byShift: Record<string, { usage: number; count: number; furnaces: Record<number, number> }> = {};
    
    for (const charge of charges) {
      const key = charge.shift;
      if (!byShift[key]) {
        byShift[key] = { usage: 0, count: 0, furnaces: {} };
      }
      if (charge.usage) {
        byShift[key].usage += charge.usage;
        byShift[key].furnaces[charge.furnaceId] = (byShift[key].furnaces[charge.furnaceId] || 0) + charge.usage;
      }
      byShift[key].count++;
    }

    return byShift;
  }

  async getUsageByFurnace(startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (startDate || endDate) {
      where.workDate = {};
      if (startDate) where.workDate.gte = startDate;
      if (endDate) where.workDate.lte = endDate;
    }

    const charges = await this.prisma.chargeEntry.findMany({
      where,
      include: { furnace: true },
    });

    const byFurnace: Record<number, { name: string; usage: number; count: number }> = {};
    
    for (const charge of charges) {
      const id = charge.furnaceId;
      if (!byFurnace[id]) {
        byFurnace[id] = { name: charge.furnace.name, usage: 0, count: 0 };
      }
      if (charge.usage) {
        byFurnace[id].usage += charge.usage;
      }
      byFurnace[id].count++;
    }

    return Object.entries(byFurnace).map(([id, data]) => ({
      furnaceId: parseInt(id),
      ...data,
    }));
  }

  async getUnitRate(furnaceId: number, startDate: Date, endDate: Date) {
    const charges = await this.prisma.chargeEntry.findMany({
      where: {
        furnaceId,
        workDate: { gte: startDate, lte: endDate },
        usage: { not: null },
      },
      include: { chargeRecord: true },
    });

    return charges
      .filter(c => c.chargeRecord?.weightKg != null && c.usage != null)
      .map(c => ({
        chargeNo: c.chargeNo,
        workDate: c.workDate,
        shift: c.shift,
        usage: c.usage!,
        weightKg: c.chargeRecord!.weightKg!,
        unitRate: c.usage! / c.chargeRecord!.weightKg!,
      }));
  }

  private assertReasonableRange(startDate: Date, endDate: Date) {
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      throw new BadRequestException('조회 기간이 올바르지 않습니다');
    }
    const maxDays = 93;
    const rangeDays = (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);
    if (rangeDays > maxDays) {
      throw new BadRequestException(`시계열 분석 조회 기간은 최대 ${maxDays}일입니다`);
    }
  }
}
