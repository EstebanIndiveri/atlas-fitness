/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handleApiError } from './middleware';
import { AppError } from '@/types/errors';

describe('handleApiError', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    jest.restoreAllMocks();
  });

  it('returns HTTP 503 for nested missing-table errors without leaking schema details', async () => {
    const error = new Error('Query failed', {
      cause: new Error('SQLite error: no such table: users'),
    });

    const response = handleApiError(error);
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(503);
    expect(body).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Servicio temporalmente no disponible',
    });
    expect(JSON.stringify(body)).not.toContain('no such table');
    expect(console.error).toHaveBeenCalledWith(
      'Database schema unavailable; returning sanitized 503 response.',
    );
  });

  it('keeps AppError UNAUTHORIZED as HTTP 401', async () => {
    const response = handleApiError(new AppError('UNAUTHORIZED', 'Authentication required'));
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(401);
    expect(body).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  });

  it('returns generic HTTP 500 for unrelated errors', async () => {
    const response = handleApiError(new Error('boom'));
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(500);
    expect(body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
});
