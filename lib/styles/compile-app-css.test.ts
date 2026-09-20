import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { cssContainsUtility, REQUIRED_APP_UTILITIES } from './required-utilities';

function compileAppCssInChildProcess(): string {
  const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const runner = path.join(process.cwd(), 'lib', 'styles', 'run-compile-app-css.ts');
  const result = spawnSync(process.execPath, [tsxCli, runner], {
    encoding: 'utf8',
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'compileAppCss failed');
  }

  return result.stdout;
}

describe('cssContainsUtility', () => {
  it('matches a generated class selector', () => {
    expect(cssContainsUtility('.bg-brand{background-color:#1f6b4a}', 'bg-brand')).toBe(
      true,
    );
  });

  it('does not match a missing utility', () => {
    expect(cssContainsUtility('.flex{display:flex}', 'bg-brand')).toBe(false);
  });
});

describe('Tailwind CSS entry', () => {
  const globalsCss = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');

  it('uses the v4 import instead of v3 @tailwind directives', () => {
    expect(globalsCss).toMatch(/@import\s+["']tailwindcss["']/);
    expect(globalsCss).not.toMatch(/@tailwind\s+base/);
    expect(globalsCss).not.toMatch(/@tailwind\s+components/);
    expect(globalsCss).not.toMatch(/@tailwind\s+utilities/);
  });
});

describe('compileAppCss', () => {
  it('emits utilities used on home, login, dashboard, workout, and InstallBanner', () => {
    const css = compileAppCssInChildProcess();

    expect(css.length).toBeGreaterThan(10_000);

    const missing = REQUIRED_APP_UTILITIES.filter(
      (utility) => !cssContainsUtility(css, utility),
    );
    expect(missing).toEqual([]);
  });
});
