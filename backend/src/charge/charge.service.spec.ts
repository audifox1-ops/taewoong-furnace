import { Test, TestingModule } from '@nestjs/testing';
import { ChargeService } from './charge.service';
import { PrismaService } from '../prisma/prisma.service';
import { GasReadingService } from '../gas-reading/gas-reading.service';

describe('ChargeService', () => {
  let service: ChargeService;
  let prismaMock: any;
  let gasReadingServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      chargeEntry: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      chargeRecord: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      furnace: {
        findUnique: jest.fn(),
      },
    };

    gasReadingServiceMock = {
      findClosestReading: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChargeService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: GasReadingService, useValue: gasReadingServiceMock },
      ],
    }).compile();

    service = module.get<ChargeService>(ChargeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a charge with usage calculation', async () => {
      const createData = {
        chargeNo: '260601-001',
        furnaceId: 1,
        gasBefore: 1000,
        gasAfter: 1500,
        workDate: new Date('2026-06-01'),
        shift: 'day',
      };

      prismaMock.chargeEntry.create.mockResolvedValue({
        id: 1,
        ...createData,
        usage: 500,
      });

      const result = await service.create(createData);

      expect(result.usage).toBe(500);
      expect(result.warnings).toEqual([]);
      expect(prismaMock.chargeEntry.create).toHaveBeenCalled();
    });

    it('should add warning for negative usage', async () => {
      const createData = {
        chargeNo: '260601-002',
        furnaceId: 1,
        gasBefore: 1500,
        gasAfter: 1000,
        workDate: new Date('2026-06-01'),
        shift: 'day',
      };

      prismaMock.chargeEntry.create.mockResolvedValue({
        id: 2,
        ...createData,
        usage: -500,
      });

      const result = await service.create(createData);

      expect(result.usage).toBe(-500);
      expect(result.warnings).toContain('음수 사용량: 적산계 리셋/롤오버 가능성');
    });

    it('should set usage to null when gas values are missing', async () => {
      const createData = {
        chargeNo: '260601-003',
        furnaceId: 1,
        workDate: new Date('2026-06-01'),
        shift: 'day',
      };

      prismaMock.chargeEntry.create.mockResolvedValue({
        id: 3,
        ...createData,
        gasBefore: null,
        gasAfter: null,
        usage: null,
      });

      const result = await service.create(createData);

      expect(result.usage).toBeNull();
      expect(result.warnings).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update and recalculate usage', async () => {
      prismaMock.chargeEntry.findUnique.mockResolvedValue({
        id: 1,
        gasBefore: 1000,
        gasAfter: 1500,
        usage: 500,
      });

      prismaMock.chargeEntry.update.mockResolvedValue({
        id: 1,
        gasBefore: 1000,
        gasAfter: 2000,
        usage: 1000,
      });

      const result = await service.update(1, { gasAfter: 2000 });

      expect(result.usage).toBe(1000);
    });

    it('should throw NotFoundException for non-existent charge', async () => {
      prismaMock.chargeEntry.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { gasAfter: 2000 }))
        .rejects.toThrow('Charge not found');
    });
  });

  describe('getUsageSummary', () => {
    it('should include zero usage values in the summary', async () => {
      prismaMock.chargeEntry.findMany.mockResolvedValue([
        {
          furnaceId: 1,
          shift: 'day',
          usage: 0,
          furnace: { name: 'Furnace 1' },
        },
      ]);

      const result = await service.getUsageSummary();

      expect(result).toEqual([
        {
          furnaceId: 1,
          furnaceName: 'Furnace 1',
          shift: 'day',
          totalUsage: 0,
          chargeCount: 1,
        },
      ]);
    });
  });

  describe('extractDateFromChargeNo', () => {
    it('should extract date from charge number format YYMMDD-NNN', () => {
      const result = (service as any).extractDateFromChargeNo('260601-001');
      expect(result).toEqual(new Date(2026, 5, 1));
    });

    it('should throw for invalid format', () => {
      expect(() => (service as any).extractDateFromChargeNo('invalid'))
        .toThrow('Invalid date in charge number');
    });
  });

  describe('determineShift', () => {
    it('should return day for hours 8-18', () => {
      const workDate = new Date(2026, 5, 1, 12, 0);
      expect((service as any).determineShift(workDate)).toBe('day');
    });

    it('should return night for hours outside 8-18', () => {
      const workDate = new Date(2026, 5, 1, 21, 0);
      expect((service as any).determineShift(workDate)).toBe('night');
    });
  });

  describe('getShiftConfig', () => {
    it('should return day shift config', () => {
      const config = (service as any).getShiftConfig('day');
      expect(config).toEqual({
        startHour: 8,
        startMinute: 0,
        endHour: 19,
        endMinute: 30,
        crossesMidnight: false,
      });
    });

    it('should return night shift config', () => {
      const config = (service as any).getShiftConfig('night');
      expect(config).toEqual({
        startHour: 20,
        startMinute: 0,
        endHour: 7,
        endMinute: 0,
        crossesMidnight: true,
      });
    });

    it('should default to day config for unknown shift', () => {
      const config = (service as any).getShiftConfig('unknown');
      expect(config.crossesMidnight).toBe(false);
    });
  });
});
