/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { SMOKE_ENV_KEYS } from './constants';
import { loadSmokeConfig } from './config';

const deterministic = (size: number): Uint8Array =>
  Uint8Array.from({ length: size }, (_, index) => index);

function validEnv(): Record<string, string> {
  return {
    [SMOKE_ENV_KEYS.baseUrl]: 'https://atlas.example.com/',
    [SMOKE_ENV_KEYS.email]: 'smoke-qa@atlas.example.com',
    [SMOKE_ENV_KEYS.password]: 'SuperSecret1',
    [SMOKE_ENV_KEYS.expectedReleaseSha]: 'abc123',
    [SMOKE_ENV_KEYS.actualReleaseSha]: 'abc123',
  };
}

describe('loadSmokeConfig', () => {
  it('loads a valid configuration and normalizes the base URL', () => {
    const result = loadSmokeConfig(validEnv(), { randomBytes: deterministic });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.config.baseUrl).toBe('https://atlas.example.com');
    expect(result.config.expectedHost).toBe('atlas.example.com');
    expect(result.config.qaRunId).toBe('000102030405060708090a0b0c0d0e0f');
    expect(result.config.recoveryOnly).toBe(false);
  });

  it('accepts a valid qaRunId override and recovery-only flag', () => {
    const env = validEnv();
    env[SMOKE_ENV_KEYS.qaRunId] = 'a'.repeat(32);
    env[SMOKE_ENV_KEYS.recoveryOnly] = 'true';
    const result = loadSmokeConfig(env, { randomBytes: deterministic });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.config.qaRunId).toBe('a'.repeat(32));
    expect(result.config.recoveryOnly).toBe(true);
  });

  it('defaults the manifest path alongside the evidence file', () => {
    const env = validEnv();
    env[SMOKE_ENV_KEYS.evidencePath] = '/tmp/evidence.json';
    const result = loadSmokeConfig(env, { randomBytes: deterministic });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.config.manifestPath).toBe('/tmp/evidence.json.manifest.json');
  });

  it('honours an explicit manifest path and leaves it null without evidence', () => {
    const env = validEnv();
    env[SMOKE_ENV_KEYS.manifestPath] = '/tmp/manifest.json';
    const withPath = loadSmokeConfig(env, { randomBytes: deterministic });
    expect(withPath.ok && withPath.config.manifestPath).toBe('/tmp/manifest.json');

    const noEvidence = loadSmokeConfig(validEnv(), { randomBytes: deterministic });
    expect(noEvidence.ok && noEvidence.config.manifestPath).toBeNull();
  });

  it.each([
    ['baseUrl', SMOKE_ENV_KEYS.baseUrl],
    ['email', SMOKE_ENV_KEYS.email],
    ['password', SMOKE_ENV_KEYS.password],
    ['expectedReleaseSha', SMOKE_ENV_KEYS.expectedReleaseSha],
    ['actualReleaseSha', SMOKE_ENV_KEYS.actualReleaseSha],
  ])('fails INCOMPLETE when %s is missing', (_label, key) => {
    const env = validEnv();
    delete env[key];
    const result = loadSmokeConfig(env, { randomBytes: deterministic });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.missing).toContain(key);
  });

  it('never includes a secret value in the failure message', () => {
    const env = validEnv();
    delete env[SMOKE_ENV_KEYS.password];
    const result = loadSmokeConfig(env, { randomBytes: deterministic });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.message).not.toContain('SuperSecret1');
    expect(result.message).toContain(SMOKE_ENV_KEYS.password);
  });

  it('rejects an invalid qaRunId override', () => {
    const env = validEnv();
    env[SMOKE_ENV_KEYS.qaRunId] = 'not-hex';
    const result = loadSmokeConfig(env, { randomBytes: deterministic });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.missing).toContain(SMOKE_ENV_KEYS.qaRunId);
  });

  it('rejects a non-http deployment URL', () => {
    const env = validEnv();
    env[SMOKE_ENV_KEYS.deploymentUrl] = 'ftp://atlas.example.com';
    const result = loadSmokeConfig(env, { randomBytes: deterministic });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.missing).toContain(SMOKE_ENV_KEYS.deploymentUrl);
  });
});
