import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as Minio from 'minio';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class UploadService {
  private minioClient: Minio.Client;
  private bucket: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.configService.get('MINIO_PORT', '9000')),
      useSSL: this.configService.get('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get('MINIO_SECRET_KEY', 'minioadmin'),
    });
    this.bucket = this.configService.get('MINIO_BUCKET', 'taewoong-furnace');
  }

  async ensureBucket() {
    const exists = await this.minioClient.bucketExists(this.bucket);
    if (!exists) {
      await this.minioClient.makeBucket(this.bucket);
    }
  }

  async uploadPdf(file: Express.Multer.File) {
    await this.ensureBucket();

    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Only PDF files are allowed');
    }

    const fileName = `${Date.now()}-${file.originalname}`;
    await this.minioClient.putObject(this.bucket, fileName, file.buffer, file.size, {
      'Content-Type': 'application/pdf',
    });

    let pageCount = 1;
    try {
      const pdfDoc = await PDFDocument.load(file.buffer);
      pageCount = pdfDoc.getPageCount();
    } catch (e) {
      // If we can't read page count, default to 1
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

    const url = await this.minioClient.presignedGetObject(this.bucket, scan.fileUrl, 3600);
    return { url, scan };
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
    return this.prisma.chargeRecord.create({
      data,
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
    const scan = await this.prisma.chargeScan.findUnique({ where: { id } });
    if (!scan) throw new NotFoundException('Charge scan not found');

    await this.minioClient.removeObject(this.bucket, scan.fileUrl);
    await this.prisma.chargeScan.delete({ where: { id } });
    
    return { deleted: true };
  }
}
