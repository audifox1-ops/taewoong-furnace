import { Module } from '@nestjs/common';
import { GasReadingService } from './gas-reading.service';
import { GasReadingController } from './gas-reading.controller';

@Module({
  controllers: [GasReadingController],
  providers: [GasReadingService],
  exports: [GasReadingService],
})
export class GasReadingModule {}
