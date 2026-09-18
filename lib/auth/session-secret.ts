export const LEGACY_PUBLIC_SESSION_SECRET = 'dev-secret-change-in-production';

const MIN_PRODUCTION_SECRET_LENGTH = 32;

const KNOWN_WEAK_SECRETS = new Set([
  LEGACY_PUBLIC_SESSION_SECRET,
  'local-dev-session-secret-change-me',
  'test-secret-for-ci-only-not-production',
  'change-me',
]);

export class MissingSessionSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingSessionSecretError';
  }
}

export function isWeakSessionSecret(secret: string): boolean {
  const trimmed = secret.trim();
  if (trimmed.length < MIN_PRODUCTION_SECRET_LENGTH) {
    return true;
  }
  if (KNOWN_WEAK_SECRETS.has(trimmed)) {
    return true;
  }
  if (/change-me/i.test(trimmed) || /dev-secret/i.test(trimmed)) {
    return true;
  }
  return false;
}

export function resolveSessionSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret = env.SESSION_SECRET?.trim() ?? '';
  const isProduction = env.NODE_ENV === 'production';

  if (!secret) {
    throw new MissingSessionSecretError(
      isProduction
        ? 'SESSION_SECRET es obligatorio en producción'
        : 'SESSION_SECRET es obligatorio. Definilo en .env (ver .env.example)',
    );
  }

  if (isProduction && isWeakSessionSecret(secret)) {
    throw new MissingSessionSecretError(
      'SESSION_SECRET es demasiado débil para producción',
    );
  }

  return secret;
}
