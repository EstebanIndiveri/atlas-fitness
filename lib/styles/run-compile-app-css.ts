import { compileAppCss } from './compile-app-css';

compileAppCss()
  .then((css) => {
    process.stdout.write(css);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
