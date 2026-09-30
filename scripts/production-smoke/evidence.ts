import { EVIDENCE_SCHEMA_VERSION } from './constants';
import type { SmokeEvidence, StepResult, StepStatus } from './types';

/** Builds a sanitized per-phase result. `detail` must be a non-secret code. */
export function step(status: StepStatus, detail?: string): StepResult {
  return detail === undefined ? { status } : { status, detail };
}

/** Attaches the schema version to a fully assembled evidence object. */
export function buildEvidence(params: Omit<SmokeEvidence, 'schemaVersion'>): SmokeEvidence {
  return { schemaVersion: EVIDENCE_SCHEMA_VERSION, ...params };
}

export function serializeEvidence(evidence: SmokeEvidence): string {
  return `${JSON.stringify(evidence, null, 2)}\n`;
}

const FORBIDDEN_LITERALS = ['set-cookie', 'authorization', 'password'] as const;

/**
 * Finds leaked secret material without echoing any value.
 *
 * @returns Human-readable labels of the matches (never the secret itself).
 */
export function findLeaks(serialized: string, secrets: readonly string[]): string[] {
  const leaks: string[] = [];
  secrets.forEach((secret, index) => {
    if (secret.length > 0 && serialized.includes(secret)) {
      leaks.push(`secret[${index}]`);
    }
  });
  const lower = serialized.toLowerCase();
  for (const literal of FORBIDDEN_LITERALS) {
    if (lower.includes(literal)) {
      leaks.push(literal);
    }
  }
  return leaks;
}

/** Throws when evidence contains a secret value or a forbidden header literal. */
export function assertEvidenceSanitized(
  evidence: SmokeEvidence,
  secrets: readonly string[],
): void {
  const leaks = findLeaks(serializeEvidence(evidence), secrets);
  if (leaks.length > 0) {
    throw new Error(`Evidence contains sensitive material: ${leaks.join(', ')}`);
  }
}
