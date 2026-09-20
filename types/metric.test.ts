import { describe, expect, it } from '@jest/globals';
import { metric, MetricSourceLabel } from './metric';
import type { Metric } from './metric';

describe('metric', () => {
  it('constructs a metric with its declared source', () => {
    expect(metric(42, 'atlas_computed')).toEqual({
      value: 42,
      source: 'atlas_computed',
    });
  });

  it('exposes es-AR provenance labels for each source', () => {
    expect(MetricSourceLabel).toEqual({
      user_input: 'Ingresado por vos',
      atlas_computed: 'Calculado por Atlas',
      external_integration: 'Integración',
      ai_recommendation: 'Sugerencia de Atlas',
    });
  });
});

// @ts-expect-error Metric values must always declare their real source.
const metricWithoutSource: Metric<number> = { value: 42 };
void metricWithoutSource;
