import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const DEFAULT_PORT = 54321;
const DEFAULT_USER = 'postgres';
const DEFAULT_PASSWORD = 'password';
const DEFAULT_DATABASE = 'taewoong_furnace';

let bootstrapPromise: Promise<void> | null = null;

function getDatabaseDir() {
  return path.resolve(process.cwd(), '..', 'work', 'embedded-postgres-54321');
}

function setPrismaEnv() {
  const connectionString = `postgresql://${DEFAULT_USER}:${DEFAULT_PASSWORD}@127.0.0.1:${DEFAULT_PORT}/${DEFAULT_DATABASE}?schema=taewoong_furnace`;
  process.env.DATABASE_URL = process.env.DATABASE_URL || connectionString;
  process.env.DIRECT_URL = process.env.DIRECT_URL || connectionString;
}

function isPortInUseError(error: unknown) {
  return error instanceof Error && /address already in use|port .* already in use/i.test(error.message);
}

async function ensureEmbeddedPostgresRunning() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const databaseDir = getDatabaseDir();
  const createCluster = () =>
    new EmbeddedPostgres({
    databaseDir,
    user: DEFAULT_USER,
    password: DEFAULT_PASSWORD,
    port: DEFAULT_PORT,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
    });

  const initialiseAndStart = async () => {
    const pg = createCluster();
    await pg.initialise();
    await pg.start();
  };

  if (existsSync(databaseDir)) {
    const entries = readdirSync(databaseDir);
    const hasInitializedCluster = entries.includes('PG_VERSION');
    if (!hasInitializedCluster && entries.length > 0) {
      rmSync(databaseDir, { recursive: true, force: true });
    }
  }
  if (!existsSync(databaseDir)) {
    mkdirSync(databaseDir, { recursive: true });
  }

  try {
    await initialiseAndStart();
  } catch (error) {
    if (isPortInUseError(error)) {
      return;
    }
    rmSync(databaseDir, { recursive: true, force: true });
    mkdirSync(databaseDir, { recursive: true });
    try {
      await initialiseAndStart();
    } catch (retryError) {
      if (!isPortInUseError(retryError)) {
        throw retryError;
      }
    }
  }
}

function runCommand(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: path.resolve(process.cwd(), '..'),
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

async function runMigrationsAndSeed() {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  runCommand(npx, ['prisma', 'migrate', 'deploy']);
  runCommand(npx, ['prisma', 'db', 'seed']);
}

export async function ensureLocalPostgres() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      setPrismaEnv();
      await ensureEmbeddedPostgresRunning();
      await runMigrationsAndSeed();
    })();
  }

  await bootstrapPromise;
}
