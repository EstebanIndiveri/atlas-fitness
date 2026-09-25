'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { SettingsSection } from '@/components/profile/SettingsSection';
import { ProfilePreferencesForm } from '@/components/profile/ProfilePreferencesForm';
import { ProfilePreferencesLegacyImport } from '@/components/profile/ProfilePreferencesLegacyImport';
import { ProfilePreferencesSummary } from '@/components/profile/ProfilePreferencesSummary';
import { ONBOARDING_COPY } from '@/lib/copy/onboarding';
import { PROFILE_PREFERENCES_COPY } from '@/lib/copy/profile';
import { importLegacyPreferencesIfMissing } from '@/lib/onboarding/preferences-sync';
import { readOnboardingAnswers, type OnboardingAnswers } from '@/lib/onboarding/state';
import {
  EMPTY_USER_PREFERENCES,
  isPreferencesResponse,
  isSupportedPreference,
  isValidLegacyAnswers,
  preferenceRequestError,
  PROFILE_PREFERENCES_ENDPOINT,
  profilePreferenceErrorMessage,
  requestSavedPreferences,
} from '@/lib/profile/preferences';
import type { UserPreferences, UserPreferencesResponse } from '@/types/user-preferences';

/**
 * Loads and edits the signed-in user's Coach context without changing the active plan.
 * @returns The Profile preferences section with explicit edit and legacy-import actions.
 * @example <ProfileCoachContext />
 */
export function ProfileCoachContext() {
  const [preferences, setPreferences] = useState<UserPreferencesResponse | null>(null);
  const [draft, setDraft] = useState<UserPreferences>(EMPTY_USER_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [legacyAnswers, setLegacyAnswers] = useState<OnboardingAnswers | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void requestSavedPreferences(controller.signal)
      .then((result) => {
        setPreferences(result);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(profilePreferenceErrorMessage(error, PROFILE_PREFERENCES_COPY.loadError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [loadAttempt]);

  function retryLoadingPreferences(): void {
    setIsLoading(true);
    setLoadError(null);
    setLoadAttempt((attempt) => attempt + 1);
  }

  function beginEditing(): void {
    if (isImporting) {
      return;
    }
    setDraft(preferences?.preferences ?? EMPTY_USER_PREFERENCES);
    setActionError(null);
    setStatus(null);
    setIsEditing(true);
  }

  function cancelEditing(): void {
    setDraft(preferences?.preferences ?? EMPTY_USER_PREFERENCES);
    setActionError(null);
    setIsEditing(false);
  }

  function updateDraft(field: keyof UserPreferences, rawValue: string): void {
    const value = rawValue === '' ? null : rawValue;
    if (field === 'goal' && isSupportedPreference('goal', value)) {
      setDraft((current) => ({ ...current, goal: value }));
    } else if (field === 'pace' && isSupportedPreference('pace', value)) {
      setDraft((current) => ({ ...current, pace: value }));
    } else if (field === 'equipment' && isSupportedPreference('equipment', value)) {
      setDraft((current) => ({ ...current, equipment: value }));
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setStatus(null);
    try {
      let response: Response;
      try {
        response = await fetch(PROFILE_PREFERENCES_ENDPOINT, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(draft),
        });
      } catch {
        throw new Error(PROFILE_PREFERENCES_COPY.saveError);
      }
      if (!response.ok) {
        throw preferenceRequestError(
          response.status,
          PROFILE_PREFERENCES_COPY.saveUnauthorized,
          PROFILE_PREFERENCES_COPY.saveError,
        );
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error(PROFILE_PREFERENCES_COPY.saveError);
      }
      if (!isPreferencesResponse(body) || !body.hasSavedPreferences) {
        throw new Error(PROFILE_PREFERENCES_COPY.saveError);
      }
      setPreferences(body);
      setIsEditing(false);
      setStatus(PROFILE_PREFERENCES_COPY.saveSuccess);
    } catch (error) {
      setActionError(profilePreferenceErrorMessage(error, PROFILE_PREFERENCES_COPY.saveError));
    } finally {
      setIsSaving(false);
    }
  }

  function handleReviewLegacyAnswers(): void {
    setActionError(null);
    setStatus(null);
    const answers = readOnboardingAnswers();
    if (!answers) {
      setActionError(ONBOARDING_COPY.sync.importMissing);
      return;
    }
    if (!isValidLegacyAnswers(answers)) {
      setActionError(PROFILE_PREFERENCES_COPY.importInvalid);
      return;
    }
    setLegacyAnswers(answers);
  }

  async function handleConfirmLegacyImport(): Promise<void> {
    if (!legacyAnswers || isImporting) {
      return;
    }

    setIsImporting(true);
    setActionError(null);
    setStatus(null);
    try {
      const result = await importLegacyPreferencesIfMissing(legacyAnswers);
      const refreshedPreferences = await requestSavedPreferences();
      setPreferences(refreshedPreferences);
      setIsEditing(false);
      setLegacyAnswers(null);
      setStatus(
        result === 'imported'
          ? ONBOARDING_COPY.sync.importSuccess
          : ONBOARDING_COPY.sync.importAlreadySaved,
      );
    } catch (error) {
      setActionError(profilePreferenceErrorMessage(error, ONBOARDING_COPY.sync.importFailure));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <SettingsSection title={PROFILE_PREFERENCES_COPY.title} eyebrow={PROFILE_PREFERENCES_COPY.eyebrow}>
      {isLoading ? (
        <p role="status" className="p-4 text-sm text-ink-muted">{PROFILE_PREFERENCES_COPY.load}</p>
      ) : loadError ? (
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-danger">{loadError}</p>
          <Button variant="secondary" onClick={retryLoadingPreferences}>
            {PROFILE_PREFERENCES_COPY.retry}
          </Button>
        </div>
      ) : (
        <>
          <p className="px-4 pt-4 text-sm leading-6 text-ink-muted">
            {PROFILE_PREFERENCES_COPY.description}
          </p>
          {preferences?.hasSavedPreferences ? (
            <p className="px-4 pt-3 text-xs font-semibold text-success">
              {PROFILE_PREFERENCES_COPY.savedLabel}
            </p>
          ) : (
            <p className="px-4 pt-3 text-sm text-ink-muted">{PROFILE_PREFERENCES_COPY.empty}</p>
          )}
          {isEditing ? (
            <ProfilePreferencesForm
              draft={draft}
              isSaving={isSaving}
              onCancel={cancelEditing}
              onChange={updateDraft}
              onSubmit={(event) => void handleSave(event)}
            />
          ) : preferences?.hasSavedPreferences ? (
            <ProfilePreferencesSummary preferences={preferences.preferences} />
          ) : null}
          {!isEditing ? (
            <div className="p-4">
              <Button variant="secondary" onClick={beginEditing} disabled={isImporting}>
                {preferences?.hasSavedPreferences
                  ? PROFILE_PREFERENCES_COPY.edit
                  : PROFILE_PREFERENCES_COPY.create}
              </Button>
            </div>
          ) : null}
          {!preferences?.hasSavedPreferences && !isEditing ? (
            <ProfilePreferencesLegacyImport
              answers={legacyAnswers}
              isImporting={isImporting}
              onCancel={() => setLegacyAnswers(null)}
              onConfirm={() => void handleConfirmLegacyImport()}
              onReview={handleReviewLegacyAnswers}
            />
          ) : null}
          {actionError ? <p role="alert" className="px-4 pb-4 text-sm text-danger">{actionError}</p> : null}
          {status ? <p role="status" className="px-4 pb-4 text-sm text-success">{status}</p> : null}
        </>
      )}
    </SettingsSection>
  );
}
