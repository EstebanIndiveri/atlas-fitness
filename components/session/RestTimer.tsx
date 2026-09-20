'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SESSION_COPY } from '@/lib/copy/session';

type RestTimerProps = {
  remaining: number;
  motivator: string;
  onSkip: () => void;
};

export function RestTimer({ remaining, motivator, onSkip }: RestTimerProps) {
  return (
    <Card tone="brand" elevated={false} className="mb-4 border border-brand p-4 text-center">
      <p className="text-sm font-medium text-ink">{SESSION_COPY.restTitle}</p>
      <p className="text-3xl font-bold text-brand" data-testid="rest-timer">
        {remaining}s
      </p>
      <p className="mt-2 text-sm text-ink" data-testid="rest-motivator">
        {motivator}
      </p>
      <Button variant="secondary" className="mt-3" onClick={onSkip} data-testid="skip-rest">
        {SESSION_COPY.skipRest}
      </Button>
    </Card>
  );
}
