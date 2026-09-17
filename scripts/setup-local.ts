import { setupLocal } from '../lib/dev/setup-local';

setupLocal(process.cwd())
  .then(() => {
    console.log('\nLocal setup complete. Next: npm run dev');
    console.log('Login: qa@atlas.test / Test1234!');
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Local setup failed:', error);
    process.exit(1);
  });
