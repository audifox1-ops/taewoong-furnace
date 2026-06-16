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
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      gasReading: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (operations: any[]) => Promise.all(operations)),
    };

    service = new GasReadingService(prismaMock);
  });

  it('parses furnace numbers from file names', () => {
    const result = service.parseFileName('가열17호기_(2026-06-01 ~ 2026-06-30).xlsx');

    expect(result.furnaceNo).toBe(17);
    expect(result.furnaceName).toBe('가열17호');
    expect(result.periodStart).toBe('2026-06-01');
    expect(result.periodEnd).toBe('2026-06-30');
  });

  it('does not fall back to furnace 1 when the furnace cannot be determined', async () => {
    const result = await service.uploadSingleFile({
      originalname: 'gas-data.xlsx',
      buffer: Buffer.from([]),
    } as Express.Multer.File);

    expect(result.status).toBe('error');
    expect(prismaMock.furnace.findUnique).not.toHaveBeenCalled();
  });

  it('deletes upload history together with linked gas readings', async () => {
    prismaMock.importBatch.findUnique.mockResolvedValue({
      id: 7,
      fileName: '가열17호기_(2026-06-01 ~ 2026-06-30).xlsx',
    });
    prismaMock.gasReading.deleteMany.mockResolvedValue({ count: 12 });
    prismaMock.importBatch.delete.mockResolvedValue({ id: 7 });

    const result = await service.deleteUploadHistory(7);

    expect(result).toEqual({
      deleted: true,
      batchId: 7,
      fileName: '가열17호기_(2026-06-01 ~ 2026-06-30).xlsx',
      deletedReadings: 12,
    });
    expect(prismaMock.importBatch.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      select: { id: true, fileName: true },
    });
    expect(prismaMock.gasReading.deleteMany).toHaveBeenCalledWith({
      where: { importBatchId: 7 },
    });
    expect(prismaMock.importBatch.delete).toHaveBeenCalledWith({
      where: { id: 7 },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
