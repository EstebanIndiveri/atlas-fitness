import { cn } from '@/lib/ui/cn';
import type { HabitKey } from '@/types/habit';

export interface HabitPreview {
  id: HabitKey;
  name: string;
  hint: string;
  icon: string;
}

interface HabitPreviewRowProps {
  habit: HabitPreview;
  done: boolean;
  onToggle: (habitKey: HabitKey) => void;
  disabled?: boolean;
}

/**
 * Interactive row for a manually tracked daily habit on the Today screen.
 *
 * Renders the habit identity (icon, name, hint) and a checkbox toggle reflecting
 * the user's own completion state. The value is `source: user_input`; no counts,
 * targets, or ratios are fabricated (DATA HONESTY RULE).
 * @param props Habit identity, current done state, toggle handler, and disabled flag.
 * @returns A list row whose toggle reports the habit key when activated.
 * @example
 * <HabitPreviewRow habit={habit} done={false} onToggle={toggle} />
 */
export function HabitPreviewRow({ habit, done, onToggle, disabled = false }: HabitPreviewRowProps) {
  return (
    <li className="flex items-center gap-3 py-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={habit.name}
        disabled={disabled}
        onClick={() => onToggle(habit.id)}
        className={cn(
          'flex min-h-14 flex-1 items-center gap-3 rounded-2xl px-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          disabled ? 'cursor-not-allowed opacity-70' : 'hover:bg-canvas',
        )}
      >
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
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{habit.name}</span>
          <span className="block truncate text-xs text-ink-muted">{habit.hint}</span>
        </span>
        <span className="mr-1 text-right text-xs font-semibold text-ink-muted">
          {done ? 'Registrado' : 'Registrar'}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full border transition',
            done ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-transparent',
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12l4 4 10-10" />
          </svg>
        </span>
      </button>
    </li>
  );
}
