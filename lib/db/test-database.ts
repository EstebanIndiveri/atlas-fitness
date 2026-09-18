import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export {
  assertSafeTestDatabaseUrl,
  isJestRuntime,
  isUnsafeTestDatabaseUrl,
  resolveDatabaseUrl,
} from './database-url';

export function createIsolatedTestDatabaseUrl(
  workerId: string = process.env.JEST_WORKER_ID ?? '0',
): string {
  const dir = mkdtempSync(join(tmpdir(), `atlas-jest-${workerId}-`));
  return `file:${join(dir, 'test.db')}`;
}
