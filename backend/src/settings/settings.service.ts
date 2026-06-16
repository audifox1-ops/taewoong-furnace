import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ShiftConfig {
  dayStart: string;
  dayEnd: string;
  nightStart: string;
  nightEnd: string;
}

const DEFAULT_SHIFT_CONFIG: ShiftConfig = {
  dayStart: '08:00',
  dayEnd: '19:30',
  nightStart: '20:00',
  nightEnd: '07:00',
};

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getShiftConfig(): Promise<ShiftConfig> {
    const setting = await this.prisma.setting.findUnique({
      where: { key: 'shiftConfig' },
    });
    if (!setting) return DEFAULT_SHIFT_CONFIG;
    return setting.value as unknown as ShiftConfig;
  }

  async updateShiftConfig(config: ShiftConfig): Promise<ShiftConfig> {
    await this.prisma.setting.upsert({
      where: { key: 'shiftConfig' },
      update: { value: config as unknown as Prisma.InputJsonValue },
      create: { key: 'shiftConfig', value: config as unknown as Prisma.InputJsonValue },
    });
    return config;
  }

  async getSetting(key: string): Promise<any> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    return setting?.value ?? null;
  }

  async updateSetting(key: string, value: any): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
