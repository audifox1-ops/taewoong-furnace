import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalysisService } from './analysis.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('analysis')
@Controller('analysis')
export class AnalysisController {
  constructor(private analysisService: AnalysisService) {}

  @Get('usage-trend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboard() {
    return this.analysisService.getDashboardStats();
  }

  @Get('unit-rate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
