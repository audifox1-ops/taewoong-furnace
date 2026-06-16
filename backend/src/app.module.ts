import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';

import { FurnaceModule } from './furnace/furnace.module';
import { GasReadingModule } from './gas-reading/gas-reading.module';
import { ChargeModule } from './charge/charge.module';
import { UploadModule } from './upload/upload.module';
import { AnalysisModule } from './analysis/analysis.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    FurnaceModule,
    GasReadingModule,
    ChargeModule,
    UploadModule,
    AnalysisModule,
    SettingsModule,
  ],
})
export class AppModule {}
