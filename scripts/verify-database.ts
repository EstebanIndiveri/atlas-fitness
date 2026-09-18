import { inspectConfiguredDatabase } from '../lib/db/readiness';

async function main(): Promise<void> {
  try {
    const result = await inspectConfiguredDatabase();

    if (!result.ready) {
      const issues = [
        result.missingTables.length > 0
          ? `missing tables: ${result.missingTables.join(', ')}`
          : null,
        result.missingColumns.length > 0
          ? `missing columns: ${result.missingColumns.join(', ')}`
          : null,
        result.missingIndexes.length > 0
          ? `missing or invalid indexes: ${result.missingIndexes.join(', ')}`
          : null,
      ].filter((issue): issue is string => issue !== null);

      console.error(`Database schema is not ready (${issues.join('; ')}).`);
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
