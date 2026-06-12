import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FurnaceService } from './furnace.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('furnaces')
@Controller('furnaces')
export class FurnaceController {
  constructor(private furnaceService: FurnaceService) {}

  @Get()
  @ApiOperation({ summary: 'Get all furnaces' })
  async findAll() {
    return this.furnaceService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get furnace by ID' })
  async findOne(@Param('id') id: string) {
    return this.furnaceService.findOne(parseInt(id));
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create furnace (admin only)' })
  async create(@Body() body: { no: number; name: string }) {
    return this.furnaceService.create(body);
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seed furnaces (admin only)' })
  async seed() {
    return this.furnaceService.seed();
  }
}
