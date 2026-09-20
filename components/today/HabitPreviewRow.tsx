import { cn } from '@/lib/ui/cn';

export interface HabitPreview {
  id: string;
  name: string;
  hint: string;
  icon: string;
}

interface HabitPreviewRowProps {
  habit: HabitPreview;
  soonLabel: string;
}

/**
 * Structural row for a not-yet-tracked habit on the Today screen.
 * Shows the habit identity (icon, name, static hint) and an honest "coming soon"
 * marker instead of any progress number — habit tracking has no backend yet
 * (DATA HONESTY RULE).
 * @param props Habit identity and the localized "coming soon" label.
 * @returns A flat list row with a disabled progress affordance.
 * @example <HabitPreviewRow habit={habit} soonLabel="Próximamente" />
 */
export function HabitPreviewRow({ habit, soonLabel }: HabitPreviewRowProps) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-muted text-brand"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={habit.icon} />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{habit.name}</p>
        <p className="truncate text-xs text-ink-muted">{habit.hint}</p>
      </div>
      <span
        className={cn(
          'shrink-0 rounded-full bg-canvas px-2.5 py-1 text-[0.68rem] font-medium text-ink-muted ring-1 ring-line',
        )}
      >
        {soonLabel}
      </span>
    </li>
  );
}
