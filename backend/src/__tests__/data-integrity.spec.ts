import { GasReadingService } from '../gas-reading/gas-reading.service';
import { ChargeService } from '../charge/charge.service';

describe('data integrity safeguards', () => {
  it('does not silently upload gas data to furnace 1 when furnace cannot be determined', async () => {
    const service = new GasReadingService({} as any);
    const file = {
      originalname: 'unknown.xlsx',
      buffer: Buffer.from(''),
      size: 0,
    } as Express.Multer.File;

    const result = await service.uploadSingleFile(file);

    expect(result.status).toBe('error');
    expect(result.error).toContain('호기');
  });

  it('keeps existing charge clears when gas fields are explicitly set to null', async () => {
    const prisma = {
      chargeEntry: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          chargeNo: '260610-001',
          furnaceId: 1,
          gasBefore: 100,
          gasAfter: 150,
          workDate: new Date('2026-06-10T00:00:00Z'),
          shift: 'day',
          note: null,
        }),
        update: jest.fn().mockResolvedValue({
          id: 1,
          gasBefore: null,
          gasAfter: null,
          usage: null,
        }),
      },
    };
    const service = new ChargeService(
      prisma as any,
      {} as any,
      { getShiftConfig: jest.fn().mockResolvedValue({
        dayStart: '08:00',
        dayEnd: '19:30',
        nightStart: '20:00',
        nightEnd: '07:00',
      }) } as any,
    );

    await service.update(1, { gasBefore: null, gasAfter: null });

    expect(prisma.chargeEntry.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        gasBefore: null,
        gasAfter: null,
        usage: null,
      }),
    }));
  });
});
