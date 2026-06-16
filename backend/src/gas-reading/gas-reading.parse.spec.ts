import { GasReadingService } from './gas-reading.service';

describe('GasReadingService.parseFileName', () => {
  const service = new GasReadingService({} as any);

  it('extracts furnace numbers from files that only include the hoogi suffix', () => {
    const result = service.parseFileName('17호기_가스_(2026-06-01 ~ 2026-06-30).xlsx');

    expect(result.furnaceNo).toBe(17);
    expect(result.furnaceName).toBe('가열17호');
    expect(result.periodStart).toBe('2026-06-01');
    expect(result.periodEnd).toBe('2026-06-30');
  });

  it('extracts furnace numbers from the longer 가열로 form', () => {
    const result = service.parseFileName('가열로19호기_가스_(2026-06-01 ~ 2026-06-30).xlsx');

    expect(result.furnaceNo).toBe(19);
    expect(result.furnaceName).toBe('가열19호');
  });

  it('handles full-width digits in filenames', () => {
    const result = service.parseFileName('가열로１９호기_가스_(2026-06-01 ~ 2026-06-30).xlsx');

    expect(result.furnaceNo).toBe(19);
    expect(result.furnaceName).toBe('가열19호');
  });
});
