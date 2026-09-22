import { Card } from '@/components/ui/Card';
import { UI_COPY } from '@/lib/copy/ui';
import type { AuthUser } from '@/types/auth';

interface ProfileHeaderCardProps {
  user: AuthUser;
  statusLabel: string;
  stats: readonly [ProfileHeaderStat, ProfileHeaderStat];
}

interface ProfileHeaderStat {
  label: string;
  value: string;
}

function initialsForName(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('es-AR') ?? '')
    .join('');

  return initials || UI_COPY.profileAvatarFallback;
}

/**
 * Renders the honest identity card for the current authenticated user.
 * @param props Authenticated user loaded from `/api/auth/me`, status label, and honest stat labels.
 * @returns Profile card with initials, identity, status, and two data-honest stat blocks.
 * @example <ProfileHeaderCard user={user} statusLabel="Plan no configurado" stats={stats} />
 */
export function ProfileHeaderCard({ user, statusLabel, stats }: ProfileHeaderCardProps) {
  const initials = initialsForName(user.name);

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-4">
        <div
          role="img"
          aria-label={UI_COPY.profileInitialsLabel(user.name)}
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-muted text-xl font-semibold text-ink shadow-card"
        >
          {initials}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-[-0.02em] text-ink">{user.name}</h2>
          <p className="truncate text-sm text-ink-muted">{user.email}</p>
          <p className="mt-2 inline-flex max-w-full items-center rounded-full bg-brand-muted px-3 py-1 text-xs font-medium text-ink">
            <span aria-hidden="true" className="mr-1 text-success">●</span>
            <span className="truncate">{statusLabel}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md bg-canvas px-3 py-3 text-center">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {stat.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">{stat.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
