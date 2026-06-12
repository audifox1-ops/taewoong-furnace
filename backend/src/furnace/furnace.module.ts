import { Module } from '@nestjs/common';
import { FurnaceService } from './furnace.service';
import { FurnaceController } from './furnace.controller';

@Module({
  controllers: [FurnaceController],
  providers: [FurnaceService],
  exports: [FurnaceService],
})
export class FurnaceModule {}
