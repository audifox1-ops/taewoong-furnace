import { GasReadingService } from './gas-reading.service';

describe('GasReadingService', () => {
  let service: GasReadingService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      furnace: {
        findUnique: jest.fn(),
      },
      importBatch: {
        create: jest.fn(),
        update: jest.fn(),
      },
      gasReading: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    service = new GasReadingService(prismaMock);
  });

  it('parses furnace numbers written with full-width digits', () => {
    const result = service.parseFileName('가열로１９호기_가스(2026-06-01 ~ 2026-06-30).xlsx');

    expect(result.furnaceNo).toBe(19);
    expect(result.furnaceName).toBe('가열19호');
    expect(result.periodStart).toBe('2026-06-01');
    expect(result.periodEnd).toBe('2026-06-30');
  });

  it('does not fall back to furnace 1 when the furnace cannot be determined', async () => {
    const result = await service.uploadSingleFile({
      originalname: 'gas-data.xlsx',
      buffer: Buffer.from([]),
    } as Express.Multer.File);

    expect(result.status).toBe('error');
    expect(result.error).toContain('가열로 번호를 확인할 수 없습니다');
    expect(prismaMock.furnace.findUnique).not.toHaveBeenCalled();
  });
});
