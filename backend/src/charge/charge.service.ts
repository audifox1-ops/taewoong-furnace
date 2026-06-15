import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GasReadingService } from '../gas-reading/gas-reading.service';
import { Shift, ChargeSource } from '@prisma/client';

@Injectable()
export class ChargeService {
  constructor(
    private prisma: PrismaService,
    private gasReadingService: GasReadingService,
  ) {}

  async findAll(furnaceId?: number, startDate?: string, endDate?: string, shift?: string) {
    const where: {
      furnaceId?: number;
      shift?: Shift;
      workDate?: { gte?: Date; lte?: Date };
    } = {};

    if (furnaceId) where.furnaceId = furnaceId;
    if (shift) where.shift = shift as Shift;
    if (startDate || endDate) {
      where.workDate = {};
      if (startDate) where.workDate.gte = this.parseDateFilter(startDate);
      if (endDate) where.workDate.lte = this.parseDateFilter(endDate, true);
    }

    return this.prisma.chargeEntry.findMany({
      where,
      include: { furnace: true, chargeRecord: true },
      orderBy: [{ workDate: 'desc' }, { chargeNo: 'desc' }],
    });
  }

  async findOne(id: number) {
    const charge = await this.prisma.chargeEntry.findUnique({
      where: { id },
      include: { furnace: true, chargeRecord: { include: { chargeScan: true } } },
    });
    if (!charge) throw new NotFoundException('Charge not found');
    return charge;
  }

  async create(data: {
    chargeNo: string;
    furnaceId: number;
    gasBefore?: number;
    gasAfter?: number;
    workDate: Date;
    shift: string;
    source?: string;
    chargeRecordId?: number;
    note?: string;
  }) {
    const usage = data.gasAfter != null && data.gasBefore != null
      ? data.gasAfter - data.gasBefore
      : null;

    const warnings: string[] = [];
    if (usage !== null && usage < 0) {
      warnings.push('음수 사용량: 적산계 리셋/롤오버 가능성');
    }

    const charge = await this.prisma.chargeEntry.create({
      data: {
        ...data,
        usage,
        shift: data.shift as Shift,
        source: (data.source as ChargeSource) || 'manual',
      },
      include: { furnace: true },
    });

    return { ...charge, warnings };
  }

  async update(id: number, data: {
    gasBefore?: number;
    gasAfter?: number;
    note?: string;
    chargeRecordId?: number;
  }) {
    const existing = await this.prisma.chargeEntry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Charge not found');

    const gasBefore = data.gasBefore ?? existing.gasBefore;
    const gasAfter = data.gasAfter ?? existing.gasAfter;
    const usage = gasAfter != null && gasBefore != null ? gasAfter - gasBefore : null;

    const warnings: string[] = [];
    if (usage !== null && usage < 0) {
      warnings.push('음수 사용량: 적산계 리셋/롤오버 가능성');
    }

    const charge = await this.prisma.chargeEntry.update({
      where: { id },
      data: { ...data, usage, source: 'manual' },
      include: { furnace: true },
    });

    return { ...charge, warnings };
  }

  async bulkUpdate(updates: { id: number; gasBefore?: number; gasAfter?: number; note?: string }[]) {
    return this.prisma.$transaction(
      updates.map((update) =>
        this.prisma.chargeEntry.update({
          where: { id: update.id },
          data: {
            ...(update.gasBefore !== undefined && { gasBefore: update.gasBefore }),
            ...(update.gasAfter !== undefined && { gasAfter: update.gasAfter }),
            ...(update.note !== undefined && { note: update.note }),
            usage: update.gasAfter != null && update.gasBefore != null
              ? update.gasAfter - update.gasBefore
              : undefined,
            source: 'manual',
          },
          include: { furnace: true },
        })
      )
    );
  }

  async pasteData(rows: {
    chargeNo: string;
    furnaceNo: number;
    gasBefore?: number;
    gasAfter?: number;
    note?: string;
  }[]) {
    const results = [];

    for (const row of rows) {
      const furnace = await this.prisma.furnace.findUnique({ where: { no: row.furnaceNo } });
      if (!furnace) {
        results.push({ ...row, error: `Furnace ${row.furnaceNo} not found` });
        continue;
      }

      const workDate = this.extractDateFromChargeNo(row.chargeNo);
      const shift = this.determineShift(workDate);

      try {
        const charge = await this.create({
          chargeNo: row.chargeNo,
          furnaceId: furnace.id,
          gasBefore: row.gasBefore,
          gasAfter: row.gasAfter,
          workDate,
          shift,
          source: 'paste',
          note: row.note,
        });
        results.push(charge);
      } catch (error: any) {
        results.push({ ...row, error: error.message });
      }
    }

    return results;
  }

  async autoFillUsage(furnaceId: number, workDate: Date, shift: string, workEnd?: Date) {
    const shiftConfig = this.getShiftConfig(shift);

    const periodEnd = workEnd || (() => {
      const d = new Date(workDate);
      if (shiftConfig.crossesMidnight) d.setDate(d.getDate() + 1);
      d.setHours(shiftConfig.endHour, shiftConfig.endMinute, 0, 0);
      return d;
    })();

    const periodStart = await this.findStartPoint(furnaceId, workDate, shift, shiftConfig);

    const gasBeforeReading = await this.gasReadingService.findClosestReading(furnaceId, periodStart);
    const gasAfterReading = await this.gasReadingService.findClosestReading(furnaceId, periodEnd);

    if (!gasBeforeReading || !gasAfterReading) {
      return null;
    }

    const gasBefore = gasBeforeReading.gasCumulative;
    const gasAfter = gasAfterReading.gasCumulative;
    const usage = gasAfter - gasBefore;

    const warnings: string[] = [];
    if (usage < 0) {
      warnings.push('음수 사용량: 적산계 리셋/롤오버 가능성');
    }
    if (!gasBeforeReading || !gasAfterReading) {
      warnings.push('해당 구간의 가스 시계열 데이터를 찾을 수 없음');
    }

    return {
      gasBefore,
      gasAfter,
      usage,
      periodStart,
      periodEnd,
      warnings,
    };
  }

  private async findStartPoint(
    furnaceId: number,
    workDate: Date,
    shift: string,
    shiftConfig: {
      startHour: number;
      startMinute: number;
      endHour: number;
      endMinute: number;
      crossesMidnight: boolean;
    },
  ): Promise<Date> {
    const shiftStart = new Date(workDate);
    shiftStart.setHours(shiftConfig.startHour, shiftConfig.startMinute, 0, 0);

    const prevCharge = await this.prisma.chargeEntry.findFirst({
      where: {
        furnaceId,
        shift: shift as Shift,
        workDate: { lt: workDate },
      },
      orderBy: [{ workDate: 'desc' }, { chargeNo: 'desc' }],
    });

    if (prevCharge && prevCharge.gasAfter != null) {
      const prevEnd = new Date(prevCharge.workDate);
      if (shiftConfig.crossesMidnight) {
        prevEnd.setDate(prevEnd.getDate() + 1);
      }
      prevEnd.setHours(shiftConfig.endHour, shiftConfig.endMinute, 0, 0);

      const tolerance = 2 * 60 * 60 * 1000 // 2 hours
      if (Math.abs(prevEnd.getTime() - shiftStart.getTime()) <= tolerance) {
        return prevEnd;
      }
    }

    return shiftStart;
  }

  async delete(id: number) {
    const charge = await this.prisma.chargeEntry.findUnique({ where: { id } });
    if (!charge) throw new NotFoundException('Charge not found');

    await this.prisma.chargeEntry.delete({ where: { id } });
    return { deleted: true };
  }

  async linkChargeRecord(chargeId: number, chargeRecordId: number) {
    const charge = await this.prisma.chargeEntry.findUnique({ where: { id: chargeId } });
    if (!charge) throw new NotFoundException('Charge not found');

    const record = await this.prisma.chargeRecord.findUnique({ where: { id: chargeRecordId } });
    if (!record) throw new NotFoundException('Charge record not found');

    const updated = await this.prisma.chargeEntry.update({
      where: { id: chargeId },
      data: { chargeRecordId },
      include: { furnace: true, chargeRecord: true },
    });

    if (record.workEnd && charge.furnaceId === record.furnaceId) {
      const autoFill = await this.autoFillUsage(
        record.furnaceId,
        record.workDate,
        record.shift,
        record.workEnd,
      );

      if (autoFill) {
        await this.update(chargeId, {
          gasBefore: autoFill.gasBefore,
          gasAfter: autoFill.gasAfter,
        });
      }
    }

    return updated;
  }

  async getUsageSummary(furnaceId?: number, startDate?: string, endDate?: string) {
    const where: {
      furnaceId?: number;
      workDate?: { gte?: Date; lte?: Date };
    } = {};
    if (furnaceId) where.furnaceId = furnaceId;
    if (startDate || endDate) {
      where.workDate = {};
      if (startDate) where.workDate.gte = this.parseDateFilter(startDate);
      if (endDate) where.workDate.lte = this.parseDateFilter(endDate, true);
    }

    const charges = await this.prisma.chargeEntry.findMany({
      where,
      include: { furnace: true },
    });

    const summary = charges.reduce((acc, charge) => {
      const key = `${charge.furnaceId}-${charge.shift}`;
      if (!acc[key]) {
        acc[key] = {
          furnaceId: charge.furnaceId,
          furnaceName: charge.furnace.name,
          shift: charge.shift,
          totalUsage: 0,
          chargeCount: 0,
        };
      }
      if (charge.usage != null) {
        acc[key].totalUsage += charge.usage;
      }
      acc[key].chargeCount++;
      return acc;
    }, {} as Record<string, {
      furnaceId: number;
      furnaceName: string;
      shift: string;
      totalUsage: number;
      chargeCount: number;
    }>);

    return Object.values(summary);
  }

  private extractDateFromChargeNo(chargeNo: string): Date {
    const match = chargeNo.match(/^(\d{6})-\d{3}$/);
    if (!match) {
      throw new BadRequestException('Invalid date in charge number');
    }

    const dateStr = match[1];

    const year = parseInt('20' + dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4)) - 1;
    const day = parseInt(dateStr.substring(4, 6));

    return new Date(year, month, day);
  }

  private parseDateFilter(value: string, endOfDay = false): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date: ${value}`);
    }

    const isDateOnly = !value.includes('T');
    if (isDateOnly) {
      if (endOfDay) {
        parsed.setHours(23, 59, 59, 999);
      } else {
        parsed.setHours(0, 0, 0, 0);
      }
    }

    return parsed;
  }

  private determineShift(workDate: Date): string {
    const hour = workDate.getHours();
    if (hour >= 8 && hour < 19) return 'day';
    return 'night';
  }

  private getShiftConfig(shift: string) {
    const configs: Record<string, {
      startHour: number;
      startMinute: number;
      endHour: number;
      endMinute: number;
      crossesMidnight: boolean;
    }> = {
      day: { startHour: 8, startMinute: 0, endHour: 19, endMinute: 30, crossesMidnight: false },
      night: { startHour: 20, startMinute: 0, endHour: 7, endMinute: 0, crossesMidnight: true },
    };
    return configs[shift] || configs.day;
  }

  async rematchChargeRecord(chargeRecordId: number) {
    const record = await this.prisma.chargeRecord.findUnique({
      where: { id: chargeRecordId },
      include: { chargeScan: true },
    });
    if (!record) throw new NotFoundException('Charge record not found');

    const existingCharge = await this.prisma.chargeEntry.findFirst({
      where: { chargeRecordId: record.id },
    });

    const autoFill = await this.autoFillUsage(
      record.furnaceId,
      record.workDate,
      record.shift,
      record.workEnd,
    );

    if (existingCharge) {
      if (autoFill) {
        return this.update(existingCharge.id, {
          gasBefore: autoFill.gasBefore,
          gasAfter: autoFill.gasAfter,
        });
      }
      return existingCharge;
    }

    const chargeNo = await this.generateChargeNo(record.workDate, record.furnaceId);
    return this.create({
      chargeNo,
      furnaceId: record.furnaceId,
      gasBefore: autoFill?.gasBefore,
      gasAfter: autoFill?.gasAfter,
      workDate: record.workDate,
      shift: record.shift,
      source: 'auto',
      chargeRecordId: record.id,
      note: record.note || undefined,
    });
  }

  async rematchAllChargeRecords() {
    const records = await this.prisma.chargeRecord.findMany({
      orderBy: [{ workDate: 'asc' }, { pageIndex: 'asc' }],
    });

    const batchSize = 50;
    const results: { recordId: number; chargeId?: number; status: string; error?: string }[] = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((record) => this.rematchChargeRecord(record.id))
      );
      
      batchResults.forEach((result, index) => {
        const record = batch[index];
        if (result.status === 'fulfilled') {
          results.push({ recordId: record.id, chargeId: result.value.id, status: 'matched' });
        } else {
          results.push({ recordId: record.id, status: 'failed', error: result.reason?.message || 'Unknown error' });
        }
      });
    }
    
    return results;
  }

  async getUnmatchedRecords() {
    const records = await this.prisma.chargeRecord.findMany({
      where: { chargeEntries: { none: {} } },
      include: { chargeScan: true, furnace: true },
      orderBy: [{ workDate: 'desc' }, { pageIndex: 'asc' }],
    });
    return records;
  }

  async updateChargeRecord(id: number, data: {
    furnaceId?: number;
    workDate?: Date;
    shift?: string;
    workEnd?: Date;
    material?: string;
    weightKg?: number;
    note?: string;
  }) {
    const record = await this.prisma.chargeRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Charge record not found');

    const updated = await this.prisma.chargeRecord.update({
      where: { id },
      data: {
        ...data,
        shift: data.shift ? (data.shift as Shift) : undefined,
      },
      include: { chargeScan: true, furnace: true },
    });

    await this.rematchChargeRecord(id);
    return updated;
  }

  private async generateChargeNo(workDate: Date, furnaceId: number): Promise<string> {
    const yy = String(workDate.getFullYear()).slice(-2);
    const mm = String(workDate.getMonth() + 1).padStart(2, '0');
    const dd = String(workDate.getDate()).padStart(2, '0');
    const datePrefix = `${yy}${mm}${dd}`;

    const lastEntry = await this.prisma.chargeEntry.findFirst({
      where: { chargeNo: { startsWith: datePrefix } },
      orderBy: { chargeNo: 'desc' },
    });

    let seq = 1;
    if (lastEntry) {
      const lastSeq = parseInt(lastEntry.chargeNo.split('-')[1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${datePrefix}-${String(seq).padStart(3, '0')}`;
  }
}
