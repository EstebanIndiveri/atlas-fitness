import { ROUTINE_COPY } from '@/lib/copy/routines';
import type { ApiError, ErrorCode } from '@/types/errors';

export type RoutineErrorKind =
  | 'not_found'
  | 'forbidden'
  | 'validation'
  | 'write_unavailable'
  | 'unauthorized'
  | 'generic';

export type MappedRoutineError = {
  kind: RoutineErrorKind;
  message: string;
};

const ERROR_CODES: readonly ErrorCode[] = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION',
  'CONFLICT',
  'RATE_LIMIT',
  'SERVICE_UNAVAILABLE',
];

export function parseApiErrorBody(body: unknown): ApiError | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  if (typeof record.code !== 'string' || typeof record.message !== 'string') {
    return null;
  }
  if (!ERROR_CODES.includes(record.code as ErrorCode)) {
    return null;
  }
  return { code: record.code as ErrorCode, message: record.message };
}

function isWriteMethod(method: string): boolean {
  return method === 'POST' || method === 'PATCH' || method === 'DELETE';
}

export function mapRoutineHttpError(
  status: number,
  body: unknown,
  method: string,
): MappedRoutineError {
  const api = parseApiErrorBody(body);

  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return { kind: 'unauthorized', message: ROUTINE_COPY.errorUnauthorized };
  }

  if (status === 403 || api?.code === 'FORBIDDEN') {
    return { kind: 'forbidden', message: api?.message || ROUTINE_COPY.errorForbidden };
  }

  if (status === 400 || api?.code === 'VALIDATION') {
    return { kind: 'validation', message: api?.message || ROUTINE_COPY.errorValidation };
  }

  if (status === 409 || api?.code === 'CONFLICT') {
    return { kind: 'validation', message: api?.message || ROUTINE_COPY.errorValidation };
  }

  if (status === 405 || (isWriteMethod(method) && status === 404 && !api)) {
    return { kind: 'write_unavailable', message: ROUTINE_COPY.errorWriteUnavailable };
  }

  if (status === 404 || api?.code === 'NOT_FOUND') {
    return { kind: 'not_found', message: ROUTINE_COPY.notFound };
  }

  return { kind: 'generic', message: api?.message || ROUTINE_COPY.errorGeneric };
}
