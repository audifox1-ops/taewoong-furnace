import { Controller, Get, Post, Query, Param, Body, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { GasReadingService } from './gas-reading.service';




@ApiTags('gas-readings')
@Controller('gas-readings')
export class GasReadingController {
  constructor(private gasReadingService: GasReadingService) {}

  @Get()  @ApiOperation({ summary: 'Get gas readings with pagination' })
  async findAll(
    @Query('furnaceId') furnaceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.gasReadingService.findAll(
      furnaceId ? parseInt(furnaceId) : undefined,
      startDate, endDate,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 100,
    );
  }

  @Get('furnace/:furnaceId')  @ApiOperation({ summary: 'Get gas readings for specific furnace' })
  async findByFurnace(
    @Param('furnaceId') furnaceId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate) : new Date();
    return this.gasReadingService.findByFurnaceAndTimeRange(parseInt(furnaceId), start, end);
  }

  @Get('parse-filename')  @ApiOperation({ summary: 'Parse furnace/date from filename' })
  parseFilename(@Query('name') name: string) {
    return this.gasReadingService.parseFileName(name);
  }

  @Get('upload-history')  @ApiOperation({ summary: 'Get upload history' })
  async getUploadHistory() {
    return this.gasReadingService.getUploadHistory();
  }

  @Post('upload')  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload single Excel/CSV (admin only)' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('furnaceId') furnaceId?: string,
    @Body('duplicateMode') duplicateMode?: string,
  ) {
    return this.gasReadingService.uploadSingleFile(
      file,
      furnaceId ? parseInt(furnaceId) : undefined,
      (duplicateMode as 'skip' | 'upsert') || 'skip',
    );
  }

  @Post('upload-batch')  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple Excel/CSV files (admin only)' })
  @UseInterceptors(FilesInterceptor('files', 50, { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('duplicateMode') duplicateMode?: string,
  ) {
    return this.gasReadingService.uploadBatch(
      files,
      undefined,
      (duplicateMode as 'skip' | 'upsert') || 'skip',
    );
  }
}
