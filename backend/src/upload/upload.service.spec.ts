import { ConflictException, NotFoundException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UploadService', () => {
  let service: UploadService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      chargeScan: {
        findUnique: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const configServiceMock = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const values: Record<string, string> = {
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
          SUPABASE_STORAGE_BUCKET: 'taewoong-furnace',
        };
        return values[key] ?? defaultValue ?? '';
      }),
    };

    service = new UploadService(prismaMock as PrismaService, configServiceMock as any);
    (service as any).supabase = {
      storage: {
        listBuckets: jest.fn().mockResolvedValue({ data: [], error: null }),
        createBucket: jest.fn().mockResolvedValue({ error: null }),
        from: jest.fn().mockReturnValue({
          remove: jest.fn().mockResolvedValue({ error: null }),
          upload: jest.fn(),
          createSignedUrl: jest.fn(),
        }),
      },
    };
  });

  it('blocks scan deletion when linked charge records exist', async () => {
    prismaMock.chargeScan.findUnique.mockResolvedValue({
      id: 1,
      fileUrl: 'scan.pdf',
      _count: { chargeRecords: 2 },
    });

    await expect(service.deleteScan(1)).rejects.toThrow(ConflictException);
    expect(prismaMock.chargeScan.delete).not.toHaveBeenCalled();
  });

  it('deletes scan when no charge records are linked', async () => {
    prismaMock.chargeScan.findUnique.mockResolvedValue({
      id: 1,
      fileUrl: 'scan.pdf',
      _count: { chargeRecords: 0 },
    });

    const result = await service.deleteScan(1);

    expect(result).toEqual({ deleted: true });
    expect(prismaMock.chargeScan.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('throws NotFoundException when scan does not exist', async () => {
    prismaMock.chargeScan.findUnique.mockResolvedValue(null);

    await expect(service.deleteScan(1)).rejects.toThrow(NotFoundException);
  });
});
