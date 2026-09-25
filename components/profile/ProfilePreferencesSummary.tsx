import { ONBOARDING_COPY } from '@/lib/copy/onboarding';
import { PROFILE_PREFERENCE_FIELDS } from '@/lib/profile/preferences';
import { profilePreferenceLabel } from '@/components/profile/preference-label';
import type { UserPreferences } from '@/types/user-preferences';

interface ProfilePreferencesSummaryProps {
  preferences: UserPreferences;
  onEdit: () => void;
}

/**
 * Displays server-persisted Mi Atlas values with direct access to their editor.
 * @param props Server-persisted preference values and edit action.
 * @returns Accessible preference summary with editable rows.
 * @example <ProfilePreferencesSummary preferences={preferences} onEdit={beginEditing} />
 */
export function ProfilePreferencesSummary({ preferences, onEdit }: ProfilePreferencesSummaryProps) {
  return (
    <dl className="divide-y divide-line rounded-md border border-line">
      {PROFILE_PREFERENCE_FIELDS.map((field) => {
        const value = preferences[field.id] ?? null;
        const title = field.options.find((option) => option.id === value)?.title
          ?? ONBOARDING_COPY.proposal.emptyValue;
        const label = profilePreferenceLabel(field.id);
        return (
          <div key={field.id} className="flex items-center justify-between gap-4 px-3 py-2">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="text-right text-sm font-semibold text-ink">
              <button
                type="button"
                aria-label={`Editar ${label.toLocaleLowerCase('es-AR')}`}
                onClick={onEdit}
                className="min-h-11 rounded-sm px-2 text-right underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {title}
              </button>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
