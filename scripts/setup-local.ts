import { setupLocal } from '../lib/dev/setup-local';

setupLocal(process.cwd())
  .then(() => {
    console.log('\nLocal setup complete. Next: npm run dev');
    console.log('QA user seeded successfully.');
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Local setup failed:', error);
    process.exit(1);
  });
