/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import { useRoutineEditor } from './useRoutineEditor';
import { ROUTINE_COPY } from '@/lib/copy/routines';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('useRoutineEditor', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps a GET 404 to notFound without using a distinct foreign-user message', async () => {
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/api/exercises')) {
        return jsonResponse([]);
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Rutina no encontrada' }, 404);
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useRoutineEditor('edit', 77));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notFound).toBe(true);
    expect(result.current.error).toBeNull();
    expect(ROUTINE_COPY.notFound).toBe('Rutina no encontrada');
  });
});
