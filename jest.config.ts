import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const privateTmpPrefix = '/private/tmp/';

const privateTmpIgnorePattern = process.cwd().startsWith(privateTmpPrefix)
  ? `^${escapeRegExp(privateTmpPrefix)}(?!${escapeRegExp(
      process.cwd().slice(privateTmpPrefix.length),
    )}(?:/|$))`
  : `^${escapeRegExp(privateTmpPrefix)}`;

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/e2e/',
    '/playwright-report/',
    '<rootDir>/(?:.*\\/)?\\.worktrees/',
    privateTmpIgnorePattern,
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/(?:.*\\/)?\\.worktrees/',
    privateTmpIgnorePattern,
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
