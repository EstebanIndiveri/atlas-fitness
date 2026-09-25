import { Button } from '@/components/ui/Button';
import { ONBOARDING_COPY } from '@/lib/copy/onboarding';
import { PROFILE_PREFERENCES_COPY } from '@/lib/copy/profile';
import { PROFILE_PREFERENCE_FIELDS } from '@/lib/profile/preferences';
import { profilePreferenceLabel } from '@/components/profile/preference-label';
import type { OnboardingAnswers } from '@/lib/onboarding/state';

interface ProfilePreferencesLegacyImportProps {
  answers: OnboardingAnswers | null;
  isImporting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onReview: () => void;
}

/**
 * Offers an explicit preview and confirmation for browser-local legacy answers.
 * @param props Legacy answers and user-confirmed import actions.
 * @returns The legacy import prompt, preview, and controls.
 * @example <ProfilePreferencesLegacyImport answers={answers} isImporting={false} onCancel={cancel} onConfirm={confirm} onReview={review} />
 */
export function ProfilePreferencesLegacyImport({
  answers,
  isImporting,
  onCancel,
  onConfirm,
  onReview,
}: ProfilePreferencesLegacyImportProps) {
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <p className="text-sm leading-6 text-ink-muted">{ONBOARDING_COPY.sync.importPrompt}</p>
      {answers ? (
        <>
          <h3 className="text-sm font-semibold text-ink">{ONBOARDING_COPY.sync.importTitle}</h3>
          <dl className="divide-y divide-line rounded-lg border border-line">
            {PROFILE_PREFERENCE_FIELDS.map((field) => {
              const value = answers[field.id];
              const title = field.options.find((option) => option.id === value)?.title
                ?? ONBOARDING_COPY.proposal.emptyValue;
              return (
                <div key={field.id} className="flex items-center justify-between gap-4 px-3 py-2">
                  <dt className="text-xs font-medium text-ink-muted">
                    {profilePreferenceLabel(field.id)}
                  </dt>
                  <dd className="text-right text-sm font-semibold text-ink">{title}</dd>
                </div>
              );
            })}
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onConfirm}
              className="min-h-11"
              disabled={isImporting}
              data-testid="profile-confirm-legacy-import"
            >
              {isImporting ? PROFILE_PREFERENCES_COPY.importing : ONBOARDING_COPY.sync.importConfirm}
            </Button>
            <Button
              variant="secondary"
              className="min-h-11"
              onClick={onCancel}
              disabled={isImporting}
            >
              {ONBOARDING_COPY.sync.importCancel}
            </Button>
          </div>
        </>
      ) : (
        <Button
          variant="secondary"
          className="min-h-11"
          onClick={onReview}
          data-testid="profile-review-legacy-import"
        >
          {ONBOARDING_COPY.sync.importAction}
        </Button>
      )}
    </div>
  );
}
