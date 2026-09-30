# Handoff — Atlas Fitness · estado operativo y release (Septiembre 2026)

> **Documento de checkpoint operativo.** Es la fuente de verdad para que un agente o persona entienda el estado del proyecto, qué está hecho/released, qué quedó diferido en backlog y cómo continuar. Snapshot: **2026-09-27**. v0.7.0 se publicó mediante el PR #126 y el tag `v0.7.0` apunta al commit `dae2bc949538f9cb9fa02faf8db0712d04b9d9f9`. Los cambios de producto v0.7.1 se integraron mediante el PR de release #138, fusionado en `main` como `ba0857c5c42f730263e2d735ff57e69f6b0d42ea`; al snapshot de ese momento, `package.json` y `package-lock.json` estaban en 0.7.1 (al cierre de la última publicación están en 0.9.0, ver las actualizaciones posteriores). Esta PR finalizó la metadata documental. El tag anotado `v0.7.1` se creó y publicó sobre `e1a592cb1aa9d26205933e2301b9926b9b834aa0`, el commit final de `main` de ese merge de metadata (#139), no sobre `ba0857c`. (Al snapshot indicado, aún no existía.) El CI post-merge del candidato desde `develop` (run 36201073118) pasó. No hubo cambios de migraciones desde el tag v0.7.0.

> **Actualización posterior (snapshot 2026-09-28).** Se publicó **v0.9.0 "Hábitos & Adherence"**: el release PR #168 se fusionó en `main` y el tag anotado `v0.9.0` apunta a `0cd7a1a250cbdbf81f4897af129274524222a206`, con `package.json` y `package-lock.json` en 0.9.0; el back-merge a `develop` se completó en el PR #169. Su trabajo de producto (actividad de hábitos registrada) había quedado integrado en `develop` mediante los PR #163–#165 y #167, y la publicación anterior es **v0.8.0** (release PR #160, tag anotado sobre `44c0bbfca8f52995f7a850b997118814e27b3043`). El bloque histórico de abajo conserva sus fechas y cifras originales como evidencia de sus propias waves; para el estado vigente valen §5–§7 y §9.

> **Actualización posterior (snapshot 2026-09-29).** Se publicó **v0.10.0 "Días objetivo de hábitos"**: el release PR #186 (`chore(release): v0.10.0`, `release/0.10.0` → `main`, head `8bad403645d3cc41afbca9267d0030e139a801ac`) se fusionó en `main` mediante merge normal (no squash), dejando el merge commit `531bf0706355763885c9798fc012a5eb6bbc0298`; el tag anotado `v0.10.0` (objeto `a03d0591f172f87a8b3410a2e003d614dba38a31`) apunta a ese commit y `package.json`/`package-lock.json` quedaron en **0.10.0**. La publicación anterior es **v0.9.0** (release PR #168, tag anotado sobre `0cd7a1a250cbdbf81f4897af129274524222a206`). La evidencia de release (migración de producción, deployment Vercel y smoke) está en §6; el bloque histórico de abajo conserva sus fechas y cifras originales.

> **Actualización posterior (snapshot 2026-09-29).** El trabajo de **v0.11.0 "Memoria de ejercicio"** (workstreams A–F) está **integrado y revisado en `develop`, pero NO publicado**. No es un release: no hay PR de release, no existe tag `v0.11.0`, `package.json`/`package-lock.json` siguen en **0.10.0** y la última versión publicada es **v0.10.0**. La verdad documentada y su matriz claim→evidencia están en la sección **"Wave v0.11.0 — implementada en `develop`, NO publicada"** de §6. El plan de release (§30 del brief v0.11) no se ejecutó.

> **Actualización posterior (snapshot 2026-09-29).** Se publicó **v0.11.0 "Memoria de ejercicio"**: el release PR #197 (`chore(release): v0.11.0`, `release/0.11.0` → `main`, head `a8c9bc95aec95f5398a5de0cff4afcb91a83fc78`) se fusionó en `main` mediante merge normal (no squash), dejando el merge commit `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e`; el tag anotado `v0.11.0` (objeto `eb2aab85a7739b0caa454726f230784f2ae92424`, target pelado `27fe2a0`) apunta a ese commit y `package.json`/`package-lock.json` quedaron en **0.11.0**. La migración aditiva `0024_workout_exercise_notes` (cero backfill) corrió en el gate pre-merge (run 36659772672) y post-merge sobre `main` (run 36659836574), ambas `SUCCESS`; el deployment de producción de Vercel id 6750037524 del commit `27fe2a0` quedó `SUCCESS` y el smoke público sin sesión pasó. No se creó un objeto GitHub Release (tag anotado). **El smoke autenticado de producción NO se ejecutó** (NOT PERFORMED): `qa@atlas.test` es local/CI-only y no existe un procedimiento autorizado de QA autenticado en producción; queda pendiente. La evidencia completa, la matriz claim→evidencia y el resultado de release están en §6.

## 1. Recap producto / visión

Atlas Fitness es un coach de entrenamiento mobile-first: no busca ser un CRUD de rutinas sino un loop de hábito donde el usuario registra cómo está, ve qué toca hoy, puede adaptar la sesión con Coach Atlas, entrena guiado, deja feedback y vuelve a Progreso con datos reales. La visión de [`handoff-atlas-adaptive-core.md`](./handoff-atlas-adaptive-core.md) sigue vigente como norte: **contexto → interpretación → recomendación → acción → aprendizaje**, con una regla central: Coach Atlas propone y explica, nunca inventa ni modifica silenciosamente.

**Límite de lo implementado:** Coach Context no aprende ni infiere preferencias a partir del comportamiento. `goal`, `pace` y `equipment` son valores ingresados explícitamente y guardados por usuario; solo precargan campos editables del brief guiado. No leen historial, check-ins ni biometría, y editarlos no cambia el plan activo.

## 2. Snapshot de arquitectura

Stack y límites están documentados en [`ADR-001`](../architecture/ADR-001-system-stack.md), [`ADR-002`](../architecture/ADR-002-client-channels.md), [`ADR-003`](../architecture/ADR-003-gemini-guided-session.md), [`ADR-004`](../architecture/ADR-004-sessions.md) y [`ADR-005`](../architecture/ADR-005-ownership-catalog.md).

- **Runtime/UI**: Next.js 16 App Router + React 19 + TypeScript strict. Rutas UI en `app/**`; pantallas dashboard en `app/dashboard/**`.
- **API**: route handlers delgados en `app/api/**`, con auth/validación y delegación a services. Patrón: route → validate → auth/session → service → DB/adapters → response; ver [`conventions-be.md`](../engineering/conventions-be.md).
- **Dominio/servicios**: `lib/services/**` concentra casos de uso: planes, Today, workouts, sesión guiada, progreso, Coach adaptation, feedback, hábitos.
- **IA/adapters**: `lib/ai/**` contiene Gemini/fallbacks. Gemini debe ser server-side; sin key o con error no bloquea el flujo.
- **Componentes**: `components/**` está organizado por dominio (`today`, `session`, `plan`, `progress`, `training`, `profile`, `onboarding`, `shell`, `ui`). Hooks compartidos viven en `hooks/**`.
- **DB**: `lib/db/**` usa Drizzle + Turso/libSQL. `lib/db/schema.ts` define auth sessions, catálogo, rutinas, workouts, planes, preferencias de usuario (`goal`, `pace`, `equipment`), guardados idempotentes de planes guiados, feedback, hábitos, Telegram, etc.
- **Coach Context**: `GET/PUT /api/profile/preferences` operan sobre la sesión autenticada. `hasSavedPreferences` indica si existe una fila, no si algún campo tiene valor: fila ausente devuelve `false` y tres `null`; una fila guardada con los tres `null` devuelve `true`.
- **Tipos compartidos**: `types/**`, incluyendo contratos de métricas (`types/metric.ts`) y errores tipados.
- **Canales**: PWA como cliente Must; Telegram bot/webhook modular como segundo canal. Expo queda post-PMF según ADR-002.

## 3. DATA-HONESTY rule

Regla: ninguna métrica, score, número visible, biometría o recomendación se muestra sin fuente real. La regla está bajada a tipos en [`types/metric.ts`](../../types/metric.ts): `Metric<T>` exige `source` (`user_input`, `atlas_computed`, `external_integration`, `ai_recommendation`). [`components/ui/MetricValue.tsx`](../../components/ui/MetricValue.tsx) renderiza valores solo con `Metric<ReactNode>`; el test incluso rechaza bare values con `@ts-expect-error`.

Aplicación práctica:

- Empty states compartidos en [`lib/copy/empty-states.ts`](../../lib/copy/empty-states.ts): sin plan, sin historial, sin check-in, IA indisponible.
- Today usa estados honestos para no_plan/rest_day/routine_missing y métricas computadas con `metric(..., 'atlas_computed')` en [`components/today/TodayWorkoutHero.tsx`](../../components/today/TodayWorkoutHero.tsx).
- Progreso no inventa consistencia de hábitos: la card que presentaba un empty state como si fuera una medición se **eliminó** (hoy [`components/progress/ProgressInsightCards.tsx`](../../components/progress/ProgressInsightCards.tsx) exporta solo `StrengthEvolutionCard` y `WellbeingCard`), y la actividad de hábitos se lee como actividad **observada** por período — días con registro sobre días transcurridos — sin metas, adherencia ni porcentaje de cumplimiento. El “today-only context” quedó declarado en el copy de la card de bienestar ([`lib/copy/progress.ts`](../../lib/copy/progress.ts), `wellbeing.windowLabel`), porque esa métrica sí es de hoy y no se acumula con el período elegido.
- `dayReason` no toma notas libres del usuario: [`lib/services/day-reason.ts`](../../lib/services/day-reason.ts) construye copy determinístico con energía, ánimo, descanso previo y objetivo real.

## 4. Golden-path DoD status

Estado del recorrido **onboarding → today → start/adapt → guided session → post-workout → progress**:

1. **Onboarding**: wizard de 4 pasos, opciones accesibles y CTA sticky en [`components/onboarding/OnboardingWizard.tsx`](../../components/onboarding/OnboardingWizard.tsx). Finish guarda respuestas localmente y sincroniza con el perfil autenticado; si la llamada devuelve 401, conserva el uso local y continúa. Skip solo marca onboarding completo y navega a Hoy, sin sincronizar preferencias.
2. **Coach Context / perfil**: la sección Preferencias de Coach permite revisar, editar y guardar explícitamente `goal/pace/equipment`; editar no muta el plan activo. Respuestas legacy del navegador solo se importan luego de vista previa y confirmación si no existe fila de servidor. La importación usa alta condicional, por lo que una fila concurrente o una fila explícita con tres `null` no se reemplaza.
3. **Today**: **convergido a Figma y released (v0.6.0/v0.6.1)**. [`app/dashboard/today/page.tsx`](../../app/dashboard/today/page.tsx) compone header, check-in ánimo/energía, hero, Coach, hábitos, semana e install toast. En v0.6.1 se corrigieron regresiones de dispositivo real: contraste del ánimo seleccionado, overflow de hábitos y hero/progress bar.
4. **Start/adapt**: Hoy y Entrenar pueden iniciar rutina programada; Adaptar navega a `/dashboard/session/adapt` con rutina/objetivo. Coach adaptation existe con preview/apply y fallback.
5. **Guided plan / generación**: al abrir el brief se leen preferencias guardadas y se precargan solo los campos no nulos; `days-5` se muestra como `5` editable. La lectura no genera ni guarda. El endpoint de generación exige autenticación, valida el brief y carga el catálogo visible del usuario en el servidor. La revisión muestra la fuente Gemini/fallback, el objetivo y el contenido real del borrador (días, focos, ejercicios, series/repeticiones); no muestra una razón personalizada por día ni afirma señales de historial, check-in, equipo garantizado o aprendizaje. Guardar es explícito y la creación de plan/rutinas/horario se realiza en una transacción con clave idempotente.
6. **Guided session**: completo y responsive: header, ejercicio activo, Técnica/media, Notas, set table, rest/skip/hold y CTA de completar serie (`components/session/**`, `app/dashboard/session/[workoutId]/page.tsx`). En v0.6.1: CTA verde con check, timer de descanso como barra fija siempre visible, "Añadir serie" funcional (`addSet()` cap 12) y estados de serie con círculos; sin inventar historial previo.
7. **Post-workout**: feedback post-workout y close summary existen en services/routes/componentes de sesión.
8. **Progress**: pantalla Progreso Figma-aligned con interpretación, resumen, consistencia semanal, fuerza, bienestar, **actividad de hábitos registrada** y sesiones recientes en [`app/dashboard/progress/page.tsx`](../../app/dashboard/progress/page.tsx). La actividad de hábitos se reporta como días con registro sobre días transcurridos del período, con fuente declarada; no hay metas, adherencia ni porcentaje. El registro día por día vive en la pantalla de Hábitos ([`app/dashboard/habits/page.tsx`](../../app/dashboard/habits/page.tsx)).

DoD funcional: el loop principal y Coach Context están incluidos en la release v0.7.0. Las cifras E2E anotadas abajo son evidencia histórica de sus respectivas waves y no deben presentarse como una corrida de la suite sobre el estado actual. Para futuras waves, el DoD de release sigue exigiendo revalidación end-to-end, auditoría pre-PR y suite full limpia.

**E2E de PR #114 (evidencia histórica):** las carreras de observación de respuesta/acción fueron corregidas y el golden path quedó estabilizado según la evidencia de esa wave. Resultado registrado entonces: 40 E2E aprobados y 1 omitido intencionalmente; los specs críticos de auth/workouts/session/routines-editor pasaron 51/51 en `repeat-each=3`. RoutineEditor cubre `90 → vacío → 30`. PR #124 agrega `e2e/coach-context.spec.ts`; las cifras de PR #114 no representan una corrida de la suite sobre el estado posterior a #124.

## 5. Entregado v0.3.1 → v0.10.0

- **v0.3.1**: Coach adaptation interpreta freeText (tiempo/fatiga/sin máquinas), motivos trazables, Today completed-state + Adaptar, sesión guiada mobile con set table/notas/CTA fija y fixes de inputs de descanso/sets.
- **v0.3.2**: `dayReason` honesto y determinístico, Progress fixes (chart desde 1 punto, labels/overflow), CTA “Crear con Coach Atlas” en rutinas/plan.
- **v0.4.0**: edición de plan semanal (`GET/PATCH /api/training-plan/[id]`, `/dashboard/plan/[id]/edit`, `usePlanBuilder` edit), wizard guiado de plan semanal, persistencia de rutinas por día con cleanup compensatorio, convergencia Figma de sesión guiada/Progreso/detalle de rutina.
- **v0.5.0**: convergencia Figma de Onboarding, Entrenar hub, Perfil/Settings y bottom nav con iconos + active states.
- **v0.6.0**: convergencia Figma de Hoy home; generación de plan semanal Coach AI (Gemini + fallback determinístico verificable); CHANGELOG + handoff. Fix del contrato `streak-chip` (golden-path E2E).
- **v0.6.1**: fixes UX/UI de dispositivo real + Figma (`12:1830` player, `8-1413` hero): CTA verde+check, descanso siempre visible, "Añadir serie", contraste de ánimo (raíz `cn()` sin tailwind-merge), overflow de hábitos, hero+progress bar, equipamiento real en Perfil y limpieza de filas backlog.
- **v0.7.0 (publicado 2026-09-25, release PR #126)**: incluye el trabajo de Coach Context de los PR #118–#124: preferencias `goal/pace/equipment` persistidas por usuario; Finish de onboarding sincroniza y Skip no; importación legacy con preview, confirmación y protección condicional de filas existentes; edición explícita en Perfil sin cambiar el plan activo; precarga editable del brief guiado; generación semanal autenticada con atribución Gemini/fallback; guardado explícito e idempotente. Ver límites en §6–§7.
- **v0.7.1 (PR #130–#137 integrados por el release PR #138)**: pantalla dedicada de Hábitos; hub del plan semanal activo y mejora con comparación/confirmación explícita; Mi Atlas basado en preferencias guardadas y actividad real; inicio de entrenamientos adaptados desde Hoy y persistencia del check-in, ejercicios omitidos y objetivos reducidos al reanudar; corrección de overflow móvil de los controles de ánimo. Los metadatos de publicación quedaron finalizados y `v0.7.1` se publicó con el tag anotado sobre `e1a592cb1aa9d26205933e2301b9926b9b834aa0`.
- **v0.8.0 (publicado)**: el release PR #160 se fusionó en `main` y el tag anotado `v0.8.0` apunta a `44c0bbfca8f52995f7a850b997118814e27b3043`, con `package.json` y `package-lock.json` en 0.8.0. Contenido de producto: ciclo de vida del plan y alcance de rutinas por plan (#141–#153), persistencia del onboarding por cuenta (#143), construcción de borradores de rutina validados (#142), edición de propuestas de rutina del Coach antes de crearlas (#144), capa de estrategia que compone propuestas semanales coherentes (#153) y cobertura E2E del plan guiado, preferencias de perfil y ownership.
- **v0.9.0 (publicada)**: actividad de hábitos registrada de punta a punta — dominio puro y loader acotado (#163), endpoint de solo lectura con cliente tipado (#164) y lectura en pantalla: card en Progreso y registro día por día con selector de período semana/mes/trimestre en Hábitos (#165). Se reporta actividad observada (días con registro sobre días transcurridos), sin metas ni porcentaje de cumplimiento, y la card “Hábitos consistentes” se eliminó por presentar un empty state como medición. El input de actividad de hábitos al Coach y al brief del plan (workstream D) **no se construyó** y sigue como `Should`. La prueba end-to-end de estas pantallas quedó cubierta por `e2e/habit-activity.spec.ts` (20 casos) en el PR #167.
- **v0.10.0 (publicado 2026-09-29)**: días objetivo de hábitos — intención explícita versionada por días de la semana con vigencia Córdoba y sin backfill (`habit_target_schedules`/`habit_target_days`, migración `0023_habit_target_schedules`); create/update/deactivate explícitos con conflicto optimista `{ targetId, version }` (`409`); cumplimiento `N de M días objetivo` con `configurationState`/`metricState` independientes y `no_expected_days` sin ratio; configuración y señal "Objetivo de hoy" en Hábitos; honestidad de Progreso (botones inertes retirados y volumen real por sesión). La actividad v0.9 (`/api/stats/habits`) permanece observacional y sin cambios. El release PR #186 se fusionó en `main` (merge commit `531bf0706355763885c9798fc012a5eb6bbc0298`) y el tag anotado `v0.10.0` apunta a ese commit; evidencia de migración/deploy/smoke en §6. Coach sigue sin aprender y no hay reminders (ver §6). Ver detalle en [`../../CHANGELOG.md`](../../CHANGELOG.md).

Ver [`../../CHANGELOG.md`](../../CHANGELOG.md) para detalle agrupado Added/Changed/Fixed.

## 6. Estado del release y snapshot de base

**Release v0.7.0 (2026-09-25):** el PR #126 se fusionó en `main`; el tag `v0.7.0` apunta a `dae2bc949538f9cb9fa02faf8db0712d04b9d9f9`. Como parte del back-merge, PR #127 fast-forwarded `develop` a ese SHA; al completar esos pasos, `main` y `develop` quedaron sincronizadas en el commit del release. El deployment de producción en [`https://atlas-fitness-655yg94r0-eindi-acme.vercel.app`](https://atlas-fitness-655yg94r0-eindi-acme.vercel.app) sobre ese commit tuvo éxito; la raíz respondió HTTP 200 y el workflow de migración de producción pasó.

**Release v0.7.1 / metadata finalization (snapshot 2026-09-25):** el SHA de entrada de `develop` fue `6996dd8463d2c4b2cf08c40f900639c9ea504eca`; el CI post-merge run 36201073118 pasó Playwright, ESLint, typecheck, Jest y build. El PR de release #138 se fusionó en `main` como `ba0857c5c42f730263e2d735ff57e69f6b0d42ea`, con `package.json` y `package-lock.json` en 0.7.1. Esta PR de documentación colocó las notas bajo `0.7.1` y finalizó los metadatos. El tag anotado `v0.7.1` se creó sobre `e1a592cb1aa9d26205933e2301b9926b9b834aa0` (no sobre `ba0857c`) y se publicó con push a `origin`. Este repo no publica GitHub Releases. (Al snapshot, el tag aún no existía.) No hay cambios de migraciones desde `v0.7.0` y esta preparación no requiere una migración nueva.

**Publicación v0.10.0 (snapshot 2026-09-29):** **v0.10.0 es la última versión publicada**: el release PR #186 (`chore(release): v0.10.0`, `release/0.10.0` → `main`, head `8bad403645d3cc41afbca9267d0030e139a801ac`) se fusionó en `main` mediante merge normal (no squash), dejando el merge commit `531bf0706355763885c9798fc012a5eb6bbc0298`; el tag anotado `v0.10.0` (objeto `a03d0591f172f87a8b3410a2e003d614dba38a31`) apunta a ese commit, con `package.json`/`package-lock.json` en 0.10.0. La publicación anterior es **v0.9.0** (release PR #168, tag anotado sobre `0cd7a1a`). Este repo publica mediante tag anotado, no mediante GitHub Releases: **no se creó un objeto GitHub Release**. La validación de RC en el head exacto `8bad403` pasó: Jest 253 suites / 1862 tests, typecheck, lint y build; el CI de GitHub run 36579496465 sobre `release/0.10.0` pasó Lint/Typecheck/Test, Playwright E2E y Vercel preview. Migración de producción `0023_habit_target_schedules` (aditiva, sin backfill): gate pre-merge en `release/0.10.0` (workflow "Migrate Production DB", run 36580211527, `SUCCESS`) y confirmación de idempotencia post-merge sobre `main` @ `531bf07` (run 36580447444, `SUCCESS`). Deployment Vercel id 6736930690 del commit `531bf07`, environment Production, `SUCCESS` ([https://atlas-fitness-hg3pm124j-eindi-acme.vercel.app](https://atlas-fitness-hg3pm124j-eindi-acme.vercel.app)). Smoke sin sesión: `/`, `/login`, `/onboarding` = 200; `/dashboard/today` = 307 → `/login`; `GET /api/stats/habits?period=week`, `GET /api/habit-targets` y `GET /api/stats/habit-adherence?period=week` = 401.

**Publicación v0.9.0 (snapshot 2026-09-28):** **v0.9.0 fue la última versión publicada a ese snapshot**: el release PR #168 se fusionó en `main` y el tag anotado `v0.9.0` apunta a `0cd7a1a250cbdbf81f4897af129274524222a206`, con `package.json` y `package-lock.json` en 0.9.0; el back-merge a `develop` se completó en el PR #169 (`develop` @ `e3734c1c9610a97ae5c2f8ac6b32030e3ee449b2`). El contenido es la actividad de hábitos registrada (PR #163–#165 y #167): dominio puro con loader acotado, endpoint de solo lectura con cliente tipado y lectura en pantalla en Progreso y Hábitos. Se reporta **actividad observada** —días con registro sobre días transcurridos—, sin metas ni porcentaje de cumplimiento; el input de actividad de hábitos al Coach (workstream D) **no se construyó** y sigue como `Should`. La prueba end-to-end de las pantallas nuevas la cubre `e2e/habit-activity.spec.ts` (20 casos) en el PR #167. La versión publicada anterior es **v0.8.0** (release PR #160, tag anotado sobre `44c0bbf`). Los números de validación local y de E2E de los párrafos siguientes son evidencia histórica de sus respectivas waves y **no** describen el estado actual.

**Deploy y smoke de producción:** el deployment Vercel de `ba0857c5c42f730263e2d735ff57e69f6b0d42ea` está confirmado como `SUCCESS` en [`https://atlas-fitness-655yg94r0-eindi-acme.vercel.app`](https://atlas-fitness-655yg94r0-eindi-acme.vercel.app). Smoke confirmado: `/`, `/login` y `/onboarding` respondieron HTTP 200; `/dashboard/today` respondió 307 a `/login`, como se espera sin sesión. Esto valida el deploy, no la existencia del tag ni de un GitHub Release.

**Validación local de la preparación:** con Node 22.22.1, Jest pasó 221 suites / 1.320 tests, typecheck y build pasaron; lint terminó con 0 errores y 1 warning preexistente en `lib/api/habits.test.ts:48`. El build conserva el warning preexistente `MODULE_TYPELESS_PACKAGE_JSON` para `tailwind.config.ts`.

**Snapshot histórico previo al release:** el `HEAD` de trabajo y `origin/develop` estaban en `6552667a37329799bb1d644534072c4f58f50fe0`, con PR #118–#124 integrados. Ese SHA documenta la base anterior al release, no el estado actual de `main` o `develop`; en ese snapshot v0.6.2 era la última versión publicada y Coach Context aún no estaba publicado.

**Salud del repo:** los resultados de typecheck/build, Jest 198 suites / 1126 tests, E2E 40 aprobados / 1 omitido intencionalmente y specs críticos 51/51 en `repeat-each=3` son evidencia histórica de PR #114.

**Validación de PR #124:** los checks de GitHub `Lint, Typecheck, and Test` y `Playwright E2E Tests` pasaron. La validación local de F registró Playwright E2E con 43 aprobados y 1 omitido esperado, typecheck aprobado y lint con 0 errores y un warning conocido. No se consigna una cifra de Jest separada ni un resultado de build para esta validación.

**Incluido en v0.7.0**: preferencias de Coach autenticadas y persistidas; onboarding Finish/Skip con sincronización diferenciada; importación legacy confirmada y no destructiva; edición en Perfil; prefill editable del brief guiado; generación autenticada con Gemini opcional/fallback visible; guardado de plan explícito, atómico e idempotente. PR #114 conserva evidencia histórica de sus pruebas; no representa una corrida de la suite sobre la wave v0.7.0.

**Paso a paso para retomar (nuevo agente o persona)**:

1. Leé este handoff + [`AGENTS.md`](../../AGENTS.md) + los ADRs relevantes antes de tocar código.
2. Node 20 (CI usa 20). En este entorno: `export PATH=$HOME/.nvm/versions/node/v20.15.0/bin:$PATH`. Instalá con `npm install` y, para datos locales, `npm run setup:local` (usuario `qa@atlas.test`).
3. Verificá el baseline con binarios de repo-root (no `npx`, que reinstala): `node_modules/.bin/tsc --noEmit`, `node_modules/.bin/jest --silent`, `node_modules/.bin/eslint <archivos>`.
4. Elegí un item del backlog (§7). Creá rama con prefijo correcto (`feature/`, `fix/`, `chore/`, `docs/`) desde `develop` actualizado.
5. TDD: escribí el test que falla, implementá lo mínimo, mantené verde. Sin `any`; JSDoc + tipos de retorno en funciones públicas; archivos ~200–250 líneas.
6. Si el trabajo es grande y paralelizable, despachá subagentes con **ownership de archivos disjuntos** (un archivo = un agente); vos orquestás todo el git/PR. Verificá con `git status` que no se pisaron paths.
7. Convergencia Figma: los tools MCP `figma-*` están deferidos — buscá con el tool de búsqueda de tools y llamá `figma-get_screenshot` con el `nodeId` (frames pulidos = serie `12:*`; hero Hoy = `8-1413`). Los subagentes no pueden llamar Figma; el orquestador baja el screenshot y embebe el spec.
8. Auditoría pre-PR obligatoria: full suite verde → agente `code-review` sobre el diff completo → aplicar **todas** las observaciones → re-correr suite → commits Conventional Commits → PR a `develop`.
9. Release: cortar `release/x.y.z` desde `develop`, bump `package.json`, PR a `main` (`--merge`, no squash), tag `vX.Y.Z`, back-merge `main→develop` mediante PR de sync con merge commit (`--merge`, como #161 y #169), verificar prod con `curl` (`/`, `/login`, `/onboarding` = 200; `/dashboard/today` = 307).

### Resultado de release v0.7.0

- [x] PR #118–#124 integrados como trabajo de Coach Context.
- [x] PR #126 fusionado en `main`; tag `v0.7.0` apunta a `dae2bc949538f9cb9fa02faf8db0712d04b9d9f9`.
- [x] PR #127 completó el back-merge por fast-forward; al cierre del release, `develop` quedó en el SHA del tag `v0.7.0`.
- [x] Deployment de producción sobre ese commit exitoso; la raíz respondió HTTP 200 y el workflow de migración de producción pasó.

### Resultado de release v0.9.0

- [x] PR #163–#165 y #167 integrados en `develop` y auditados antes del corte.
- [x] Rama `release/0.9.0` cortada desde `develop` @ `97a532c`; el commit `9957639` finalizó `package.json`, `package-lock.json` y `CHANGELOG.md`.
- [x] Release PR #168 (`chore(release): v0.9.0`) fusionado en `main` con `--merge`; tag anotado `v0.9.0` sobre `0cd7a1a250cbdbf81f4897af129274524222a206`.
- [x] Back-merge `main→develop` con merge commit en el PR #169; `develop` quedó en `e3734c1c9610a97ae5c2f8ac6b32030e3ee449b2`.
- [x] Deployment de producción de `0cd7a1a` en `SUCCESS` ([https://atlas-fitness-9q6lj9eai-eindi-acme.vercel.app](https://atlas-fitness-9q6lj9eai-eindi-acme.vercel.app)); smoke `/`, `/login` y `/onboarding` = 200, `/dashboard/today` = 307 → `/login`, y `GET /api/stats/habits?period=week` = 401 sin sesión.

### Resultado de release v0.10.0

- [x] Workstreams A–F de días objetivo de hábitos integrados en `develop` y auditados antes del corte; validación de RC sobre el head `8bad403645d3cc41afbca9267d0030e139a801ac` (Jest 253 suites / 1862 tests, typecheck, lint y build) y CI run 36579496465 sobre `release/0.10.0` (Lint/Typecheck/Test, Playwright E2E y Vercel preview) en `PASS`.
- [x] Release PR #186 (`chore(release): v0.10.0`, `release/0.10.0` → `main`) fusionado en `main` con merge normal (no squash) en `531bf0706355763885c9798fc012a5eb6bbc0298`; `package.json`/`package-lock.json` en 0.10.0. No se creó un objeto GitHub Release (este repo publica por tag anotado).
- [x] Tag anotado `v0.10.0` (objeto `a03d0591f172f87a8b3410a2e003d614dba38a31`) creado sobre `531bf0706355763885c9798fc012a5eb6bbc0298`.
- [x] Migración de producción `0023_habit_target_schedules` (aditiva, sin backfill): gate pre-merge sobre `release/0.10.0` (run 36580211527, `SUCCESS`) y confirmación de idempotencia post-merge sobre `main` @ `531bf07` (run 36580447444, `SUCCESS`).
- [x] Deployment de producción Vercel id 6736930690 de `531bf07` en `SUCCESS` ([https://atlas-fitness-hg3pm124j-eindi-acme.vercel.app](https://atlas-fitness-hg3pm124j-eindi-acme.vercel.app)); smoke sin sesión: `/`, `/login` y `/onboarding` = 200, `/dashboard/today` = 307 → `/login`, y `GET /api/stats/habits?period=week`, `GET /api/habit-targets` y `GET /api/stats/habit-adherence?period=week` = 401.

### Resultado de release v0.11.0

- [x] Workstreams A–F de "Memoria de ejercicio" integrados y revisados en `develop`; el SHA de implementación al cortar la RC fue `28dad30dc2ebd827bd1fa88dcf986f84f725afd5`. El delta de la RC frente a ese SHA fue solo `package.json`, `package-lock.json` y `CHANGELOG.md`.
- [x] Regresión de RC sobre el head exacto `a8c9bc95aec95f5398a5de0cff4afcb91a83fc78` (Node v20.15.0): `npm ci` pass; typecheck pass; lint pass; **Jest 264 suites / 2023 tests, 0 fallos**; build pass; **Playwright 93 passed / 1 skipped / 0 failed** (19 specs; `e2e/exercise-session-memory.spec.ts` 8/8); y **8 suites / 104 tests focales de v0.11** en verde. CI de GitHub run 36659286884 sobre el PR #197 en `PASS` (Lint/Typecheck/Test, Playwright E2E, Vercel preview).
- [x] Release PR #197 (`chore(release): v0.11.0`, `release/0.11.0` → `main`, head `a8c9bc9`) fusionado en `main` con **merge normal (no squash)** en `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e` (padres `d2e6bc4d9153d8826f049876edf20fde92d21cc8` y `a8c9bc9`); `package.json`/`package-lock.json` en **0.11.0**.
- [x] Tag anotado `v0.11.0` (objeto `eb2aab85a7739b0caa454726f230784f2ae92424`, target pelado `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e`) creado sobre el merge commit. **No se creó un objeto GitHub Release** (este repo publica por tag anotado).
- [x] Migración de producción `0024_workout_exercise_notes` (aditiva: tabla nueva + índices parciales aditivos, cero backfill, sin reescritura destructiva): gate pre-merge sobre `release/0.11.0` (workflow "Migrate Production DB", run 36659772672, `SUCCESS`) y confirmación de idempotencia post-merge sobre `main` @ `27fe2a0` (run 36659836574, `SUCCESS`).
- [x] Deployment de producción Vercel id **6750037524** de `27fe2a0`, environment Production, en `SUCCESS` ([https://atlas-fitness-8tih7vhbe-eindi-acme.vercel.app](https://atlas-fitness-8tih7vhbe-eindi-acme.vercel.app)).
- [x] **Smoke público sin sesión** sobre `27fe2a0`: `GET /`, `/login` y `/onboarding` = 200; `/dashboard/today` = 307 → `/login`; `GET /api/auth/me` = 401; `GET /api/stats/habits?period=week` = 401; `GET /api/habit-targets` = 401; `GET /api/stats/habit-adherence?period=week` = 401; `GET /api/workouts/1/exercises/1/context` = 401; `PUT /api/workouts/1/exercises/1/note` = 401.
- [ ] **Smoke autenticado de producción — NO ejecutado (NOT PERFORMED) y pendiente.** La única cuenta QA documentada (`qa@atlas.test`) es exclusivamente local/CI (`docs/engineering/local-dev.md:204` indica no usarla en producción) y no existe un procedimiento autorizado de QA autenticado en producción. Es el **único ítem no verificado** de este release. No afirmar que se realizó.

### Wave v0.11.0 — implementada en `develop`, NO publicada (snapshot 2026-09-29)

**No es un release.** Los workstreams A–F de "Memoria de ejercicio" están integrados y revisados en `develop` a partir de `11a8c935a6babeb63263fcd94bffc0f8ec3e1fe3` (merge de E), pero **no** se cortó `release/0.11.0`, **no** hay tag `v0.11.0`, **no** se tocó `package.json`/`package-lock.json` (siguen en **0.10.0**) y la última versión publicada sigue siendo **v0.10.0**. El plan de release (§30 del brief) no se ejecutó.

**Tesis entregada (verificada en código y tests):** Atlas permite guardar una nota **explícita** de un ejercicio durante un workout, la persiste con ownership y versión, y al reaparecer el ejercicio devuelve esa nota junto con las **series previas como registros históricos raw**, sin inferir progresión, readiness, significado de dolor ni próxima carga.

**Anclas de merge verificadas** (`git log`): A PR #191 `713a63b575b6f2dbfe72bf5025e29520873ce164`; B PR #192 `de41752041ef6a9622804bf1ff98d080f4b5e8bb`; C PR #193 `3fedd90245af739462459999a2b17f1123a88f74`; D PR #194 `8a42318c47fb861eb032100b71588ed56bbd797c`; E PR #195 `11a8c935a6babeb63263fcd94bffc0f8ec3e1fe3`.

**Matriz claim → evidencia (toda afirmación citada tiene prueba; sin claim sin evidencia):**

| Claim (v0.11, solo lo probado) | Evidencia (path / test / PR) |
|---|---|
| Nota es **input explícito del usuario**, 1–280 puntos de código Unicode, recortada; cota por helper compartido, no por `.length`/`maxLength` | `types/exercise-session-memory.ts`, `lib/session/exercise-session-memory.ts` (`countExerciseNoteCodePoints`, `MAX_EXERCISE_NOTE_CODE_POINTS=280`), `lib/session/exercise-session-memory.test.ts`; PR #191 |
| `WorkoutExerciseNote` con ownership `user/workout/exercise`, `version` monotónica y CAS `{noteId,version}` | `types/exercise-session-memory.ts`, `lib/services/exercise-session-memory.ts` (`putWorkoutExerciseNote`/`deleteWorkoutExerciseNote`), `lib/services/exercise-session-memory.test.ts` (transiciones §17, carreras create/create, update/update, delete/recreate); PR #192 |
| Migración **aditiva, tabla vacía, cero backfill**; índices parciales aditivos en `workouts`/`workout_sets` | `lib/db/migrations/0024_workout_exercise_notes.sql`, `lib/db/schema.ts`, `lib/db/workout-exercise-notes-migration.test.ts`; PR #192 |
| Historial de "última vez" usa índices, sin scan/sort de toda la historia | `lib/db/workout-exercise-notes-query-plan.test.ts` (afirma `workouts_user_id_ended_at_idx` + `workout_sets_exercise_lookup_idx`/tabla de notas y ausencia de `TEMP B-TREE`); PR #192 |
| Nota **inmutable tras cierre**; mutación solo en workout activo | `lib/services/exercise-session-memory.ts` (+ test); E2E caso "a closed workout freezes its note"; PR #192/#195 |
| Series previas = **registros históricos raw** del **mismo y exacto `exerciseId`**, del último workout cerrado/completado/no borrado; excluye workout actual/abierto y borrados | `lib/services/exercise-session-memory.ts` (`loadLastCompletedExerciseSets`), `types/exercise-session-memory.ts`; E2E caso "last completed sets ... exclude the current workout"; PR #192/#195 |
| Nota previa y series previas pueden venir de **workouts distintos con fechas Córdoba independientes** | `types/exercise-session-memory.ts` (`LastCompletedExerciseSets` vs `LastCompletedExerciseNote`), `lib/services/exercise-session-memory.test.ts`; PR #191/#192 |
| API delgada `GET context` y `PUT`/`DELETE note`, `userId` solo de sesión, errores `{code,message}` | `app/api/workouts/[id]/exercises/[exerciseId]/context/route.ts`, `.../note/route.ts`, `.../params.ts` (+ `route.test.ts`); `lib/api/exercise-session-memory.ts` (parser total); PR #193 |
| UI: Notas persistidas con save/delete/conflicto, panel "Última vez" con estados locales; el contexto nunca bloquea el registro de series | `components/session/ExerciseNotePanel.tsx`, `components/session/LastCompletedPanel.tsx`, `hooks/useExerciseSessionMemory.ts`, `components/session/GuidedExerciseCard.tsx` (+ tests); PR #194 |
| Copy de feedback corregido: guarda como parte de la sesión, **no** cambia el plan ni recomienda cargas | `lib/copy/session.ts` (`feedbackHelper`), `lib/copy/session.test.ts`; E2E caso "honest persistence-only feedback copy"; PR #194/#195 |
| E2E no vacío: versión exacta en update/reload/re-auth, CAS obsoleto `409`, cierre inmutable, cross-user, skip/hold con nota retenida, mobile 390px, Unicode 280/281 | `e2e/exercise-session-memory.spec.ts` (8 casos); PR #195 |

**Límites declarados (no describir como shipped):**

- **Sin** afirmación de progresión, PR, e1RM, readiness/recuperación, recomendación de próxima carga, aprendizaje del Coach ni automatización por feedback. Las series/notas son registros, no recomendaciones.
- El feedback post-workout sigue **write-only** salvo su propio GET. Notas y series **no** se envían a Gemini, Telegram, analytics ni otro usuario. El único cambio adyacente a Coach es el copy corregido.
- **DEFER/EXCLUDE** permanecen (ver §7 y §24/§25 del brief): historial dedicado por ejercicio, PR/e1RM, load-mode taxonomy, warm-up/drop/superset, RPE/RIR por set, sustitución, read-back/uso del feedback, consumo de historial/hábitos/notas por Coach, gamificación, motion y misiones/quests.
- **Storage/retention sin cambios:** las notas persisten con el historial; soft-delete de un workout excluye sus notas y sets del contexto futuro.

**Validación de esta sincronización (AUTHOR, docs-only, Node 20.15.0):** Jest focal 11 suites / 140 tests verde (6 suites backend/domain/query-plan + 5 suites UI/hook/copy), `tsc --noEmit` limpio. No se ejecutó la suite full ni Playwright en este workstream documental; la evidencia E2E citada pertenece a la wave E. `git diff --stat` toca únicamente `CHANGELOG.md`, `docs/backlog/handoff-2026-09.md` y `docs/backlog/README.md`.

### Checkpoint de desarrollo (2026-09-28) — snapshot histórico posterior a v0.9.0

Snapshot operativo de esa fecha, conservado como historia. Distingue explícitamente la **release publicada a ese snapshot (v0.9.0)** del **baseline de desarrollo** de entonces; la release vigente es **v0.10.0** (ver §6 y el resultado de release arriba). Los párrafos históricos de arriba conservan sus fechas, SHAs y cifras como evidencia de sus propias waves.

**RELEASE PUBLICADA — v0.9.0**

- Última versión publicada. El tag anotado `v0.9.0` apunta a `0cd7a1a250cbdbf81f4897af129274524222a206` (release PR #168; back-merge #169). `package.json` / `package-lock.json` en **0.9.0**.
- El hardening descrito abajo (#174) **no** forma parte del tag v0.9.0: vive solo en `develop`.

**BASELINE DE DESARROLLO — distinción explícita**

Dos cosas distintas que **no** deben confundirse. Un SHA escrito aquí envejece con el próximo merge a `develop`; tratalo como evidencia puntual, no como verdad permanente.

1. **Último baseline pre-checkpoint / con código (LAST PRE-CHECKPOINT / CODE-BEARING BASELINE)** — `1728a14f6e7b04622498de3b0104d72d5ccd8381` (tree `36e6882265347d878d0fe6ea653a28e87c6b3127`). Es el estado de `develop` posterior al #175 y **anterior** al checkpoint documental #176. Sirve como referencia del último estado que contenía código de producto, pero **no** es el HEAD vivo de `develop`.
2. **Baseline de desarrollo vivo (LIVE DEVELOPMENT BASELINE)** — se obtiene con `git fetch origin` + `git rev-parse origin/develop` **inmediatamente antes de iniciar una nueva wave**. No debe asumirse ningún SHA fijo: cambia con cada merge a `develop`.

- `main` → `f4c991df920631e99ff65578921da67d1bcef47e`; **`main` es ancestro de `develop`** (ya no están estructuralmente divergidas).
- `develop` contiene endurecimiento post-release que todavía no está representado por una nueva versión de producto. `package.json` **sigue en 0.9.0** en ambas ramas.

**PR #174 — hardening de DB mergeado (solo develop, no en el tag v0.9.0)**

- `fix(db): esperar el lock de escritura local en lugar de responder SQLITE_BUSY`; merge SHA `a3cb62881bf394d2f9c89aec006d32693773e8d8` (base `develop`). Issue **#172 cerrado / completado** (2026-09-28).
- **Causa raíz:** el libSQL local basado en archivo usaba SQLite con rollback-journal y sin busy timeout efectivo para el cliente de la aplicación; una escritura concurrente podía fallar de inmediato con `SQLITE_BUSY: database is locked` y aflorar como HTTP 500 en E2E.
- **Fix entregado:** configuración centralizada del cliente libSQL; timeout de lock **solo local** para bases `file:`/`memory`; comportamiento remoto de **Turso sin cambios**; `LOCAL_DB_BUSY_TIMEOUT_MS` acotado; app, readiness y migraciones usan la configuración compartida.
- **Evidencia:** Jest 236 suites / 1608 tests; typecheck limpio; lint 0 errores; build verde; Playwright 72 passed / 1 skipped / 0 failed. Stress CI independiente: **10 ejecuciones consecutivas de Playwright, 10/10 exitosas, 0 ocurrencias de `SQLITE_BUSY`**. CI post-merge de `develop`: run `36442823783` success.

**PR #175 — normalización de ancestría (solo estructura de repo)**

- `chore(repo): normalize main ancestry before v0.10.0`; merge SHA = `1728a14f6e7b04622498de3b0104d72d5ccd8381`.
- Solo ancestría: **0 archivos cambiados, 0 adiciones, 0 borrados**; el tree de `develop` no cambió (`36e6882`). Efecto: `main` pasa a ser ancestro de `develop`.

**PR #176 — checkpoint documental post-v0.9.0 (solo docs)**

- `docs: checkpoint post-v0.9.0 hardening before v0.10.0`; merge SHA = `8ab59ba181a1c03df6107984dc956bc7be6a8b61`.
- Solo documentación: 1 archivo cambiado (`docs/backlog/handoff-2026-09.md`), 44 inserciones, 0 borrados; sin cambios de código, tests, configuración ni metadata.
- **Evidencia histórica de checkpoint:** tras el merge del PR #176, `develop` quedó en `8ab59ba181a1c03df6107984dc956bc7be6a8b61`. Ese SHA es evidencia puntual del checkpoint y **no debe asumirse como HEAD vigente para siempre**: toda wave futura debe releer `origin/develop` en vivo.

**Deuda técnica residual — DEFERRED / NON-BLOCKING**

No se corrige en este checkpoint y **no** se convierte en MUST de v0.10.0:

1. `drizzle.config.ts` / drizzle-kit no hereda el busy timeout local.
2. No hay migración a WAL.
3. No hay capa de retry de DB.
4. El E2E sigue compartiendo `file:./local.db` en lugar de aislar DB por spec/worker.

**WAVE v0.10.0 — PUBLICADA (release 2026-09-29)**

- v0.10.0 ("días objetivo de hábitos") está **publicada**: los workstreams A–F se integraron en `develop` y el release PR #186 se fusionó en `main` mediante merge normal (no squash), dejando el merge commit `531bf0706355763885c9798fc012a5eb6bbc0298`; el tag anotado `v0.10.0` (objeto `a03d0591f172f87a8b3410a2e003d614dba38a31`) apunta a ese commit y `package.json`/`package-lock.json` quedaron en **0.10.0**. Evidencia de migración, deployment y smoke en §6.
- Baseline de esta wave: `0758166a55380796b79402f872d181a6a5f1a3ea` (merge final de F sobre `develop`). Es evidencia puntual; toda wave futura debe releer el HEAD vivo de `origin/develop`.
- **Qué se entregó (verificado en código y tests):**
  - Intención explícita versionada por días de la semana con vigencia Córdoba y sin backfill (`lib/db/migrations/0023_habit_target_schedules.sql`, `lib/db/schema.ts`, `lib/services/habit-targets.ts`).
  - Create/update/deactivate explícitos con conflicto optimista `{ targetId, version }` (`409`), reemplazo del mismo día, cancelación transaccional de una versión creada hoy y preservación de historia (`lib/services/habit-targets.ts`, `app/api/habit-targets/**`).
  - Cumplimiento `N de M días objetivo` con `configurationState`/`metricState` independientes y `no_expected_days` sin ratio (`lib/services/habit-target-adherence.ts`, `types/habit-adherence.ts`, `app/api/stats/habit-adherence/route.ts`, `components/progress/HabitTargetAdherenceCard.tsx`).
  - Configuración y read-back en Hábitos, señal "Objetivo de hoy" y marks diarios (`components/habits/**`, `components/today/TodayHabitsCard.tsx`, `hooks/useHabitTargets.ts`, `hooks/useHabitAdherence.ts`).
  - Honestidad de Progreso: botones inertes retirados y volumen real por sesión (`components/progress/ProgressHeader.tsx`, `lib/services/progress-summary.ts`, `components/progress/RecentSessionsCard.tsx`).
  - Evidencia E2E del loop completo en `e2e/habit-targets.spec.ts` (13 casos: configuración/persistencia, contrato de cumplimiento, aislamiento cross-user, honestidad de Progreso y golden path mobile).
- **Qué NO se entregó (sigue `DEFER`/`EXCLUDE`, no describir como shipped):**
  - `DEFER`: hábitos creados/renombrados/reordenados por el usuario; targets cuantitativos (litros, minutos, pasos); reminders, quiet hours y push/email/Telegram nudges; backdating/corrección histórica; hábitos dentro del streak existente; Coach/Plan consumiendo activity o adherence; context assembler de preferencias/plan/historia; eliminar hardcodes de improve-plan; bienestar histórico en Progress; DB tooling residual y branch protection.
  - `EXCLUDE`: gamificación (quests, XP, niveles, badges, recompensas, Liftoff parity); composite habit+training scores; inferir targets desde registros pasados; mutación silenciosa por AI/cron; release/version bump dentro de la implementación de features.
  - **Coach no aprende**: v0.10 no agrega inputs de adherence a Coach ni cambia prompts/adapters; los schedules son intención explícita, no aprendizaje. **No hay soporte de reminders.**
- **Regla durable**: no describir ninguna entrada planificada (`DEFER`/`EXCLUDE`) como publicada. La versión publicada es **v0.10.0** y `package.json`/`package-lock.json` están en **0.10.0**; la versión publicada anterior es **v0.9.0**.

## 7. Backlog restante

### Alto impacto / próximo

- La estabilidad E2E del golden path quedó verificada por PR #114; no queda como tarea Playwright Must. Si PO/QA requiere una validación manual adicional con datos QA reales (`qa@atlas.test`) y empty states, mantenerla separada de los resultados E2E registrados.
- **Explicación más detallada por día (opcional)**: la revisión ya atribuye Gemini/fallback y muestra el objetivo y el borrador (día, foco, ejercicios, series/repeticiones). Si se amplía, limitar razones a los campos del brief y al contenido generado; hoy no presenta un razonamiento personalizado basado en historial/check-ins.

### Deferred / follow-up (Perfil)

- **Notificaciones y recordatorios**: siguen diferidos; no hay pantalla ni acción real implementada.
- **Input de actividad de hábitos al Coach y al brief del plan (workstream D de v0.9.0)**: diferido. Era `Should` y quedó fuera de la ruta crítica de v0.9.0; su precondición —el read path histórico de actividad— ya existe. Si se retoma, debe presentarse como actividad observada, nunca como adherencia a una meta.

Coach Context no aprende de las preferencias ni modifica el plan activo al editarlas. Los campos son entradas explícitas del usuario y, en el plan guiado, solo inicializan controles editables; generación, revisión y guardado requieren acciones separadas del usuario.

### UX gaps conocidos / validaciones pendientes

- **Defectos de honestidad de datos de Progreso (#3 y #4) — resueltos por v0.10.0 (publicado el 2026-09-29):** los botones de `components/progress/ProgressHeader.tsx` sin acción se retiraron y las sesiones recientes ahora muestran el volumen real por sesión cuando existen sets elegibles, con "Volumen no disponible" solo cuando realmente falta (`lib/services/progress-summary.ts`, `components/progress/RecentSessionsCard.tsx`, evidencia E2E en `e2e/habit-targets.spec.ts`). El defecto **#5 ya estaba cerrado** por el read path histórico de actividad. El registro histórico `deferred-defects-2026-09.md` conserva la evidencia `archivo:línea` y el estado verificado de la wave v0.9.0 como registro de esa wave.
- **Progreso de fuerza — validación QA real pendiente, no bug confirmado:** código y tests sintéticos soportan que una sesión elegible se muestre como “Punto de partida”. Todavía falta validar contra historial QA real. No marcar como resuelto ni como backlog stale.
- Perfil conserva valores "No configurado" por diseño honesto; convertirlos en flows reales solo si PO prioriza.

### Triage no reproducido

- **Persistent Notice:** No reproducido. Reabrir sólo con pantalla/componente/trigger y comportamiento esperado concretos.
- **RoutineEditor descanso:** PR #114 cubre `90 → vacío → 30` en E2E; la afirmación histórica de un `0` no borrable no describe el comportamiento cubierto.

### Bloqueado

- **Branch protection** en `develop`/`main`: requiere permisos de repo admin; no se resuelve desde código. Documentado como riesgo organizacional.

## 8. Guidelines obligatorias para contributors/agentes

Ver [`AGENTS.md`](../../AGENTS.md) antes de tocar código. Resumen operativo:

- **Branching**: trabajo en `feature/*` o `fix/*`; PR a `develop`; release candidate en `release/*`; `main` solo desde RC aprobada. No push directo a `main`/`develop`.
- **TDD**: tests primero para cualquier cambio de comportamiento; cubrir happy path, edge cases y errores.
- **TypeScript strict**: sin `any` injustificado; funciones públicas en `src`/`lib` con tipos explícitos y JSDoc según harness.
- **Arquitectura**: rutas API delgadas; lógica en `lib/services`; componentes UI en dominios; hooks sin JSX; archivos ~200–250 líneas.
- **Subagentes**: paralelizar solo con ownership de archivos disjuntos. Un solo writer coordina git/PR. No dos agentes tocando los mismos paths.
- **Pre-PR**: suite full limpia, auditoría con agente code-review sobre el diff completo, aplicar observaciones, re-ejecutar suite, commit Conventional Commits y PR con causa raíz/solución/tests/auditoría.
- **Data honesty**: toda métrica visible con `Metric<T>`/`MetricValue` o empty state honesto. Prohibidos scores arbitrarios, biometría demo o copy que sugiera datos inexistentes.

## 9. Recomendaciones senior: próximos pasos y riesgos

1. **Estado de la wave**: v0.7.0 fue la última release etiquetada antes de la integración v0.7.1; PR #126 la fusionó en `main` y PR #127 sincronizó `develop` con el SHA del tag. El release PR #138 integró v0.7.1 en `main`; la metadata se finalizó en #139 y el tag anotado `v0.7.1` se creó y publicó sobre ese commit final (`e1a592c`). Después se publicó **v0.8.0** (release PR #160; tag anotado sobre `44c0bbf`) y luego **v0.9.0** (release PR #168; tag anotado sobre `0cd7a1a`), cuyo back-merge a `develop` completó el PR #169. Los resultados E2E de PR #114 son evidencia histórica, no una validación de las waves posteriores; la cobertura end-to-end de v0.9.0 la aporta `e2e/habit-activity.spec.ts` (PR #167).
2. **Tratar IA como enhancer, no dependencia**: el wizard debe ser útil con catálogo real aunque Gemini no responda; Gemini solo puede mejorar selección/texto validado.
3. **Agregar tests de contrato para weekly-plan AI**: catálogo vacío, IDs inválidos de Gemini, respuesta malformada, timeout, no key, días 1–6, foco/equipment raros.
4. **Auditar copy de honestidad**: cualquier “Atlas sabe/aprende/recuperación” debe mapear a datos reales o cambiarse a “Atlas usa tu plan/check-in/historial”. No describir las preferencias guardadas como aprendizaje, ni atribuir la propuesta a datos que el brief no incluye.
5. **Branch protection sigue siendo riesgo organizacional**: documentar como bloqueado hasta que el owner del repo active reglas y CI requerida.
6. **Mantener docs vivas**: actualizar este handoff y changelog en cada release menor; si cambia un contrato público, actualizar ADR/engineering docs relacionados.
7. **Estado de v0.10.0 — publicada (2026-09-29)**: la wave de días objetivo de hábitos (workstreams A–F) se publicó en v0.10.0; el release PR #186 se fusionó en `main` (merge commit `531bf07`), el tag anotado `v0.10.0` apunta a ese commit y `package.json`/`package-lock.json` quedaron en 0.10.0. La versión publicada anterior es v0.9.0. Evidencia de release en §6. No describir ninguna entrada planificada (`DEFER`/`EXCLUDE`) como shipped. La deuda de DB de §6 queda DEFERRED/NON-BLOCKING. La investigación de Liftoff es un input de producto futuro separado y no debe influir silenciosamente en ninguna wave.
