import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalysisService } from './analysis.service';

@ApiTags('analysis')
@Controller('analysis')
export class AnalysisController {
  constructor(private analysisService: AnalysisService) {}

  @Get('usage-trend')
  @ApiOperation({ summary: 'Get usage trend by date' })
  async getUsageTrend(
    @Query('furnaceId') furnaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analysisService.getUsageTrend(
      parseInt(furnaceId),
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('temperature-trend')
  @ApiOperation({ summary: 'Get temperature trend by hour' })
  async getTemperatureTrend(
    @Query('furnaceId') furnaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analysisService.getTemperatureTrend(
      parseInt(furnaceId),
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('usage-by-shift')
  @ApiOperation({ summary: 'Get usage by shift' })
  async getUsageByShift(
    @Query('furnaceId') furnaceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analysisService.getUsageByShift(
      furnaceId ? parseInt(furnaceId) : undefined,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('usage-by-furnace')
  @ApiOperation({ summary: 'Get usage by furnace' })
  async getUsageByFurnace(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analysisService.getUsageByFurnace(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboard() {
    return this.analysisService.getDashboardStats();
  }

  @Get('unit-rate')
  @ApiOperation({ summary: 'Get unit rate analysis' })
  async getUnitRate(
    @Query('furnaceId') furnaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analysisService.getUnitRate(
      parseInt(furnaceId),
      new Date(startDate),
      new Date(endDate),
    );
  }
}
