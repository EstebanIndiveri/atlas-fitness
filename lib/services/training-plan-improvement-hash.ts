import { createHash } from 'node:crypto';

import type { WeeklyPlanDraft } from '@/lib/ai/weekly-plan-draft';
import type { TrainingPlanImprovementSnapshot } from '@/types/training-plan-improvement';
import type { TrainingPlanReplacementState } from '@/types/training-plan-replacement-state';

type TrainingPlanImprovementValue =
  | TrainingPlanImprovementSnapshot
  | WeeklyPlanDraft
  | TrainingPlanReplacementState;

/**
 * Hashes a validated proposal or plan snapshot with stable object-key ordering.
 *
 * @param value - JSON-compatible current-plan or proposal value.
 * @returns Lowercase SHA-256 hex digest.
 */
export function hashTrainingPlanImprovementValue(value: TrainingPlanImprovementValue): string {
  return createHash('sha256').update(canonicalTrainingPlanImprovementJson(value)).digest('hex');
}

/**
 * Serializes JSON-compatible data with stable object-key ordering.
 *
 * @param value - Validated receipt claims or plan snapshot data.
 * @returns Canonical JSON representation.
 */
export function canonicalTrainingPlanImprovementJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value) ?? 'null';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalTrainingPlanImprovementJson).join(',')}]`;
  }
  if (isRecord(value)) {
    const fields = Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalTrainingPlanImprovementJson(value[key])}`,
    );
    return `{${fields.join(',')}}`;
  }
  throw new Error('Plan improvement snapshot values must be JSON-compatible.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
