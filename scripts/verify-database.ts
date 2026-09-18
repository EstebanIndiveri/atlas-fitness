import { inspectConfiguredDatabase } from '../lib/db/readiness';

async function main(): Promise<void> {
  try {
    const result = await inspectConfiguredDatabase();

    if (!result.ready) {
      console.error(`Database is missing required tables: ${result.missingTables.join(', ')}`);
      process.exitCode = 1;
      return;
    }

    console.log('Database schema is ready.');
  } catch {
    console.error('Database verification failed. Check the database connection and try again.');
    process.exitCode = 1;
  }
}

void main();
