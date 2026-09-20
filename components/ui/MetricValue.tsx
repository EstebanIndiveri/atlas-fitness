import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';
import { MetricSourceLabel } from '@/types/metric';
import type { Metric } from '@/types/metric';

/**
 * Props for `MetricValue`, enforcing that displayed values carry provenance.
 */
export interface MetricValueProps {
  /** Sourced value to render. Bare values are intentionally rejected. */
  metric: Metric<ReactNode>;
  /** Accessible name for the displayed value. */
  label?: string;
  /** Whether to show the provenance label next to the value. */
  showSource?: boolean;
  /** Optional classes for the outer wrapper. */
  className?: string;
}

/**
 * Renders a user-facing metric only when its source is declared.
 *
 * Use this component for numbers, scores, and short metric values that must obey
 * Atlas' data honesty rule. When `showSource` is true, the provenance is visible
 * and associated with the value through `aria-describedby`.
 *
 * @param props Sourced metric display options.
 * @returns Server-safe metric markup for Next App Router.
 * @example
 * <MetricValue metric={metric('82 kg', 'user_input')} label="Peso" showSource />
 */
export function MetricValue({
  metric: metricValue,
  label,
  showSource = false,
  className,
}: MetricValueProps) {
  const sourceId = showSource ? sourceDescriptionId(label, metricValue.source) : undefined;

  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span aria-describedby={sourceId} className="font-medium text-ink">
        {label ? <span className="sr-only">{label}: </span> : null}
        {metricValue.value}
      </span>
      {showSource ? (
        <span id={sourceId} className="text-xs text-ink-muted">
          {MetricSourceLabel[metricValue.source]}
        </span>
      ) : null}
    </span>
  );
}

function sourceDescriptionId(label: string | undefined, source: Metric<ReactNode>['source']): string {
  const base = label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'metric';
  return `${base.replace(/^-|-$/g, '') || 'metric'}-${source}-source`;
}
