import { spawn } from 'node:child_process';

import {
  bootstrapRemoteDatabase,
  type RemoteBootstrapScript,
} from '../lib/dev/bootstrap-remote';
import { loadLocalEnv } from '../lib/dev/load-local-env';

function runNpmScript(script: RemoteBootstrapScript): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', script], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`npm run ${script} failed with exit code ${code ?? 'null'}`));
    });
  });
}

async function main(): Promise<void> {
  loadLocalEnv();

  await bootstrapRemoteDatabase(process.env, runNpmScript);
  console.log('Remote database bootstrap completed.');
}

void main().catch((error: unknown) => {
  console.error('Remote database bootstrap failed:', error);
  process.exitCode = 1;
});
