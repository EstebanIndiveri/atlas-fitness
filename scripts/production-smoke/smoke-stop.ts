import type { StepStatus } from './types';

/** Phase whose result a controlled stop aborts. */
export type SmokeField = 'target' | 'auth' | 'reauth' | 'history' | 'note' | 'cas' | 'cleanup';

/**
 * Flow-control error carrying a sanitized phase result.
 *
 * Never holds a secret: `detail` is a fixed code and `retryAfterSeconds` is
 * numeric guidance only.
 */
export class SmokeStop extends Error {
  constructor(
    readonly field: SmokeField,
    readonly status: Extract<StepStatus, 'FAIL' | 'INCOMPLETE'>,
    readonly detail: string,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(detail);
    this.name = 'SmokeStop';
  }
}
