import { Controller, Get, Post, Query, Param, Body, UseGuards, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { GasReadingService } from './gas-reading.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('gas-readings')
@Controller('gas-readings')
export class GasReadingController {
  constructor(private gasReadingService: GasReadingService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get gas readings with pagination' })
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

  @Get('furnace/:furnaceId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get gas readings for specific furnace' })
  async findByFurnace(
    @Param('furnaceId') furnaceId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate) : new Date();
    return this.gasReadingService.findByFurnaceAndTimeRange(parseInt(furnaceId), start, end);
  }

  @Get('parse-filename')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Parse furnace/date from filename' })
  parseFilename(@Query('name') name: string) {
    return this.gasReadingService.parseFileName(name);
  }

  @Get('upload-history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get upload history' })
  async getUploadHistory() {
    return this.gasReadingService.getUploadHistory();
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
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

  @Post('upload-batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
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
