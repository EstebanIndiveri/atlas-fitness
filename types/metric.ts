/**
 * Declares where a user-facing metric comes from.
 *
 * Atlas follows the data honesty rule: every number, score, biometric, and
 * recommendation shown to a user must carry its real provenance. This prevents
 * demo values, fake biometrics, arbitrary scores, or false precision from
 * entering the UI without an explicit source.
 *
 * - `user_input`: the user typed or selected the value directly.
 * - `atlas_computed`: Atlas derived the value deterministically from stored data.
 * - `external_integration`: a connected third-party system provided the value.
 * - `ai_recommendation`: Atlas generated the value as an AI-assisted suggestion.
 */
export type MetricSource =
  | 'user_input'
  | 'atlas_computed'
  | 'external_integration'
  | 'ai_recommendation';

/**
 * User-facing value that cannot be rendered without a declared provenance.
 *
 * @template T Value type carried by the metric.
 */
export interface Metric<T> {
  /** Value displayed or consumed by the UI. */
  value: T;
  /** Real provenance for the value. */
  source: MetricSource;
}

/**
 * Short es-AR labels for displaying metric provenance to users.
 */
export const MetricSourceLabel: Record<MetricSource, string> = {
  user_input: 'Ingresado por vos',
  atlas_computed: 'Calculado por Atlas',
  external_integration: 'Integración',
  ai_recommendation: 'Sugerencia de Atlas',
};

/**
 * Builds a sourced metric while keeping construction concise at call sites.
 *
 * @template T Value type carried by the metric.
 * @param value Value displayed or consumed by the UI.
 * @param source Real provenance for the value.
 * @returns A metric that satisfies the data honesty rule.
 * @example
 * const personalRecord = metric('100 kg', 'atlas_computed');
 */
export function metric<T>(value: T, source: MetricSource): Metric<T> {
  return { value, source };
}
