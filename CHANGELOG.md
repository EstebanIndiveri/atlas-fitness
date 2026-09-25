# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Este repo versiona el estado del producto y de la documentación; cada entrada se limita a comportamiento verificable en el código.

## [Unreleased]

_Sin cambios de producto sin publicar. La última versión publicada es `v0.6.2`._

## [0.6.2] - 2026-09-24

### Changed
- Cierre formal de la wave de estabilización post v0.6.1: consolida la estabilidad de las pruebas E2E y la documentación operativa. Release de testing/documentación, sin nuevas funcionalidades ni cambios de comportamiento de producto.

## [0.6.1] - 2026-09-23

Fixes UX/UI reportados en dispositivo real (iPhone) + convergencia Figma (nodos `12:1830` player, `8-1413` hero). Tres áreas resueltas por subagentes en paralelo con ownership de archivos disjuntos.

### Fixed
- Player guiado — CTA "Completar serie" ahora es un botón verde brand con ícono check-in-circle (antes botón casi negro con un glifo tipo "prohibido"); `aria-label` en texto plano (`components/session/SessionCompleteSetBar.tsx`).
- Player guiado — el timer de descanso se muestra como barra fija inferior mientras se descansa y oculta la CTA, de modo que el contador queda siempre visible sin scrollear; en mobile las acciones ya no se superponen al timer (`components/session/RestTimer.tsx`, `app/dashboard/session/[workoutId]/page.tsx`, `components/session/GuidedExerciseCard.tsx`).
- Player guiado — estados de serie con círculos (check verde para completada, punteado para pendiente); sin inventar historial de sesiones previas (`components/session/SetCheckList.tsx`).
- Hoy — el check-in de ánimo dejaba la card seleccionada en blanco-sobre-claro por un conflicto de `cn()` (base `bg-canvas` + activo `bg-brand`, sin `tailwind-merge`); resuelto moviendo el color base al branch inactivo. Mismo fix en los botones de energía (`components/today/MoodEnergyCheckIn.tsx`).
- Hoy — la sección de hábitos ya no recorta controles en mobile (`min-w-0`/overflow + targets de 44px) (`components/today/TodayHabitsCard.tsx`, `HabitPreviewRow.tsx`, `HydrationHabitRow.tsx`).
- Perfil — "Equipamiento disponible" muestra el valor real elegido en onboarding (lectura SSR-safe en `useEffect`) y enlaza al plan builder; se removieron las filas "Preferencias de Coach" y "Notificaciones y recordatorios" (diferidas a backlog) (`app/dashboard/settings/page.tsx`).

### Added
- Player guiado — acción "Añadir serie" funcional: `addSet()` en `useGuidedSession` incrementa `targetSets` del ejercicio actual (cap 12), cableado page→card→checklist (`hooks/useGuidedSession.ts`, `components/session/SetCheckList.tsx`).

### Changed
- Hero de Hoy convergido a Figma `8-1413`: eyebrow + pills (tipo/equipo), título serif sin cortes, callout "Por qué hoy", métricas reales (ejercicios/series, sin duración inventada) y barra "AVANCE DE HOY" con track legible incluso en estado 0 (`components/today/TodayWorkoutHero.tsx`, `TodayWorkoutHeroParts.tsx`).

## [0.6.0] - 2026-09-22

### Added
- Generación de plan semanal asistida por Coach Atlas: `lib/ai/weekly-plan-draft.ts` + `lib/ai/weekly-plan-prompt.ts`. Usa Gemini cuando hay `GEMINI_API_KEY` y cae a un draft determinístico sobre catálogo real cuando no hay key, hay timeout, error HTTP, JSON malformado o draft inválido. Valida IDs del catálogo, `dayOfWeek` 0–6 y limita texto. Backward-compatible con el wizard guiado (campo opcional `source: 'gemini' | 'fallback'`).
- `CHANGELOG.md` y handoff operativo `docs/backlog/handoff-2026-09.md`.

### Changed
- Hoy (`/dashboard/today`) converge al diseño Figma: header/saludo, check-in ánimo/energía, hero de entrenamiento, Coach Atlas, hábitos diarios y consistencia semanal, con sourcing de datos honesto (`app/dashboard/today/page.tsx`, `components/today/**`).

### Fixed
- Se restauró el contrato `streak-chip`/`current-streak`/`longest-streak` y la copy de estado cero ("Todavía no tenés racha") en la card de semana, que la convergencia de Hoy había quitado y rompía el golden-path E2E (`components/today/TodayWeekCard.tsx`).

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
