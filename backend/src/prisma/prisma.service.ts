import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      console.warn('[PrismaService] Skipping eager database connection:', error instanceof Error ? error.message : error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
