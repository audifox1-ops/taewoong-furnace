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
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      gasReading: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(async (operations: any[]) => Promise.all(operations)),
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

  it('deletes upload history and its gas readings', async () => {
    prismaMock.importBatch.findFirst.mockResolvedValue({ id: 12 });
    prismaMock.importBatch.delete.mockResolvedValue({ id: 12 });
    prismaMock.gasReading.deleteMany.mockResolvedValue({ count: 3 });

    await expect(service.deleteUploadHistory(12)).resolves.toEqual({ deleted: true });

    expect(prismaMock.gasReading.deleteMany).toHaveBeenCalledWith({
      where: { importBatchId: 12 },
    });
    expect(prismaMock.importBatch.delete).toHaveBeenCalledWith({
      where: { id: 12 },
    });
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});
