import { ONBOARDING_COPY } from '@/lib/copy/onboarding';
import { PROFILE_PREFERENCE_FIELDS } from '@/lib/profile/preferences';
import { PROFILE_PREFERENCES_COPY } from '@/lib/copy/profile';
import type { UserPreferences } from '@/types/user-preferences';

interface ProfilePreferencesSummaryProps {
  preferences: UserPreferences;
}

/**
 * Displays saved Coach preferences or an explicit all-empty saved-row state.
 * @param props Server-persisted preference values.
 * @returns Read-only preference summary.
 * @example <ProfilePreferencesSummary preferences={preferences} />
 */
export function ProfilePreferencesSummary({ preferences }: ProfilePreferencesSummaryProps) {
  if (!Object.values(preferences).some(Boolean)) {
    return <p className="px-4 pt-4 text-sm text-ink-muted">{PROFILE_PREFERENCES_COPY.savedEmpty}</p>;
  }
  return (
    <dl className="divide-y divide-line">
      {PROFILE_PREFERENCE_FIELDS.map((field) => {
        const value = preferences[field.id] ?? null;
        const title = field.options.find((option) => option.id === value)?.title
          ?? ONBOARDING_COPY.proposal.emptyValue;
        return (
          <div key={field.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-ink-muted">{field.label}</dt>
            <dd className="text-right text-sm font-semibold text-ink">{title}</dd>
          </div>
        );
      })}
    </dl>
  );
}
