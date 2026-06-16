import { Module } from '@nestjs/common';
import { ChargeService } from './charge.service';
import { ChargeController } from './charge.controller';
import { GasReadingModule } from '../gas-reading/gas-reading.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [GasReadingModule, SettingsModule],
  controllers: [ChargeController],
  providers: [ChargeService],
  exports: [ChargeService],
})
export class ChargeModule {}
