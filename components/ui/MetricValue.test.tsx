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

  it('renders the shown source as visible text adjacent to the value', () => {
    render(<MetricValue metric={metric('100 kg', 'external_integration')} label="Peso" showSource />);

    const value = screen.getByText('100 kg');
    expect(value.textContent).toContain('100 kg');
    expect(screen.getByText('Integración')).not.toBeNull();
  });

  it('does not emit duplicate DOM ids when the same label and source repeat', () => {
    const { container } = render(
      <>
        <MetricValue metric={metric('5', 'user_input')} label="Series" showSource />
        <MetricValue metric={metric('5', 'user_input')} label="Series" showSource />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('[id]')).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// @ts-expect-error MetricValue requires a sourced Metric, not a bare value.
<MetricValue metric={42} />;
