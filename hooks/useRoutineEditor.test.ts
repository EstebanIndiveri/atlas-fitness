/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import { useRoutineEditor } from './useRoutineEditor';
import { ROUTINE_COPY } from '@/lib/copy/routines';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useRoutineEditor', () => {
  it('maps a GET 404 to notFound without using a distinct foreign-user message', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/exercises')) {
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ code: 'NOT_FOUND', message: 'Rutina no encontrada' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    });

    const { result } = renderHook(() => useRoutineEditor('edit', 77));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notFound).toBe(true);
    expect(result.current.error).toBeNull();
    expect(ROUTINE_COPY.notFound).toBe('Rutina no encontrada');
  });
});
