import { GasReadingService } from './gas-reading.service';

describe('GasReadingService furnace fix helpers', () => {
  let service: GasReadingService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      importBatch: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      gasReading: {
        updateMany: jest.fn(),
      },
      furnace: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    service = new GasReadingService(prismaMock);
  });

  it('lists furnace correction candidates when the filename target differs from current furnace', async () => {
    prismaMock.importBatch.findMany.mockResolvedValue([
      {
        id: 1,
        fileName: '가열로19호기_가스_(2026-06-01 ~ 2026-06-02).xlsx',
        furnace: { no: 1, name: '가열1호' },
        furnaceId: 1,
        rowCount: 10,
        gasReadings: [{ ts: new Date('2026-06-01T00:00:00Z') }, { ts: new Date('2026-06-01T00:01:00Z') }],
      },
    ]);

    const result = await service.listFurnaceFixCandidates(1);

    expect(result).toEqual([
      expect.objectContaining({
        batchId: 1,
        currentFurnaceNo: 1,
        targetFurnaceNo: 19,
      }),
    ]);
  });

  it('applies furnace correction to a batch', async () => {
    prismaMock.importBatch.findUnique.mockResolvedValue({
      id: 1,
      fileName: '가열로19호기_가스_(2026-06-01 ~ 2026-06-02).xlsx',
      furnace: { no: 1, name: '가열1호' },
      rowCount: 10,
      gasReadings: [{ id: 11, ts: new Date('2026-06-01T00:00:00Z') }],
    });
    prismaMock.furnace.findUnique.mockResolvedValue({ id: 19, no: 19, name: '가열19호' });

    const result = await service.applyFurnaceFix(1, 1);

    expect(result.updated).toBe(true);
    expect(prismaMock.importBatch.update).toHaveBeenCalled();
    expect(prismaMock.gasReading.updateMany).toHaveBeenCalled();
  });
});
