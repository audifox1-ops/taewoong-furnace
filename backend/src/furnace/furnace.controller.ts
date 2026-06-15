import { Controller, Get, Post, Param, Body, } from '@nestjs/common';
import { ApiTags, ApiOperation, } from '@nestjs/swagger';
import { FurnaceService } from './furnace.service';




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

  @Post()  @ApiOperation({ summary: 'Create furnace (admin only)' })
  async create(@Body() body: { no: number; name: string }) {
    return this.furnaceService.create(body);
  }

  @Post('seed')  @ApiOperation({ summary: 'Seed furnaces (admin only)' })
  async seed() {
    return this.furnaceService.seed();
  }
}
