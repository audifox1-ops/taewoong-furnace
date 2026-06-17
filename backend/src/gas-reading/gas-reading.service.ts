import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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

export interface FurnaceFixCandidate {
  batchId: number;
  fileName: string;
  currentFurnaceNo: number | null;
  currentFurnaceName: string | null;
  targetFurnaceNo: number | null;
  targetFurnaceName: string | null;
  rowCount: number;
  minTimestamp: string | null;
  maxTimestamp: string | null;
}

export interface FurnaceFixResult {
  batchId: number;
  fileName: string;
  fromFurnaceNo: number | null;
  toFurnaceNo: number | null;
  rowCount: number;
  updated: boolean;
  reason?: string;
}

@Injectable()
export class GasReadingService {
  constructor(private prisma: PrismaService) {}

  parseFileName(fileName: string): FileParseResult {
    const normalizeDigits = (value: string) =>
      value.replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xFF10));

    const base = fileName.replace(/\.(xlsx|xls|csv)$/i, '');
    const normalizedBase = normalizeDigits(base);
    let furnaceNo: number | null = null;
    let furnaceName: string | null = null;
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    const furnaceMatch = normalizedBase.match(/(?:가열\s*로?)?\s*(\d+)\s*호(?:기)?/i);
    if (furnaceMatch) {
      furnaceNo = parseInt(furnaceMatch[1]);
      furnaceName = `가열${furnaceNo}호`;
    }

    const dateRangeMatch = normalizedBase.match(/\((\d{4}-\d{2}-\d{2})\s*[~\-]\s*(\d{4}-\d{2}-\d{2})\)/);
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
      if (startDate) where.ts.gte = this.parseDateFilter(startDate);
      if (endDate) where.ts.lte = this.parseDateFilter(endDate, true);
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

  async findClosestReading(furnaceId: number, targetTime: Date) {
    const reading = await this.prisma.gasReading.findFirst({
      where: { furnaceId, ts: targetTime },
    });
    if (reading) return reading;

    const twoMinutes = 2 * 60 * 1000;
    const before = await this.prisma.gasReading.findFirst({
      where: { furnaceId, ts: { gte: new Date(targetTime.getTime() - twoMinutes), lt: targetTime } },
      orderBy: { ts: 'desc' },
    });
    const after = await this.prisma.gasReading.findFirst({
      where: { furnaceId, ts: { gt: targetTime, lte: new Date(targetTime.getTime() + twoMinutes) } },
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
      fileName: file?.originalname || '',
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
      if (!file) {
        throw new BadRequestException('업로드할 파일이 없습니다');
      }
      if (!['skip', 'upsert'].includes(duplicateMode)) {
        throw new BadRequestException('중복 처리 방식이 올바르지 않습니다');
      }

      const ext = file.originalname.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
        result.error = 'Excel/CSV 파일만 지원됩니다';
        return result;
      }

      const parsed = this.parseFileName(file.originalname);
      const parsedFurnace = parsed.furnaceNo
        ? await this.prisma.furnace.findUnique({ where: { no: parsed.furnaceNo } })
        : null;
      const furnace = furnaceId
        ? await this.prisma.furnace.findUnique({ where: { id: furnaceId } })
        : parsedFurnace;

      if (!furnace) {
        result.error = '가열로 번호를 확인할 수 없습니다. 파일명에 호기를 넣거나 가열로를 직접 선택하세요.';
        return result;
      }

      const effectiveFurnaceId = furnace.id;
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
      const seenInFile = new Set<string>();

      const batchSize = 1000;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize) as any[];
        const readings = [];

        for (const row of batch) {
          try {
            const ts = new Date(row['시간']);
            if (isNaN(ts.getTime())) { result.errorCount++; continue; }

            const tsKey = ts.toISOString();
            if (seenInFile.has(tsKey) || (duplicateMode === 'skip' && existingTimestamps.has(tsKey))) {
              result.duplicateCount++;
              continue;
            }
            seenInFile.add(tsKey);

            const gasCumulative = this.parseRequiredNumber(row['가스누적지침']);
            if (gasCumulative == null) {
              result.errorCount++;
              continue;
            }

            readings.push({
              furnaceId: effectiveFurnaceId,
              ts,
              temp: this.parseOptionalNumber(row['온도']),
              gas: this.parseOptionalNumber(row['가스']),
              gasCumulative,
              power: this.parseOptionalNumber(row['전력']),
              powerCumulative: this.parseOptionalNumber(row['전력누적지침']),
              temp2: this.parseOptionalNumber(row['온도2']),
              temp3: this.parseOptionalNumber(row['온도3']),
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
            await this.prisma.gasReading.createMany({ data: readings, skipDuplicates: true });
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
    const results = await Promise.all(
      files.map((file, i) => this.uploadSingleFile(file, furnaceIds?.[i], duplicateMode))
    );
    return results;
  }

  private parseOptionalNumber(value: any): number | null {
    if (value === undefined || value === null || value === '' || value === '-') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private parseRequiredNumber(value: any): number | null {
    if (value === undefined || value === null || value === '' || value === '-') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  async getUploadHistory() {
    return this.prisma.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        fileName: true,
        furnaceId: true,
        periodStart: true,
        periodEnd: true,
        rowCount: true,
        successCount: true,
        errorCount: true,
        createdAt: true,
        furnace: {
          select: {
            id: true,
            no: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteUploadHistory(batchId: number) {
    const batch = await this.prisma.importBatch.findFirst({
      where: { id: batchId },
      select: { id: true },
    });

    if (!batch) {
      throw new NotFoundException('Upload history not found');
    }

    await this.prisma.$transaction([
      this.prisma.gasReading.deleteMany({
        where: { importBatchId: batchId },
      }),
      this.prisma.importBatch.delete({
        where: { id: batchId },
      }),
    ]);

    return {
      deleted: true,
    };
  }

  async listFurnaceFixCandidates(currentFurnaceNo = 1): Promise<FurnaceFixCandidate[]> {
    const batches = await this.prisma.importBatch.findMany({
      where: { furnace: { no: currentFurnaceNo } },
      include: {
        furnace: true,
        gasReadings: {
          select: { ts: true },
          orderBy: { ts: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return batches
      .map((batch) => {
        const parsed = this.parseFileName(batch.fileName);
        const targetFurnaceNo = parsed.furnaceNo;
        return {
          batchId: batch.id,
          fileName: batch.fileName,
          currentFurnaceNo: batch.furnace?.no ?? null,
          currentFurnaceName: batch.furnace?.name ?? null,
          targetFurnaceNo,
          targetFurnaceName: targetFurnaceNo ? `가열${targetFurnaceNo}호` : null,
          rowCount: batch.rowCount,
          minTimestamp: batch.gasReadings[0]?.ts?.toISOString() ?? null,
          maxTimestamp: batch.gasReadings[batch.gasReadings.length - 1]?.ts?.toISOString() ?? null,
        };
      })
      .filter((batch) => batch.targetFurnaceNo != null && batch.targetFurnaceNo !== batch.currentFurnaceNo);
  }

  async applyFurnaceFix(batchId: number, currentFurnaceNo = 1): Promise<FurnaceFixResult> {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        furnace: true,
        gasReadings: {
          select: { id: true, ts: true },
          orderBy: { ts: 'asc' },
        },
      },
    });

    if (!batch) {
      throw new BadRequestException('Import batch not found');
    }
    if ((batch.furnace?.no ?? null) !== currentFurnaceNo) {
      return {
        batchId,
        fileName: batch.fileName,
        fromFurnaceNo: batch.furnace?.no ?? null,
        toFurnaceNo: null,
        rowCount: batch.rowCount,
        updated: false,
        reason: `현재 호기가 ${currentFurnaceNo}호기가 아니어서 건너뜀`,
      };
    }

    const parsed = this.parseFileName(batch.fileName);
    if (!parsed.furnaceNo) {
      return {
        batchId,
        fileName: batch.fileName,
        fromFurnaceNo: batch.furnace?.no ?? null,
        toFurnaceNo: null,
        rowCount: batch.rowCount,
        updated: false,
        reason: '파일명에서 대상 호기를 추출할 수 없습니다',
      };
    }

    const targetFurnace = await this.prisma.furnace.findUnique({ where: { no: parsed.furnaceNo } });
    if (!targetFurnace) {
      return {
        batchId,
        fileName: batch.fileName,
        fromFurnaceNo: batch.furnace?.no ?? null,
        toFurnaceNo: parsed.furnaceNo,
        rowCount: batch.rowCount,
        updated: false,
        reason: `대상 호기 ${parsed.furnaceNo}호기를 찾을 수 없습니다`,
      };
    }

    await this.prisma.$transaction([
      this.prisma.importBatch.update({
        where: { id: batch.id },
        data: { furnaceId: targetFurnace.id },
      }),
      this.prisma.gasReading.updateMany({
        where: { importBatchId: batch.id },
        data: { furnaceId: targetFurnace.id },
      }),
    ]);

    return {
      batchId,
      fileName: batch.fileName,
      fromFurnaceNo: batch.furnace?.no ?? null,
      toFurnaceNo: targetFurnace.no,
      rowCount: batch.rowCount,
      updated: true,
    };
  }

  async applyFurnaceFixes(batchIds: number[], currentFurnaceNo = 1): Promise<FurnaceFixResult[]> {
    const results = await Promise.all(
      batchIds.map(batchId => this.applyFurnaceFix(batchId, currentFurnaceNo))
    );
    return results;
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
