# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Este repo versiona el estado del producto y de la documentación; cada entrada se limita a comportamiento verificable en el código.

## [Unreleased]

### Added
- En progreso: generación de plan semanal asistida por Coach Atlas en `lib/ai/weekly-plan-draft.ts`. El estado actual arma un draft determinístico por día sobre catálogo real y reutiliza `generateRoutineDraft`; el cableado Gemini semanal directo queda en curso y debe conservar fallback determinístico.

### Changed
- Hoy (`/dashboard/today`) está en convergencia Figma en esta wave: la pantalla compone header, check-in ánimo/energía, hero de entrenamiento, Coach Atlas, hábitos, semana e install toast desde `components/today/**`.
- El hero de Hoy navega a adaptación con Coach Atlas en `/dashboard/session/adapt` cuando existe rutina programada (`components/today/TodayWorkoutHero.tsx`, `app/dashboard/today/page.tsx`).

### Fixed
- Se mantiene la regla de honestidad de datos en Hoy: métricas visibles usan `MetricValue`/`metric(...)` y los estados sin plan/rutina no inventan datos.

## [0.5.0] - 2026-09-22

### Added
- Card de instalación PWA en Perfil reutilizando `AppInstallPrompt` y estado `useInstallPrompt`.

### Changed
- Onboarding converge al diseño Figma con wizard de 4 pasos, header, opciones accesibles y CTA sticky (`components/onboarding/OnboardingWizard.tsx`).
- Entrenar (`/dashboard/session`) funciona como hub: hero del entrenamiento de hoy, próximas asignaciones del plan, acciones para crear rutina y lista de rutinas (`app/dashboard/session/page.tsx`).
- Perfil (`/dashboard/settings`) converge a secciones Mi Atlas, Telegram, PWA, cuenta y estado de plan sin inventar métricas (`app/dashboard/settings/page.tsx`).
- La navegación inferior usa cuatro tabs con iconos SVG, estado activo por ruta y labels de producto (`components/shell/AppBottomNav.tsx`, `components/shell/nav-links.ts`).

## [0.4.0] - 2026-09-21

### Added
- Edición de plan semanal: `getTrainingPlanById` y `updateTrainingPlan` en `lib/services/training-plan.ts`; `GET`/`PATCH /api/training-plan/[id]`; pantalla `/dashboard/plan/[id]/edit`; modo edit en `usePlanBuilder` y `PlanBuilderForm`.
- Wizard guiado para crear plan semanal en `/dashboard/plan/guided`, con brief, revisión, persistencia de rutinas por día y creación del plan semanal (`components/plan/guided/**`).
- Limpieza compensatoria de rutinas creadas si falla la persistencia del plan guiado (`components/plan/guided/useGuidedPlan.ts`).
- Link de edición del plan activo desde Entrenar/Rutinas cuando existe `trainingPlanId`.

### Changed
- Sesión guiada converge a Figma: media detrás de Técnica, Notas por ejercicio, inputs de descanso/sets legibles y CTA fija para completar serie (`components/session/**`, `app/dashboard/session/[workoutId]/page.tsx`).
- Progreso converge a Figma con interpretación Atlas, consistencia semanal, fuerza, bienestar, hábitos y sesiones recientes (`app/dashboard/progress/page.tsx`, `components/progress/**`).
- Detalle de rutina conserva inicio/reanudación de sesión guiada y layout alineado con los componentes de entrenamiento (`app/dashboard/routines/[id]/page.tsx`).

## [0.3.2] - 2026-09-20

### Added
- `buildDayReason` genera un motivo determinístico y honesto para el entrenamiento del día con energía, ánimo, descanso previo y objetivo real del plan (`lib/services/day-reason.ts`).

### Changed
- `resolveTodayScheduledRoutine` dejó de exponer notas libres del plan como `dayReason`; ahora usa contexto real y copy determinístico (`lib/services/training-plan.ts`).
- La lista de rutinas muestra CTA “Crear con Coach Atlas” desde los copies de rutinas/plan (`lib/copy/routines.ts`, `lib/copy/plan.ts`).

### Fixed
- Progreso renderiza el gráfico de fuerza incluso con un solo punto real y muestra estado honesto cuando no hay sets (`components/progress/ProgressInsightCards.tsx`).
- La consistencia semanal y labels de progreso se muestran con métricas computadas y sin overflow visual en el layout móvil (`components/progress/WeeklyConsistencyCard.tsx`).

## [0.3.1] - 2026-09-20

### Added
- Adaptación con Coach Atlas interpreta `freeText` para intención de poco tiempo, fatiga o sin máquinas, y devuelve razones trazables/fallbacks determinísticos (`lib/ai/coach/adaptation.ts`, `lib/ai/coach/gemini-adaptation.ts`).
- Estado completado del hero de Hoy con avance de rutina y CTA para repetir si ya se completó (`components/today/TodayWorkoutHero.tsx`).
- Navegación “Adaptar con Coach Atlas” hacia `/dashboard/session/adapt` desde Hoy/Entrenar cuando hay rutina programada.
- Notas locales por ejercicio en sesión guiada (`components/session/GuidedExerciseCard.tsx`).

### Changed
- La tabla/controles de series de sesión guiada se hicieron responsivos y legibles en mobile (`components/session/SetCheckList.tsx`).
- La sesión guiada usa CTA fija inferior para completar serie sin tapar los steppers (`components/session/SessionCompleteSetBar.tsx`).

### Fixed
- Corrección del input de descanso/rutina en el flujo guiado para mantener valores editables y claros durante la sesión (`components/session/RestTimer.tsx`, `components/session/SetCheckList.tsx`).
