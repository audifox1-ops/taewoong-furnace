import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GasReadingService } from './gas-reading.service';

@ApiTags('gas-readings')
@Controller('gas-readings')
export class GasReadingController {
  constructor(private gasReadingService: GasReadingService) {}

  @Get()
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
      startDate,
      endDate,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 100,
    );
  }

  @Get('furnace/:furnaceId')
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
  @ApiOperation({ summary: 'Parse furnace/date from filename' })
  parseFilename(@Query('name') name: string) {
    return this.gasReadingService.parseFileName(name);
  }

  @Get('upload-history')
  @ApiOperation({ summary: 'Get upload history' })
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  async getUploadHistory() {
    return this.gasReadingService.getUploadHistory();
  }

  @Get('furnace-fix-candidates')
  @ApiOperation({ summary: 'List gas-reading batches that look misassigned' })
  async listFurnaceFixCandidates(@Query('currentFurnaceNo') currentFurnaceNo?: string) {
    return this.gasReadingService.listFurnaceFixCandidates(
      currentFurnaceNo ? parseInt(currentFurnaceNo) : 1,
    );
  }

  @Post('upload')
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
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple Excel/CSV files (admin only)' })
  @UseInterceptors(FilesInterceptor('files', 50, { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('furnaceId') furnaceId?: string,
    @Body('duplicateMode') duplicateMode?: string,
  ) {
    if (!files?.length) {
      throw new BadRequestException('?낅줈?쒗븷 ?뚯씪???놁뒿?덈떎');
    }
    return this.gasReadingService.uploadBatch(
      files,
      furnaceId ? [parseInt(furnaceId)] : undefined,
      (duplicateMode as 'skip' | 'upsert') || 'skip',
    );
  }

  @Post('fix-furnace-batch')
  @ApiOperation({ summary: 'Fix a single misassigned gas-reading batch' })
  async fixFurnaceBatch(
    @Body() body: { batchId: number; currentFurnaceNo?: number },
  ) {
    return this.gasReadingService.applyFurnaceFix(body.batchId, body.currentFurnaceNo ?? 1);
  }

  @Post('fix-furnace-batches')
  @ApiOperation({ summary: 'Fix multiple misassigned gas-reading batches' })
  async fixFurnaceBatches(
    @Body() body: { batchIds: number[]; currentFurnaceNo?: number },
  ) {
    return this.gasReadingService.applyFurnaceFixes(body.batchIds, body.currentFurnaceNo ?? 1);
  }
}
