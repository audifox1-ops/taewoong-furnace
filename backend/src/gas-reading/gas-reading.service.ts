import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

export interface FileParseResult {
  fileName: string;
  furnaceNo: number | null;
  furnaceName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  headers: string[];
  rowCount: number;
}

export interface UploadResult {
  fileName: string;
  batchId: number;
  furnaceNo: number;
  furnaceName: string;
  totalRows: number;
  successCount: number;
  duplicateCount: number;
  errorCount: number;
  status: 'completed' | 'error';
  error?: string;
}

@Injectable()
export class GasReadingService {
  constructor(private prisma: PrismaService) {}

  parseFileName(fileName: string): FileParseResult {
    const base = fileName.replace(/\.(xlsx|xls|csv)$/i, '');
    let furnaceNo: number | null = null;
    let furnaceName: string | null = null;
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    const furnaceMatch = base.match(/가열로?\s*(\d+)\s*호기?/i);
    if (furnaceMatch) {
      furnaceNo = parseInt(furnaceMatch[1]);
      furnaceName = `가열${furnaceNo}호`;
    }

    const dateRangeMatch = base.match(/\((\d{4}-\d{2}-\d{2})\s*[~\-]\s*(\d{4}-\d{2}-\d{2})\)/);
    if (dateRangeMatch) {
      periodStart = dateRangeMatch[1];
      periodEnd = dateRangeMatch[2];
    }

    return { fileName, furnaceNo, furnaceName, periodStart, periodEnd, headers: [], rowCount: 0 };
  }

  async findAll(furnaceId?: number, startDate?: string, endDate?: string, page = 1, limit = 100) {
    const where: any = {};
    if (furnaceId) where.furnaceId = furnaceId;
    if (startDate || endDate) {
      where.ts = {};
      if (startDate) where.ts.gte = new Date(startDate);
      if (endDate) where.ts.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.gasReading.findMany({
        where,
        orderBy: { ts: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { furnace: true },
      }),
      this.prisma.gasReading.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByFurnaceAndTimeRange(furnaceId: number, start: Date, end: Date) {
    return this.prisma.gasReading.findMany({
      where: { furnaceId, ts: { gte: start, lte: end } },
      orderBy: { ts: 'asc' },
    });
  }

  async findClosestReading(furnaceId: number, targetTime: Date) {
    const reading = await this.prisma.gasReading.findFirst({
      where: { furnaceId, ts: targetTime },
    });
    if (reading) return reading;

    const twoMinutes = 2 * 60 * 1000;
    const before = await this.prisma.gasReading.findFirst({
      where: { furnaceId, ts: { gte: new Date(targetTime.getTime() - twoMinutes) } },
      orderBy: { ts: 'desc' },
    });
    const after = await this.prisma.gasReading.findFirst({
      where: { furnaceId, ts: { lte: new Date(targetTime.getTime() + twoMinutes) } },
      orderBy: { ts: 'asc' },
    });

    if (!before && !after) return null;
    if (!before) return after;
    if (!after) return before;
    return Math.abs(before.ts.getTime() - targetTime.getTime()) <= Math.abs(after.ts.getTime() - targetTime.getTime()) ? before : after;
  }

  async uploadSingleFile(
    file: Express.Multer.File,
    furnaceId?: number,
    duplicateMode: 'skip' | 'upsert' = 'skip',
  ): Promise<UploadResult> {
    const result: UploadResult = {
      fileName: file.originalname,
      batchId: 0,
      furnaceNo: 0,
      furnaceName: '',
      totalRows: 0,
      successCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      status: 'error',
    };

    try {
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
        result.error = 'Excel/CSV 파일만 지원됩니다';
        return result;
      }

      const parsed = this.parseFileName(file.originalname);
      const effectiveFurnaceId = furnaceId || (parsed.furnaceNo
        ? (await this.prisma.furnace.findUnique({ where: { no: parsed.furnaceNo } }))?.id || 1
        : 1);
      const furnace = await this.prisma.furnace.findUnique({ where: { id: effectiveFurnaceId } });
      result.furnaceNo = furnace?.no || 0;
      result.furnaceName = furnace?.name || '';

      const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);

      if (data.length === 0) {
        result.error = '파일에 데이터가 없습니다';
        return result;
      }

      const firstRow = data[0] as any;
      const requiredColumns = ['순번', '시간', '가스누적지침'];
      const missing = requiredColumns.filter(col => !(col in firstRow));
      if (missing.length > 0) {
        result.error = `필수 컬럼 누락: ${missing.join(', ')}`;
        return result;
      }

      result.totalRows = data.length;

      let importBatch = await this.prisma.importBatch.create({
        data: {
          fileName: file.originalname,
          furnaceId: effectiveFurnaceId,
          periodStart: parsed.periodStart ? new Date(parsed.periodStart) : null,
          periodEnd: parsed.periodEnd ? new Date(parsed.periodEnd) : null,
          rowCount: data.length,
        },
      });
      result.batchId = importBatch.id;

      const existingTimestamps = new Set<string>();
      if (duplicateMode === 'skip') {
        const existing = await this.prisma.gasReading.findMany({
          where: {
            furnaceId: effectiveFurnaceId,
            ...(parsed.periodStart && parsed.periodEnd ? {
              ts: { gte: new Date(parsed.periodStart), lte: new Date(parsed.periodEnd + 'T23:59:59') },
            } : {}),
          },
          select: { ts: true },
        });
        existing.forEach(r => existingTimestamps.add(r.ts.toISOString()));
      }

      const batchSize = 1000;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize) as any[];
        const readings = [];

        for (const row of batch) {
          try {
            const ts = new Date(row['시간']);
            if (isNaN(ts.getTime())) { result.errorCount++; continue; }

            const tsKey = ts.toISOString();
            if (duplicateMode === 'skip' && existingTimestamps.has(tsKey)) {
              result.duplicateCount++;
              continue;
            }

            readings.push({
              furnaceId: effectiveFurnaceId,
              ts,
              temp: parseFloat(row['온도']) || null,
              gas: parseFloat(row['가스']) || null,
              gasCumulative: parseFloat(row['가스누적지침']) || 0,
              power: row['전력'] === '-' ? null : parseFloat(row['전력']) || null,
              powerCumulative: row['전력누적지침'] === '-' ? null : parseFloat(row['전력누적지침']) || null,
              temp2: parseFloat(row['온도2']) || null,
              temp3: parseFloat(row['온도3']) || null,
              importBatchId: importBatch.id,
            });
            result.successCount++;
          } catch {
            result.errorCount++;
          }
        }

        if (readings.length > 0) {
          if (duplicateMode === 'upsert') {
            for (const r of readings) {
              await this.prisma.gasReading.upsert({
                where: { furnaceId_ts: { furnaceId: r.furnaceId, ts: r.ts } },
                update: { gasCumulative: r.gasCumulative, temp: r.temp, gas: r.gas, power: r.power, powerCumulative: r.powerCumulative, temp2: r.temp2, temp3: r.temp3 },
                create: r,
              });
            }
          } else {
            await this.prisma.gasReading.createMany({ data: readings });
          }
        }
      }

      await this.prisma.importBatch.update({
        where: { id: importBatch.id },
        data: { successCount: result.successCount, errorCount: result.errorCount },
      });

      result.status = 'completed';
    } catch (err: any) {
      result.error = err.message || '처리 중 오류 발생';
    }

    return result;
  }

  async uploadBatch(
    files: Express.Multer.File[],
    furnaceIds?: number[],
    duplicateMode: 'skip' | 'upsert' = 'skip',
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    for (let i = 0; i < files.length; i++) {
      const fid = furnaceIds?.[i];
      results.push(await this.uploadSingleFile(files[i], fid, duplicateMode));
    }
    return results;
  }

  async getUploadHistory() {
    return this.prisma.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { furnace: true },
    });
  }

  async getUsageForCharge(furnaceId: number, workStart: Date, workEnd: Date) {
    const startReading = await this.findClosestReading(furnaceId, workStart);
    const endReading = await this.findClosestReading(furnaceId, workEnd);
    if (!startReading || !endReading) return null;

    return {
      gasBefore: startReading.gasCumulative,
      gasAfter: endReading.gasCumulative,
      usage: endReading.gasCumulative - startReading.gasCumulative,
      startTime: startReading.ts,
      endTime: endReading.ts,
    };
  }
}
