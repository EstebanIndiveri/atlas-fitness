'use client';

import { useEffect, useState } from 'react';

import { AppInstallPrompt } from '@/components/pwa/AppInstallPrompt';
import { ProfileCoachContext } from '@/components/profile/ProfileCoachContext';
import { ProfileHeaderCard } from '@/components/profile/ProfileHeaderCard';
import { ProfileTelegramCard } from '@/components/profile/ProfileTelegramCard';
import { SettingsRow } from '@/components/profile/SettingsRow';
import { SettingsSection } from '@/components/profile/SettingsSection';
import { LogoutButton } from '@/components/shell/AppNav';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { fetchToday } from '@/lib/api/today';
import { useLinkCode } from '@/hooks/useLinkCode';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { APP_VERSION } from '@/lib/app/version';
import { ONBOARDING_COPY } from '@/lib/copy/onboarding';
import { UI_COPY } from '@/lib/copy/ui';
import { readOnboardingAnswers } from '@/lib/onboarding/state';
import { PWA_COPY } from '@/lib/pwa/copy';
import { TELEGRAM_FE_COPY } from '@/lib/telegram/copy';
import type { AuthUser } from '@/types/auth';
import type { TodayResponse } from '@/lib/api/today';
import type { OnboardingAnswers } from '@/lib/onboarding/state';

const EMPTY_VALUE = 'No configurado';

function planGoalFromToday(today: TodayResponse | null): string | null {
  if (!today || today.kind === 'no_plan') {
    return null;
  }
  return today.planGoal;
}

function planRoutineFromToday(today: TodayResponse | null): string | null {
  if (!today) {
    return null;
  }
  if (today.kind === 'workout') {
    return today.routineName;
  }
  if (today.kind === 'rest_day') {
    return 'Día de descanso';
  }
  if (today.kind === 'routine_missing') {
    return 'Rutina no disponible';
  }
  return null;
}

function profileStatusLabel(today: TodayResponse | null): string {
  const goal = planGoalFromToday(today);
  const routine = planRoutineFromToday(today);
  if (goal && routine) {
    return `Plan ${goal} · ${routine}`;
  }
  if (goal) {
    return `Plan ${goal}`;
  }
  if (routine) {
    return routine;
  }
  return 'Plan no configurado';
}

function trainingPlanDescription(today: TodayResponse | null): string {
  if (!today || today.kind === 'no_plan') {
    return 'Sin plan activo';
  }
  return planRoutineFromToday(today) ?? EMPTY_VALUE;
}

function equipmentLabelFromOnboarding(answers: OnboardingAnswers | null): string | null {
  const equipmentId = answers?.equipment;
  if (!equipmentId) {
    return null;
  }

  const equipmentStep = ONBOARDING_COPY.steps.find((step) => step.id === 'equipment');
  const selectedOption = equipmentStep?.options.find((option) => option.id === equipmentId);
  return selectedOption?.title ?? null;
}

function pwaStateLabel(isStandalone: boolean, canInstall: boolean): string {
  if (isStandalone) {
    return 'Activa';
  }
  return canInstall ? 'Disponible' : 'No instalada';
}

export default function SettingsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswers | null>(null);
  const { code, loading, error, requestCode } = useLinkCode();
  const { canInstall, isStandalone } = useInstallPrompt();

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        setOnboardingAnswers(readOnboardingAnswers());
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [response, todayResult] = await Promise.allSettled([
          fetch('/api/auth/me'),
          fetchToday(),
        ]);
        if (todayResult.status === 'fulfilled') {
          setToday(todayResult.value);
        }
        if (response.status === 'rejected') {
          setLoadError(TELEGRAM_FE_COPY.loadError);
          return;
        }
        if (!response.value.ok) {
          setLoadError(TELEGRAM_FE_COPY.loadError);
          return;
        }
        const data = (await response.value.json()) as AuthUser;
        setUser(data);
      } catch {
        setLoadError(TELEGRAM_FE_COPY.loadError);
      } finally {
        setLoadingUser(false);
      }
    };

    void load();
  }, []);

  if (loadingUser) {
    return <LoadingState label={TELEGRAM_FE_COPY.loading} />;
  }

  if (loadError || !user) {
    return (
      <div className="px-4 py-section">
        <ErrorState message={loadError ?? TELEGRAM_FE_COPY.loadError} />
      </div>
    );
  }

  const linked = Boolean(user.telegramUserId);
  const profileStats = [
    { label: 'ANTIGÜEDAD', value: 'No disponible' },
    { label: 'CONSISTENCIA', value: 'Sin datos' },
  ] as const;
  const planGoal = planGoalFromToday(today) ?? EMPTY_VALUE;
  const equipmentLabel = equipmentLabelFromOnboarding(onboardingAnswers) ?? EMPTY_VALUE;
  const pwaStatus = pwaStateLabel(isStandalone, canInstall);

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-4 sm:px-6 sm:py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">
          {UI_COPY.profileTitle}
        </h1>
        <button
          type="button"
          disabled
          aria-label="Editar perfil (no configurado)"
          title="Editar perfil: no configurado"
          className="text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-70"
        >
          ✎ Editar
        </button>
      </header>

      <ProfileHeaderCard user={user} statusLabel={profileStatusLabel(today)} stats={profileStats} />

      <SettingsSection title={UI_COPY.profileMiAtlasTitle} eyebrow="ENTRENAMIENTO & HÁBITOS">
        <SettingsRow
          icon="◎"
          title="Objetivos"
          description={planGoal}
          href="/dashboard/plan/new"
        />
        <SettingsRow
          icon="▤"
          title="Plan de entrenamiento"
          description={trainingPlanDescription(today)}
          href="/dashboard/routines"
          testId="routines-settings"
        />
        <SettingsRow
          icon="⌁"
          title="Equipamiento disponible"
          description={equipmentLabel}
          href="/dashboard/plan/new"
          testId="equipment-settings"
        />
        <SettingsRow
          icon="♧"
          title={UI_COPY.profileHabitsTitle}
          description={EMPTY_VALUE}
          href="/dashboard/today"
        />
      </SettingsSection>

      <ProfileCoachContext />

      <ProfileTelegramCard
        linked={linked}
        telegramUserId={user.telegramUserId}
        code={code}
        loading={loading}
        error={error}
        onRequestCode={() => void requestCode()}
      />

      <SettingsSection title={UI_COPY.profileApplicationTitle}>
        <div className="space-y-3 p-4" data-testid="pwa-install-settings">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-muted text-sm text-ink">
                ●
              </span>
              <h3 className="text-sm font-medium text-ink">{PWA_COPY.settingsInstallHeading}</h3>
            </div>
            <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-ink-muted">
              {pwaStatus}
            </span>
          </div>
          <AppInstallPrompt />
        </div>
        <SettingsRow
          icon="☼"
          title={UI_COPY.profileAppearanceTitle}
          description={UI_COPY.profileAppearanceDescription}
        />
        <SettingsRow
          icon="▣"
          title={UI_COPY.profileUnitsTitle}
          description={UI_COPY.profileUnitsDescription}
        />
      </SettingsSection>

      <SettingsSection title={UI_COPY.profileAccountTitle} testId="account-settings">
        <SettingsRow icon="♙" title="Datos personales" />
        <SettingsRow icon="▢" title="Privacidad y datos" />
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-danger/10 text-sm text-danger">
              ↪
            </span>
            <div className="[&_button]:!text-danger">
              <LogoutButton />
            </div>
          </div>
          <p className="text-xs text-ink-muted">{UI_COPY.profileVersionLabel(APP_VERSION)}</p>
        </div>
      </SettingsSection>
    </div>
  );
}
