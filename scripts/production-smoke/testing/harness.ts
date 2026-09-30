/**
 * Shared test harness for the production smoke runner.
 * Test-only: builds a config bound to an in-process app and no real network.
 */
import { createInProcessApp, type InProcessApp, type InProcessAppOptions } from './in-process-app';
import type { SmokeRunConfig } from '../types';

export const TEST_EMAIL = 'smoke-qa@atlas.example.test';
export const TEST_PASSWORD = 'SmokePass1';
export const TEST_QA_RUN_ID = 'a'.repeat(32);

export interface HarnessOptions {
  config?: Partial<SmokeRunConfig>;
  app?: InProcessAppOptions;
}

export interface Harness {
  app: InProcessApp;
  config: SmokeRunConfig;
}

export function makeConfig(overrides: Partial<SmokeRunConfig> = {}): SmokeRunConfig {
  const baseUrl = overrides.baseUrl ?? 'https://prod.example';
  return {
    baseUrl,
    expectedHost: new URL(baseUrl).host,
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    expectedReleaseSha: 'sha-abc',
    actualReleaseSha: 'sha-abc',
    deploymentId: 'deploy-1',
    deploymentEnvironment: 'Production',
    deploymentUrl: baseUrl,
    workflowRunId: 'workflow-run-1',
    qaRunId: TEST_QA_RUN_ID,
    evidencePath: null,
    manifestPath: null,
    recoveryOnly: false,
    crashWindowMs: 300_000,
    ...overrides,
  };
}

export function createHarness(options: HarnessOptions = {}): Harness {
  const app = createInProcessApp(options.app);
  return { app, config: makeConfig(options.config) };
}
