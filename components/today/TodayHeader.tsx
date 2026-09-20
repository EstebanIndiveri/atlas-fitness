import { cordobaDisplayDate } from '@/lib/time/cordoba';

interface TodayHeaderProps {
  name: string | null;
  now?: Date;
}

const COPY = {
  greetingWithName: (name: string) => `Hola, ${name}`,
  greeting: 'Hola',
  subtitle: '¿Cómo venís hoy?',
};

/**
 * Presentational Today header: Córdoba date, greeting and subtitle.
 * @param props Optional user name and clock instant (defaults to now).
 * @returns Header block for the Today screen.
 * @example <TodayHeader name="Esteban" />
 */
export function TodayHeader({ name, now = new Date() }: TodayHeaderProps) {
  const displayDate = cordobaDisplayDate(now);
  const greeting = name ? COPY.greetingWithName(name) : COPY.greeting;

  return (
    <header className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
        {displayDate}
      </p>
      <h1
        className="font-serif text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl"
        data-testid="welcome-message"
      >
        {greeting}
      </h1>
      <p className="text-sm text-ink-muted">{COPY.subtitle}</p>
    </header>
  );
}
