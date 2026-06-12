import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FurnaceService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.furnace.findMany({ orderBy: { no: 'asc' } });
  }

  async findOne(id: number) {
    const furnace = await this.prisma.furnace.findUnique({ where: { id } });
    if (!furnace) {
      throw new NotFoundException('Furnace not found');
    }
    return furnace;
  }

  async findByNo(no: number) {
    const furnace = await this.prisma.furnace.findUnique({ where: { no } });
    if (!furnace) {
      throw new NotFoundException('Furnace not found');
    }
    return furnace;
  }

  async create(data: { no: number; name: string }) {
    return this.prisma.furnace.create({ data });
  }

  async seed() {
    const furnaces = [];
    for (let i = 1; i <= 20; i++) {
      if (i === 7) continue; // 7호기는 존재하지 않음
      furnaces.push({ no: i, name: `가열${i}호` });
    }

    for (const furnace of furnaces) {
      await this.prisma.furnace.upsert({
        where: { no: furnace.no },
        update: { name: furnace.name },
        create: furnace,
      });
    }
    
    return this.prisma.furnace.findMany({ orderBy: { no: 'asc' } });
  }
}
