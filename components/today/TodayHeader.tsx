import { cordobaDisplayDate } from '@/lib/time/cordoba';

interface TodayHeaderProps {
  name: string | null;
  now?: Date;
}

const COPY = {
  greetingWithName: (name: string) => `Hola, ${name}`,
  greeting: 'Hola',
  eyebrow: 'ATLAS ADAPTIVE',
  brand: 'Atlas',
  notifications: 'Notificaciones',
  avatarFallback: 'Avatar de Atlas',
  avatarLabel: (name: string) => `Avatar de ${name}`,
};

function initialsForName(name: string | null): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[1]?.[0] ?? '' : '';
  return `${first}${second}`.toUpperCase();
}

/**
 * Presentational Today header: brand rail, Córdoba date and greeting.
 * @param props Optional user name and clock instant (defaults to now).
 * @returns Header block for the Today screen.
 * @example <TodayHeader name="Esteban" />
 */
export function TodayHeader({ name, now = new Date() }: TodayHeaderProps) {
  const displayDate = cordobaDisplayDate(now);
  const greeting = name ? COPY.greetingWithName(name) : COPY.greeting;
  const initials = initialsForName(name);

  return (
    <header className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 min-w-11 items-center justify-center rounded-full bg-ink px-3 text-sm font-semibold text-canvas shadow-card"
            aria-label={name ? COPY.avatarLabel(name) : COPY.avatarFallback}
          >
            ◎{initials ? ` ${initials}` : ''}
          </div>
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-ink-muted">
              {COPY.eyebrow}
            </p>
            <p className="font-serif text-2xl font-semibold leading-none tracking-[-0.04em] text-ink">
              {COPY.brand}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label={COPY.notifications}
          className="grid size-11 place-items-center rounded-full bg-surface text-ink shadow-card ring-1 ring-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span aria-hidden="true">⌁</span>
        </button>
      </div>
      <p className="text-sm font-medium capitalize text-ink-muted">{displayDate}</p>
      <h1
        className="font-serif text-4xl font-semibold tracking-[-0.05em] text-ink sm:text-5xl"
        data-testid="welcome-message"
      >
        {greeting}
      </h1>
    </header>
  );
}
