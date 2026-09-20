import { describe, expect, it } from '@jest/globals';
import { mapRoutineHttpError, parseApiErrorBody } from './parse-error';
import { ROUTINE_COPY } from '@/lib/copy/routines';

describe('parseApiErrorBody', () => {
  it('reads typed { code, message } bodies', () => {
    expect(parseApiErrorBody({ code: 'NOT_FOUND', message: 'Rutina no encontrada' })).toEqual({
      code: 'NOT_FOUND',
      message: 'Rutina no encontrada',
    });
    expect(parseApiErrorBody({ code: 'WAT', message: 'x' })).toBeNull();
  });
});

describe('mapRoutineHttpError', () => {
  it('maps foreign GET 404 to the generic not-found copy', () => {
    const mapped = mapRoutineHttpError(
      404,
      { code: 'NOT_FOUND', message: 'Rutina no encontrada' },
      'GET',
    );
    expect(mapped.kind).toBe('not_found');
    expect(mapped.message).toBe(ROUTINE_COPY.notFound);
  });

  it('maps system mutate 403 without leaking ownership details', () => {
    const mapped = mapRoutineHttpError(
      403,
      { code: 'FORBIDDEN', message: 'No puedes modificar una rutina del sistema' },
      'PATCH',
    );
    expect(mapped.kind).toBe('forbidden');
    expect(mapped.message).toBe('No puedes modificar una rutina del sistema');
  });

  it('maps missing write methods to the documented BE gap', () => {
    expect(mapRoutineHttpError(405, null, 'POST')).toEqual({
      kind: 'write_unavailable',
      message: ROUTINE_COPY.errorWriteUnavailable,
    });
    expect(mapRoutineHttpError(404, null, 'PATCH')).toEqual({
      kind: 'write_unavailable',
      message: ROUTINE_COPY.errorWriteUnavailable,
    });
  });

  it('maps VALIDATION to the API message', () => {
    const mapped = mapRoutineHttpError(
      400,
      { code: 'VALIDATION', message: 'Datos de rutina inválidos' },
      'POST',
    );
    expect(mapped.kind).toBe('validation');
    expect(mapped.message).toBe('Datos de rutina inválidos');
  });
});
