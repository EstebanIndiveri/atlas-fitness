import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_LOCAL_BUSY_TIMEOUT_MS,
  LOCAL_BUSY_TIMEOUT_ENV_KEY,
  MAX_LOCAL_BUSY_TIMEOUT_MS,
  isLocalFileDatabaseUrl,
  resolveAppLibsqlClientConfig,
  resolveLibsqlClientConfig,
  resolveLocalBusyTimeoutMs,
} from './client-config';

const LOCAL_URL = 'file:./local.db';
const REMOTE_URL = 'libsql://atlas-fitness.turso.io';

const REMOTE_URLS = [
  'libsql://atlas-fitness.turso.io',
  'https://atlas-fitness.turso.io',
  'http://127.0.0.1:8080',
  'wss://atlas-fitness.turso.io',
];

describe('isLocalFileDatabaseUrl', () => {
  it('accepts local file databases', () => {
    expect(isLocalFileDatabaseUrl('file:./local.db')).toBe(true);
    expect(isLocalFileDatabaseUrl('file:/tmp/atlas-jest-1/test.db')).toBe(true);
    expect(isLocalFileDatabaseUrl('  FILE:./local.db  ')).toBe(true);
    expect(isLocalFileDatabaseUrl('file::memory:')).toBe(true);
  });

  it('accepts bare :memory: like the libsql client does', () => {
    expect(isLocalFileDatabaseUrl(':memory:')).toBe(true);
  });

  it('rejects remote and blank URLs', () => {
    for (const url of REMOTE_URLS) {
      expect(isLocalFileDatabaseUrl(url)).toBe(false);
    }
    expect(isLocalFileDatabaseUrl('')).toBe(false);
    expect(isLocalFileDatabaseUrl('   ')).toBe(false);
  });
});

describe('resolveLocalBusyTimeoutMs', () => {
  it('applies the default busy timeout to local file databases', () => {
    expect(resolveLocalBusyTimeoutMs(LOCAL_URL, {})).toBe(DEFAULT_LOCAL_BUSY_TIMEOUT_MS);
    expect(DEFAULT_LOCAL_BUSY_TIMEOUT_MS).toBeGreaterThanOrEqual(1000);
  });

  it('leaves remote databases untouched because Turso ignores the option', () => {
    for (const url of REMOTE_URLS) {
      expect(resolveLocalBusyTimeoutMs(url, {})).toBeUndefined();
      expect(resolveLocalBusyTimeoutMs(url, { [LOCAL_BUSY_TIMEOUT_ENV_KEY]: '9000' })).toBeUndefined();
    }
  });

  it('leaves blank URLs untouched', () => {
    expect(resolveLocalBusyTimeoutMs('', {})).toBeUndefined();
    expect(resolveLocalBusyTimeoutMs('   ', {})).toBeUndefined();
  });

  it('honours a positive integer override', () => {
    expect(resolveLocalBusyTimeoutMs(LOCAL_URL, { [LOCAL_BUSY_TIMEOUT_ENV_KEY]: '750' })).toBe(750);
    expect(resolveLocalBusyTimeoutMs(LOCAL_URL, { [LOCAL_BUSY_TIMEOUT_ENV_KEY]: ' 1200 ' })).toBe(
      1200,
    );
  });

  it('falls back to the default for values that are not plain decimal integers', () => {
    const invalid = [
      '',
      '   ',
      'abc',
      '0',
      '-1',
      '2.5',
      '12abc',
      '1_000',
      '+50',
      '1e3',
      '0x10',
      '0b101',
      'NaN',
      'Infinity',
    ];

    for (const value of invalid) {
      expect(resolveLocalBusyTimeoutMs(LOCAL_URL, { [LOCAL_BUSY_TIMEOUT_ENV_KEY]: value })).toBe(
        DEFAULT_LOCAL_BUSY_TIMEOUT_MS,
      );
    }
  });

  it('clamps overrides above the maximum instead of shrinking them to the default', () => {
    for (const value of [`${MAX_LOCAL_BUSY_TIMEOUT_MS + 1}`, '600000']) {
      expect(resolveLocalBusyTimeoutMs(LOCAL_URL, { [LOCAL_BUSY_TIMEOUT_ENV_KEY]: value })).toBe(
        MAX_LOCAL_BUSY_TIMEOUT_MS,
      );
    }
  });

  it('accepts the maximum allowed override', () => {
    expect(
      resolveLocalBusyTimeoutMs(LOCAL_URL, {
        [LOCAL_BUSY_TIMEOUT_ENV_KEY]: `${MAX_LOCAL_BUSY_TIMEOUT_MS}`,
      }),
    ).toBe(MAX_LOCAL_BUSY_TIMEOUT_MS);
  });

  it('reads the real environment by default', () => {
    const previous = process.env[LOCAL_BUSY_TIMEOUT_ENV_KEY];
    process.env[LOCAL_BUSY_TIMEOUT_ENV_KEY] = '2345';

    try {
      expect(resolveLocalBusyTimeoutMs(LOCAL_URL)).toBe(2345);
    } finally {
      if (previous === undefined) {
        delete process.env[LOCAL_BUSY_TIMEOUT_ENV_KEY];
      } else {
        process.env[LOCAL_BUSY_TIMEOUT_ENV_KEY] = previous;
      }
    }
  });
});

describe('resolveLibsqlClientConfig', () => {
  it('adds the busy timeout to local file databases', () => {
    expect(resolveLibsqlClientConfig(LOCAL_URL, undefined, {})).toEqual({
      url: LOCAL_URL,
      timeout: DEFAULT_LOCAL_BUSY_TIMEOUT_MS,
    });
  });

  it('keeps remote configs free of the timeout key', () => {
    const config = resolveLibsqlClientConfig(REMOTE_URL, 'token-123', {});

    expect(config).toEqual({ url: REMOTE_URL, authToken: 'token-123' });
    expect('timeout' in config).toBe(false);
  });

  it('omits an empty auth token', () => {
    expect('authToken' in resolveLibsqlClientConfig(LOCAL_URL, '', {})).toBe(false);
  });

  it('honours the environment override for local file databases', () => {
    expect(
      resolveLibsqlClientConfig(LOCAL_URL, undefined, { [LOCAL_BUSY_TIMEOUT_ENV_KEY]: '1500' }),
    ).toEqual({ url: LOCAL_URL, timeout: 1500 });
  });
});

describe('resolveAppLibsqlClientConfig', () => {
  const APP_URL = 'file:/tmp/atlas-app-wiring.db';

  it('builds the local config from the configured database url', () => {
    expect(resolveAppLibsqlClientConfig({ TURSO_DATABASE_URL: APP_URL })).toEqual({
      url: APP_URL,
      timeout: DEFAULT_LOCAL_BUSY_TIMEOUT_MS,
    });
  });

  it('keeps a remote database free of the local busy timeout', () => {
    const config = resolveAppLibsqlClientConfig({
      TURSO_DATABASE_URL: REMOTE_URL,
      TURSO_AUTH_TOKEN: 'token-123',
    });

    expect(config).toEqual({ url: REMOTE_URL, authToken: 'token-123' });
    expect('timeout' in config).toBe(false);
  });

  it('falls back to the local file database when the environment is empty', () => {
    expect(resolveAppLibsqlClientConfig({})).toEqual({
      url: 'file:./local.db',
      timeout: DEFAULT_LOCAL_BUSY_TIMEOUT_MS,
    });
  });

  it('honours the busy timeout override', () => {
    expect(
      resolveAppLibsqlClientConfig({
        TURSO_DATABASE_URL: APP_URL,
        [LOCAL_BUSY_TIMEOUT_ENV_KEY]: '1500',
      }),
    ).toEqual({ url: APP_URL, timeout: 1500 });
  });

  it('ignores an empty auth token', () => {
    expect('authToken' in resolveAppLibsqlClientConfig({ TURSO_AUTH_TOKEN: '' })).toBe(false);
  });
});
