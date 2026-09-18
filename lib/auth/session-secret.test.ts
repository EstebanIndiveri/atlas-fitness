import { describe, expect, it } from '@jest/globals';
import {
  LEGACY_PUBLIC_SESSION_SECRET,
  MissingSessionSecretError,
  isWeakSessionSecret,
  resolveSessionSecret,
} from './session-secret';

const STRONG_SECRET = '9f3a7c1e5b8d2a4c6e0f1b3d5a7c9e2f4b6d8a0c2e4f6a8b0d1c3e5f7a9b2d4c';

describe('resolveSessionSecret', () => {
  it('fails closed in production when SESSION_SECRET is missing', () => {
    expect(() => resolveSessionSecret({ NODE_ENV: 'production' })).toThrow(
      MissingSessionSecretError,
    );
    expect(() =>
      resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: '' }),
    ).toThrow('SESSION_SECRET es obligatorio en producción');
  });

  it('rejects the legacy public fallback and other weak secrets in production', () => {
    expect(isWeakSessionSecret(LEGACY_PUBLIC_SESSION_SECRET)).toBe(true);
    expect(() =>
      resolveSessionSecret({
        NODE_ENV: 'production',
        SESSION_SECRET: LEGACY_PUBLIC_SESSION_SECRET,
      }),
    ).toThrow('SESSION_SECRET es demasiado débil para producción');
    expect(() =>
      resolveSessionSecret({
        NODE_ENV: 'production',
        SESSION_SECRET: 'local-dev-session-secret-change-me',
      }),
    ).toThrow(MissingSessionSecretError);
    expect(() =>
      resolveSessionSecret({
        NODE_ENV: 'production',
        SESSION_SECRET: 'short',
      }),
    ).toThrow(MissingSessionSecretError);
  });

  it('accepts an explicit strong secret in production', () => {
    expect(
      resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: STRONG_SECRET }),
    ).toBe(STRONG_SECRET);
  });

  it('fails closed in development when SESSION_SECRET is missing (no public fallback)', () => {
    expect(() => resolveSessionSecret({ NODE_ENV: 'development' })).toThrow(
      'SESSION_SECRET es obligatorio. Definilo en .env (ver .env.example)',
    );
  });

  it('allows an explicit local placeholder outside production', () => {
    expect(
      resolveSessionSecret({
        NODE_ENV: 'development',
        SESSION_SECRET: 'local-dev-session-secret-change-me',
      }),
    ).toBe('local-dev-session-secret-change-me');
  });
});
