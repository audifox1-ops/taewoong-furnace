import { spawnSync } from 'child_process';

let bootstrapPromise: Promise<void> | null = null;

function runCommand(command: string, args: string[]) {
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/c', command, ...args], {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: false,
        env: process.env,
      })
    : spawnSync(command, args, {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: false,
        env: process.env,
      });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

async function runMigrationsAndSeed() {
  const prismaBin = process.platform === 'win32' ? 'node_modules\\.bin\\prisma.cmd' : 'node_modules/.bin/prisma';
  const tsNodeBin = process.platform === 'win32' ? 'node_modules\\.bin\\ts-node.cmd' : 'node_modules/.bin/ts-node';
  runCommand(prismaBin, ['migrate', 'deploy']);
  runCommand(tsNodeBin, ['prisma/seed.ts']);
}

export async function ensureLocalPostgres() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = runMigrationsAndSeed();
  }

  await bootstrapPromise;
}
