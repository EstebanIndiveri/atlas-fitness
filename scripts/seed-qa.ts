process.env.SEED_QA_USER = 'true';

import('../lib/db/seed').catch((error: unknown) => {
  console.error('QA seed failed:', error);
  process.exit(1);
});
