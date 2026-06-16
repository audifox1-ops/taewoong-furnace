import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import net from 'net';

const DEFAULT_USER = 'postgres';
const DEFAULT_PASSWORD = 'password';
const DEFAULT_DATABASE = 'taewoong_furnace';

let bootstrapPromise: Promise<void> | null = null;

function getDatabaseDir() {
  const baseDir = path.resolve(process.cwd(), '..', 'work', 'embedded-postgres-54321');
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, `cluster-${randomUUID()}`);
}

async function getFreePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Unable to allocate a free port')));
        return;
      }
      const port = address.port;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}

function setPrismaEnv(port: number) {
  const connectionString = `postgresql://${DEFAULT_USER}:${DEFAULT_PASSWORD}@127.0.0.1:${port}/${DEFAULT_DATABASE}?schema=taewoong_furnace`;
  process.env.DATABASE_URL = connectionString;
  process.env.DIRECT_URL = connectionString;
}

function isPortInUseError(error: unknown) {
  return error instanceof Error && /address already in use|port .* already in use/i.test(error.message);
}

async function ensureEmbeddedPostgresRunning(port: number) {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const databaseDir = getDatabaseDir();
  const createCluster = () =>
    new EmbeddedPostgres({
      databaseDir,
      user: DEFAULT_USER,
      password: DEFAULT_PASSWORD,
      port,
      persistent: true,
      initdbFlags: ['--encoding=UTF8', '--locale=C'],
      postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
    });

  const initialiseAndStart = async () => {
    const pg = createCluster();
    await pg.initialise();
    await pg.start();
    await pg.createDatabase(DEFAULT_DATABASE);
  };

  try {
    await initialiseAndStart();
  } catch (error) {
    if (isPortInUseError(error)) {
      return;
    }
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
  const prismaBin = process.platform === 'win32'
    ? path.resolve(process.cwd(), 'node_modules', '.bin', 'prisma.cmd')
    : path.resolve(process.cwd(), 'node_modules', '.bin', 'prisma');
  runCommand(prismaBin, ['migrate', 'deploy']);
  runCommand(prismaBin, ['db', 'seed']);
}

export async function ensureLocalPostgres() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const port = await getFreePort();
      setPrismaEnv(port);
      await ensureEmbeddedPostgresRunning(port);
      await runMigrationsAndSeed();
    })();
  }

  await bootstrapPromise;
}
