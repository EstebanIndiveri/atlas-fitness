import type { FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { ONBOARDING_COPY } from '@/lib/copy/onboarding';
import { PROFILE_PREFERENCES_COPY } from '@/lib/copy/profile';
import { PROFILE_PREFERENCE_FIELDS } from '@/lib/profile/preferences';
import type { UserPreferences } from '@/types/user-preferences';

interface ProfilePreferencesFormProps {
  draft: UserPreferences;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (field: keyof UserPreferences, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/**
 * Renders the editable Coach preference fields.
 * @param props Current draft, pending state, and form actions.
 * @returns A keyboard-accessible preference form.
 * @example <ProfilePreferencesForm draft={draft} isSaving={false} onCancel={cancel} onChange={change} onSubmit={save} />
 */
export function ProfilePreferencesForm({
  draft,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
}: ProfilePreferencesFormProps) {
  return (
    <form className="space-y-4 p-4" onSubmit={onSubmit}>
      <div className="space-y-4">
        {PROFILE_PREFERENCE_FIELDS.map((field) => (
          <div key={field.id} className="space-y-1">
            <label htmlFor={`profile-preference-${field.id}`} className="text-sm font-medium text-ink">
              {field.label}
            </label>
            <select
              id={`profile-preference-${field.id}`}
              value={draft[field.id] ?? ''}
              onChange={(event) => onChange(field.id, event.target.value)}
              disabled={isSaving}
              className="min-h-11 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <option value="">{ONBOARDING_COPY.proposal.emptyValue}</option>
              {field.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSaving} data-testid="profile-preferences-save">
          {isSaving ? PROFILE_PREFERENCES_COPY.saving : PROFILE_PREFERENCES_COPY.save}
        </Button>
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={isSaving}
          data-testid="profile-preferences-cancel"
        >
          {PROFILE_PREFERENCES_COPY.cancel}
        </Button>
      </div>
    </form>
  );
}
