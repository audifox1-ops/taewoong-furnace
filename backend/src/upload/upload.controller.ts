import { Controller, Get, Post, Delete, Param, Body, Query, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadService } from './upload.service';




@ApiTags('uploads')
@Controller('uploads')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('pdf')  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload PDF scan (admin only)' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadPdf(file);
  }

  @Post('pdf/batch')  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple PDF scans (admin only)' })
  @UseInterceptors(FilesInterceptor('files', 100, { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadMultiplePdfs(@UploadedFiles() files: Express.Multer.File[]) {
    const results = [];
    for (const file of files) {
      try {
        const result = await this.uploadService.uploadPdf(file);
        results.push({ ...result, status: 'success' });
      } catch (error) {
        results.push({ fileName: file.originalname, status: 'error', error: error.message });
      }
    }
    return results;
  }

  @Get('pdf/:id/url')  @ApiOperation({ summary: 'Get PDF presigned URL' })
  async getPdfUrl(@Param('id') id: string) {
    return this.uploadService.getPdfUrl(parseInt(id));
  }

  @Get('pdf')  @ApiOperation({ summary: 'List all PDF scans' })
  async listScans() {
    return this.uploadService.listScans();
  }

  @Post('charge-record')  @ApiOperation({ summary: 'Create charge record from PDF page' })
  async createChargeRecord(@Body() body: {
    chargeScanId: number;
    pageIndex: number;
    furnaceId: number;
    workDate: string;
    shift: string;
    workEnd: string;
    workStart?: string;
    material?: string;
    weightKg?: number;
    note?: string;
  }) {
    return this.uploadService.createChargeRecord({
      ...body,
      workDate: new Date(body.workDate),
      workEnd: new Date(body.workEnd),
      workStart: body.workStart ? new Date(body.workStart) : undefined,
    });
  }

  @Get('charge-records')  @ApiOperation({ summary: 'Get charge records' })
  async getChargeRecords(@Query('chargeScanId') chargeScanId?: string) {
    return this.uploadService.getChargeRecords(chargeScanId ? parseInt(chargeScanId) : undefined);
  }

  @Delete('pdf/:id')  @ApiOperation({ summary: 'Delete PDF scan (admin only)' })
  async deleteScan(@Param('id') id: string) {
    return this.uploadService.deleteScan(parseInt(id));
  }
}
