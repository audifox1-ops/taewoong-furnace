import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Shift } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class UploadService {
  private supabase: SupabaseClient;
  private bucket: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL', ''),
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );
    this.bucket = this.configService.get<string>('SUPABASE_STORAGE_BUCKET', 'taewoong-furnace');
  }

  async ensureBucket() {
    const { data: buckets } = await this.supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === this.bucket);
    if (!exists) {
      const { error } = await this.supabase.storage.createBucket(this.bucket, {
        public: false,
      });
      if (error) throw new Error(`버킷 생성 실패: ${error.message}`);
    }
  }

  async uploadPdf(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('업로드할 PDF 파일이 없습니다');
    }
    if (file.size > 50 * 1024 * 1024) {
      throw new BadRequestException('PDF 파일은 50MB 이하만 업로드할 수 있습니다');
    }
    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Only PDF files are allowed');
    }

    await this.ensureBucket();

    const fileName = `${Date.now()}-${file.originalname}`;

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(fileName, file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(`파일 업로드 실패: ${error.message}`);
    }

    let pageCount = 1;
    try {
      const pdfDoc = await PDFDocument.load(file.buffer);
      pageCount = pdfDoc.getPageCount();
    } catch (e) {
      // 페이지 수 파악 불가 시 기본값 1 사용
    }

    const chargeScan = await this.prisma.chargeScan.create({
      data: {
        fileUrl: fileName,
        originalFileName: file.originalname,
        pageCount,
        status: 'uploaded',
      },
    });

    return chargeScan;
  }

  async getPdfUrl(id: number) {
    const scan = await this.prisma.chargeScan.findUnique({ where: { id } });
    if (!scan) throw new NotFoundException('Charge scan not found');

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(scan.fileUrl, 3600); // 1시간 유효 URL

    if (error) throw new BadRequestException(`URL 생성 실패: ${error.message}`);

    return { url: data.signedUrl, scan };
  }

  async listScans() {
    return this.prisma.chargeScan.findMany({
      orderBy: { uploadedAt: 'desc' },
      include: { _count: { select: { chargeRecords: true } } },
    });
  }

  async createChargeRecord(data: {
    chargeScanId: number;
    pageIndex: number;
    furnaceId: number;
    workDate: Date;
    shift: string;
    workEnd: Date;
    workStart?: Date;
    material?: string;
    weightKg?: number;
    note?: string;
  }) {
    const scan = await this.prisma.chargeScan.findUnique({ where: { id: data.chargeScanId } });
    if (!scan) throw new NotFoundException('Charge scan not found');
    if (data.pageIndex < 1 || (scan.pageCount && data.pageIndex > scan.pageCount)) {
      throw new BadRequestException('페이지 번호가 올바르지 않습니다');
    }
    const furnace = await this.prisma.furnace.findUnique({ where: { id: data.furnaceId } });
    if (!furnace) throw new BadRequestException('Furnace not found');
    if (!['day', 'night'].includes(data.shift)) {
      throw new BadRequestException('Invalid shift');
    }
    if (Number.isNaN(data.workDate.getTime()) || Number.isNaN(data.workEnd.getTime())) {
      throw new BadRequestException('작업일 또는 종료 시간이 올바르지 않습니다');
    }
    if (data.weightKg != null && data.weightKg <= 0) {
      throw new BadRequestException('중량은 0보다 커야 합니다');
    }

    return this.prisma.chargeRecord.create({
      data: {
        ...data,
        shift: data.shift as Shift,
      },
      include: { chargeScan: true, furnace: true },
    });
  }

  async getChargeRecords(chargeScanId?: number) {
    const where = chargeScanId ? { chargeScanId } : {};
    return this.prisma.chargeRecord.findMany({
      where,
      include: { chargeScan: true, furnace: true },
      orderBy: [{ workDate: 'desc' }, { pageIndex: 'asc' }],
    });
  }

  async deleteScan(id: number) {
    const scan = await this.prisma.chargeScan.findUnique({
      where: { id },
      include: { _count: { select: { chargeRecords: true } } },
    });
    if (!scan) throw new NotFoundException('Charge scan not found');
    if (scan._count.chargeRecords > 0) {
      throw new ConflictException('Linked charge records exist. Delete or unlink them first.');
    }

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([scan.fileUrl]);

    if (error) throw new BadRequestException(`파일 삭제 실패: ${error.message}`);

    await this.prisma.chargeScan.delete({ where: { id } });

    return { deleted: true };
  }
}
