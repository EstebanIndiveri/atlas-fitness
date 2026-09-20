import { Card } from '@/components/ui/Card';
import { UI_COPY } from '@/lib/copy/ui';
import type { AuthUser } from '@/types/auth';

interface ProfileHeaderCardProps {
  user: AuthUser;
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
 * @param props Authenticated user loaded from `/api/auth/me`.
 * @returns Profile card with initials, name, and email only.
 * @example <ProfileHeaderCard user={user} />
 */
export function ProfileHeaderCard({ user }: ProfileHeaderCardProps) {
  const initials = initialsForName(user.name);

  return (
    <Card className="flex items-center gap-4">
      <div
        role="img"
        aria-label={UI_COPY.profileInitialsLabel(user.name)}
        className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand text-xl font-semibold text-brand-foreground shadow-card"
      >
        {initials}
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-xl font-semibold tracking-[-0.02em] text-ink">{user.name}</h2>
        <p className="truncate text-sm text-ink-muted">{user.email}</p>
      </div>
    </Card>
  );
}
