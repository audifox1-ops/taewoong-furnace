import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService, ShiftConfig } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('shift')
  @ApiOperation({ summary: 'Get shift time configuration' })
  async getShiftConfig() {
    return this.settingsService.getShiftConfig();
  }

  @Put('shift')
  @ApiOperation({ summary: 'Update shift time configuration' })
  async updateShiftConfig(@Body() config: ShiftConfig) {
    return this.settingsService.updateShiftConfig(config);
  }
}
