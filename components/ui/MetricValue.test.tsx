import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MetricValue } from './MetricValue';
import { metric } from '@/types/metric';

describe('MetricValue', () => {
  it('renders the metric value', () => {
    render(<MetricValue metric={metric('82 kg', 'user_input')} />);
    expect(screen.getByText('82 kg')).not.toBeNull();
  });

  it('hides the provenance source by default', () => {
    render(<MetricValue metric={metric('91', 'atlas_computed')} />);
    expect(screen.queryByText('Calculado por Atlas')).toBeNull();
  });

  it('shows the provenance source when requested', () => {
    render(<MetricValue metric={metric('77', 'ai_recommendation')} showSource />);
    expect(screen.getByText('Sugerencia de Atlas')).not.toBeNull();
  });

  it('associates the shown source with the visible value for accessibility', () => {
    render(<MetricValue metric={metric('100 kg', 'external_integration')} label="Peso" showSource />);

    const value = screen.getByText('100 kg');
    const sourceId = value.getAttribute('aria-describedby');

    expect(value.textContent).toContain('100 kg');
    expect(sourceId).toBeTruthy();
    expect(document.getElementById(sourceId ?? '')?.textContent).toBe('Integración');
  });
});

// @ts-expect-error MetricValue requires a sourced Metric, not a bare value.
<MetricValue metric={42} />;
