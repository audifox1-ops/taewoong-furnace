import { Controller, Get, Post, Put, Delete, Param, Body, Query, } from '@nestjs/common';
import { ApiTags, ApiOperation, } from '@nestjs/swagger';
import { ChargeService } from './charge.service';



import { CreateChargeDto, UpdateChargeDto, PasteDataDto, AutoFillDto, BulkUpdateDto } from './dto/charge.dto';

@ApiTags('charges')
@Controller('charges')
export class ChargeController {
  constructor(private chargeService: ChargeService) {}

  @Get()  @ApiOperation({ summary: 'Get all charges with filters' })
  async findAll(
    @Query('furnaceId') furnaceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('shift') shift?: string,
  ) {
    return this.chargeService.findAll(
      furnaceId ? parseInt(furnaceId) : undefined,
      startDate,
      endDate,
      shift,
    );
  }

  @Get(':id')  @ApiOperation({ summary: 'Get charge by ID' })
  async findOne(@Param('id') id: string) {
    return this.chargeService.findOne(parseInt(id));
  }

  @Post()  @ApiOperation({ summary: 'Create charge entry' })
  async create(@Body() body: CreateChargeDto) {
    return this.chargeService.create({
      ...body,
      workDate: new Date(body.workDate),
    });
  }

  @Put(':id')  @ApiOperation({ summary: 'Update charge entry' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateChargeDto,
  ) {
    return this.chargeService.update(parseInt(id), {
      ...body,
      workDate: body.workDate ? new Date(body.workDate) : undefined,
    });
  }

  @Post('bulk-update')  @ApiOperation({ summary: 'Bulk update charge entries' })
  async bulkUpdate(@Body() body: BulkUpdateDto) {
    return this.chargeService.bulkUpdate(body.updates.map(update => ({
      ...update,
      workDate: update.workDate ? new Date(update.workDate) : undefined,
    })));
  }

  @Post('paste')  @ApiOperation({ summary: 'Paste data from clipboard (TSV)' })
  async pasteData(@Body() body: PasteDataDto) {
    return this.chargeService.pasteData(body.rows);
  }

  @Post('auto-fill')  @ApiOperation({ summary: 'Auto-fill usage from gas readings' })
  async autoFillUsage(@Body() body: AutoFillDto) {
    return this.chargeService.autoFillUsage(
      body.furnaceId,
      new Date(body.workDate),
      body.shift,
      body.workEnd ? new Date(body.workEnd) : undefined,
    );
  }

  @Delete(':id')  @ApiOperation({ summary: 'Delete charge entry' })
  async delete(@Param('id') id: string) {
    return this.chargeService.delete(parseInt(id));
  }

  @Post(':id/link-record')  @ApiOperation({ summary: 'Link charge to charge record (auto-fills usage)' })
  async linkChargeRecord(
    @Param('id') id: string,
    @Body() body: { chargeRecordId: number },
  ) {
    return this.chargeService.linkChargeRecord(parseInt(id), body.chargeRecordId);
  }

  @Get('summary/usage')  @ApiOperation({ summary: 'Get usage summary' })
  async getUsageSummary(
    @Query('furnaceId') furnaceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.chargeService.getUsageSummary(
      furnaceId ? parseInt(furnaceId) : undefined,
      startDate,
      endDate,
    );
  }

  @Post('rematch-all')  @ApiOperation({ summary: 'Rematch all charge records to gas data (admin only)' })
  async rematchAll() {
    return this.chargeService.rematchAllChargeRecords();
  }

  @Get('unmatched')  @ApiOperation({ summary: 'Get unmatched charge records (admin only)' })
  async getUnmatched() {
    return this.chargeService.getUnmatchedRecords();
  }

  @Put('record/:id')  @ApiOperation({ summary: 'Update charge record and auto-rematch' })
  async updateRecord(
    @Param('id') id: string,
    @Body() body: {
      furnaceId?: number;
      workDate?: string;
      shift?: string;
      workEnd?: string;
      material?: string;
      weightKg?: number;
      note?: string;
    },
  ) {
    return this.chargeService.updateChargeRecord(parseInt(id), {
      ...body,
      workDate: body.workDate ? new Date(body.workDate) : undefined,
      workEnd: body.workEnd ? new Date(body.workEnd) : undefined,
    });
  }
}
