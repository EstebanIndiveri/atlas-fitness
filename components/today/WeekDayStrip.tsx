import { cordobaWeekdayIndex } from '@/lib/time/cordoba';
import { cn } from '@/lib/ui/cn';

interface WeekDayStripProps {
  now?: Date;
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
const TODAY_LABEL = 'HOY';

/**
 * Weekly day strip for the Today screen. Highlights the real current day in Córdoba
 * but shows no completion marks — weekly aggregation has no backend yet, so nothing
 * is fabricated (DATA HONESTY RULE).
 * @param props Optional clock instant (defaults to now) for deterministic rendering.
 * @returns A Monday-first row of day markers with today emphasised.
 * @example <WeekDayStrip />
 */
export function WeekDayStrip({ now = new Date() }: WeekDayStripProps) {
  const todayIndex = cordobaWeekdayIndex(now);

  return (
    <ul className="flex justify-between gap-1.5" aria-label="Días de la semana">
      {DAY_LABELS.map((label, index) => {
        const isToday = index === todayIndex;
        return (
          <li key={`${DAY_NAMES[index]}`} className="flex-1">
            <div
              aria-current={isToday ? 'date' : undefined}
              aria-label={isToday ? `${DAY_NAMES[index]} (hoy)` : DAY_NAMES[index]}
              className={cn(
                'grid h-11 place-items-center rounded-lg text-xs font-semibold',
                isToday
                  ? 'bg-brand text-brand-foreground'
                  : 'bg-canvas text-ink-muted ring-1 ring-line',
              )}
            >
              {isToday ? TODAY_LABEL : label}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
