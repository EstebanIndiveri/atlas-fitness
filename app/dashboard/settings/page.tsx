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
import { UI_COPY } from '@/lib/copy/ui';
import { PWA_COPY } from '@/lib/pwa/copy';
import { TELEGRAM_FE_COPY } from '@/lib/telegram/copy';
import type { AuthProfile } from '@/types/auth';
import type { TodayResponse } from '@/lib/api/today';

type WeeklyActivity =
  | { status: 'loading' }
  | { status: 'loaded'; activeCount: number }
  | { status: 'error' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function parseAuthProfile(value: unknown): AuthProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    id,
    name,
    email,
    telegramUserId,
    createdAt,
    activeTrainingPlanId,
  } = value;
  if (
    !isPositiveInteger(id) ||
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    (telegramUserId !== null && typeof telegramUserId !== 'string') ||
    typeof createdAt !== 'string' ||
    Number.isNaN(Date.parse(createdAt)) ||
    (activeTrainingPlanId !== null && !isPositiveInteger(activeTrainingPlanId))
  ) {
    return null;
  }

  return { id, name, email, telegramUserId, createdAt, activeTrainingPlanId };
}

async function fetchWeeklyActiveCount(): Promise<number> {
  const response = await fetch('/api/stats/week');
  if (!response.ok) {
    throw new Error('Weekly activity request failed');
  }
  const body: unknown = await response.json();
  if (
    !isRecord(body) ||
    typeof body.activeCount !== 'number' ||
    !Number.isInteger(body.activeCount) ||
    body.activeCount < 0 ||
    body.activeCount > 7
  ) {
    throw new Error('Weekly activity response is invalid');
  }
  return body.activeCount;
}

function formatMembershipDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return 'No disponible';
  }
  const monthAndYear = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Cordoba',
  }).format(date);
  return `Desde ${monthAndYear}`;
}

function planGoalFromToday(today: TodayResponse | null, activePlanId: number): string | null {
  if (!today || today.kind === 'no_plan' || today.trainingPlanId !== activePlanId) {
    return null;
  }
  return today.planGoal;
}

function profileStatusLabel(today: TodayResponse | null, activePlanId: number | null): string {
  if (activePlanId === null) {
    return 'Sin plan activo';
  }
  if (!today || today.kind === 'no_plan' || today.trainingPlanId !== activePlanId) {
    return 'Plan activo';
  }

  const goal = planGoalFromToday(today, activePlanId);
  const routine = today.kind === 'workout' ? today.routineName : null;
  if (goal && routine) {
    return `Plan activo · ${goal} · ${routine}`;
  }
  if (goal) {
    return `Plan activo · ${goal}`;
  }
  if (routine) {
    return routine;
  }
  return 'Plan activo';
}

function trainingPlanDescription(
  today: TodayResponse | null,
  activePlanId: number | null,
): string {
  if (activePlanId === null) {
    return 'Sin plan activo';
  }
  const goal = planGoalFromToday(today, activePlanId);
  return goal ? `Objetivo del plan: ${goal}` : 'Plan activo';
}

function pwaStateLabel(isStandalone: boolean, canInstall: boolean): string {
  if (isStandalone) {
    return 'Activa';
  }
  return canInstall ? 'Disponible' : 'No instalada';
}

export default function SettingsPage() {
  const [user, setUser] = useState<AuthProfile | null>(null);
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivity>({ status: 'loading' });
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { code, loading, error, requestCode } = useLinkCode();
  const { canInstall, isStandalone } = useInstallPrompt();

  useEffect(() => {
    let active = true;
    void fetchWeeklyActiveCount()
      .then((activeCount) => {
        if (active) {
          setWeeklyActivity({ status: 'loaded', activeCount });
        }
      })
      .catch(() => {
        if (active) {
          setWeeklyActivity({ status: 'error' });
        }
      });

    const load = async () => {
      try {
        const [profileResult, todayResult] = await Promise.allSettled([
          fetch('/api/auth/me'),
          fetchToday(),
        ]);
        if (active && todayResult.status === 'fulfilled') {
          setToday(todayResult.value);
        }
        if (!active) {
          return;
        }
        if (profileResult.status === 'rejected' || !profileResult.value.ok) {
          setLoadError(TELEGRAM_FE_COPY.loadError);
          return;
        }
        const profile = parseAuthProfile(await profileResult.value.json());
        if (!profile) {
          setLoadError(TELEGRAM_FE_COPY.loadError);
          return;
        }
        setUser(profile);
      } catch {
        if (active) {
          setLoadError(TELEGRAM_FE_COPY.loadError);
        }
      } finally {
        if (active) {
          setLoadingUser(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
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

  const profileStats = [
    { label: 'EN ATLAS', value: formatMembershipDate(user.createdAt) },
    {
      label: 'DÍAS ACTIVOS ESTA SEMANA',
      value: weeklyActivity.status === 'loaded'
        ? `${weeklyActivity.activeCount} de 7 días`
        : weeklyActivity.status === 'loading'
          ? 'Cargando…'
          : 'No disponible',
      description: 'Entreno finalizado o check-in',
      error: weeklyActivity.status === 'error'
        ? 'No pudimos cargar tu actividad semanal.'
        : null,
    },
  ] as const;
  const pwaStatus = pwaStateLabel(isStandalone, canInstall);
  const planHref = user.activeTrainingPlanId === null
    ? '/dashboard/plan/new'
    : `/dashboard/plan/${user.activeTrainingPlanId}`;

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

      <ProfileHeaderCard
        user={user}
        statusLabel={profileStatusLabel(today, user.activeTrainingPlanId)}
        stats={profileStats}
      />

      <SettingsSection title={UI_COPY.profileMiAtlasTitle} eyebrow="ENTRENAMIENTO & HÁBITOS">
        <ProfileCoachContext />
        <SettingsRow
          icon="▤"
          title="Plan de entrenamiento"
          description={trainingPlanDescription(today, user.activeTrainingPlanId)}
          href={planHref}
          testId="training-plan-settings"
        />
        <SettingsRow
          icon="▣"
          title="Rutinas"
          description="Explorá y organizá tus rutinas"
          href="/dashboard/routines"
          testId="routines-settings"
        />
        <SettingsRow
          icon="♧"
          title={UI_COPY.profileHabitsTitle}
          description="Ver actividad y hábitos"
          href="/dashboard/habits"
          testId="habits-settings"
        />
      </SettingsSection>

      <ProfileTelegramCard
        linked={Boolean(user.telegramUserId)}
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
