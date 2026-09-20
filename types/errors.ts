export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'SERVICE_UNAVAILABLE'
  | 'RECOMMENDATION_NOT_FOUND'
  | 'RECOMMENDATION_ALREADY_DECIDED';

export interface ApiError {
  code: ErrorCode;
  message: string;
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON(): ApiError {
    return {
      code: this.code,
      message: this.message,
    };
  }
}
