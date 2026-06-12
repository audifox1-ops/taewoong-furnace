import { Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { GasReadingModule } from '../gas-reading/gas-reading.module';
import { ChargeModule } from '../charge/charge.module';

@Module({
  imports: [GasReadingModule, ChargeModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
