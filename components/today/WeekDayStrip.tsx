import { cordobaWeekdayIndex } from '@/lib/time/cordoba';
import { cn } from '@/lib/ui/cn';
import type { WeekDayConsistency } from '@/types/week';

interface WeekDayStripProps {
  /** Clock instant used only for the fallback today highlight when `days` is absent. */
  now?: Date;
  /** Real weekly consistency days (Monday→Sunday). When present, active days are marked. */
  days?: WeekDayConsistency[];
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
const TODAY_LABEL = 'HOY';

function dayAriaLabel(name: string, isToday: boolean, isActive: boolean): string {
  const notes = [isToday ? 'hoy' : null, isActive ? 'activo' : null].filter(Boolean);
  return notes.length > 0 ? `${name} (${notes.join(', ')})` : name;
}

/**
 * Weekly day strip for the Today screen. Highlights the current Córdoba day and,
 * when real consistency `days` are provided, marks the days with real activity
 * (ended workout OR daily check-in). Without `days` it shows no completion marks,
 * so nothing is fabricated (DATA HONESTY RULE).
 * @param props Optional clock instant and real weekly consistency days.
 * @returns A Monday-first row of day markers with today emphasised and active days marked.
 * @example <WeekDayStrip days={week.days} />
 */
export function WeekDayStrip({ now = new Date(), days }: WeekDayStripProps) {
  const fallbackTodayIndex = cordobaWeekdayIndex(now);

  return (
    <ul className="flex justify-between gap-1.5" aria-label="Días de la semana">
      {DAY_LABELS.map((label, index) => {
        const day = days?.[index];
        const isToday = day ? day.isToday : index === fallbackTodayIndex;
        const isActive = day?.active ?? false;
        const isFuture = day?.isFuture ?? false;
        return (
          <li key={`${DAY_NAMES[index]}`} className="flex flex-1 flex-col items-center gap-1">
            <div
              aria-current={isToday ? 'date' : undefined}
              aria-label={dayAriaLabel(DAY_NAMES[index], isToday, isActive)}
              className={cn(
                'grid h-11 w-full place-items-center rounded-lg text-xs font-semibold',
                isToday
                  ? 'bg-brand text-brand-foreground'
                  : isActive
                    ? 'bg-canvas text-ink ring-2 ring-brand'
                    : 'bg-canvas text-ink-muted ring-1 ring-line',
                isFuture && !isToday && 'opacity-60',
              )}
            >
              {isToday ? TODAY_LABEL : label}
            </div>
            <span
              aria-hidden
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isActive ? 'bg-brand' : 'bg-transparent',
              )}
            />
          </li>
        );
      })}
    </ul>
  );
}
