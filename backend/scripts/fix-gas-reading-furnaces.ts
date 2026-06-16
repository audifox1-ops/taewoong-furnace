import { PrismaClient } from '@prisma/client';

type BatchCandidate = {
  id: number;
  fileName: string;
  furnaceId: number | null;
  furnace: { no: number; name: string } | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  gasReadings: Array<{ id: number; ts: Date }>;
};

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(current.slice(2), next);
      i++;
    } else {
      args.set(current.slice(2), true);
    }
  }
  return args;
}

function normalizeDigits(value: string) {
  return value
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 0xff10 && code <= 0xff19) {
        return String(code - 0xff10);
      }
      return ch;
    })
    .join('');
}

function parseFurnaceNo(fileName: string) {
  const base = normalizeDigits(fileName.replace(/\.(xlsx|xls|csv)$/i, ''));
  const match = base.match(/(?:가열\s*로?)?\s*(\d+)\s*호(?:기)?/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.has('help') || args.has('h')) {
    console.log(
      [
        'Usage: npm run fix:gas-furnace -- [--apply] [--batch-id <id>] [--current <no>] [--target <no>]',
        '',
        'Defaults:',
        '  --current 1',
        '  --dry-run unless --apply is set',
        '',
        'Examples:',
        '  npm run fix:gas-furnace -- --help',
        '  npm run fix:gas-furnace -- --batch-id 123',
        '  npm run fix:gas-furnace -- --batch-id 123 --apply',
        '  npm run fix:gas-furnace -- --current 1 --target 19 --apply',
      ].join('\n'),
    );
    return;
  }

  const apply = args.has('apply');
  const batchIdArg = args.get('batch-id');
  const currentArg = args.get('current');
  const targetArg = args.get('target');

  const batchId = typeof batchIdArg === 'string' ? Number.parseInt(batchIdArg, 10) : null;
  const currentNo = typeof currentArg === 'string' ? Number.parseInt(currentArg, 10) : 1;
  const targetNo = typeof targetArg === 'string' ? Number.parseInt(targetArg, 10) : null;

  if (batchIdArg && Number.isNaN(batchId!)) {
    throw new Error('Invalid --batch-id value');
  }
  if (currentArg && Number.isNaN(currentNo)) {
    throw new Error('Invalid --current value');
  }
  if (targetArg && Number.isNaN(targetNo!)) {
    throw new Error('Invalid --target value');
  }

  const batches = await prisma.importBatch.findMany({
    where: batchId ? { id: batchId } : {},
    include: { furnace: true, gasReadings: { select: { id: true, ts: true } } },
    orderBy: { createdAt: 'desc' },
  }) as BatchCandidate[];

  const candidates = batches
    .map((batch) => {
      const parsedFurnaceNo = parseFurnaceNo(batch.fileName);
      return { batch, parsedFurnaceNo };
    })
    .filter(({ batch, parsedFurnaceNo }) => {
      if (parsedFurnaceNo == null) return false;
      if (targetNo != null && parsedFurnaceNo !== targetNo) return false;
      const storedNo = batch.furnace?.no ?? batch.furnaceId ?? null;
      return storedNo === currentNo && parsedFurnaceNo !== storedNo;
    });

  if (candidates.length === 0) {
    console.log('No matching batches found.');
    return;
  }

  console.log(apply ? 'Applying furnace corrections...' : 'Dry run only. Use --apply to persist changes.');

  for (const { batch, parsedFurnaceNo } of candidates) {
    const targetFurnace = await prisma.furnace.findUnique({
      where: { no: parsedFurnaceNo! },
    });

    if (!targetFurnace) {
      console.log(`- batch ${batch.id}: target furnace ${parsedFurnaceNo} not found`);
      continue;
    }

    const timestamps = batch.gasReadings.map((reading: { id: number; ts: Date }) => reading.ts);
    if (timestamps.length === 0) {
      console.log(`- batch ${batch.id}: no gas readings linked`);
      continue;
    }

    const minTs = new Date(Math.min(...timestamps.map((ts) => ts.getTime())));
    const maxTs = new Date(Math.max(...timestamps.map((ts) => ts.getTime())));
    const conflictingReadings = await prisma.gasReading.findMany({
      where: {
        furnaceId: targetFurnace.id,
        ts: { gte: minTs, lte: maxTs },
      },
      select: { id: true, ts: true },
    });

    const batchTs = new Set(batch.gasReadings.map((reading: { id: number; ts: Date }) => reading.ts.toISOString()));
    const conflicts = conflictingReadings.filter((reading: { id: number; ts: Date }) => !batchTs.has(reading.ts.toISOString()));

    if (conflicts.length > 0) {
      console.log(
        `- batch ${batch.id}: skipped because ${conflicts.length} target-timestamp conflicts exist for furnace ${targetFurnace.no}`,
      );
      continue;
    }

    console.log(
      `- batch ${batch.id}: ${batch.furnace?.no ?? batch.furnaceId ?? 'unknown'} -> ${targetFurnace.no} (${batch.fileName})`,
    );

    if (!apply) continue;

    await prisma.$transaction([
      prisma.importBatch.update({
        where: { id: batch.id },
        data: { furnaceId: targetFurnace.id },
      }),
      prisma.gasReading.updateMany({
        where: { importBatchId: batch.id },
        data: { furnaceId: targetFurnace.id },
      }),
    ]);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
