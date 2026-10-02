# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Este repo versiona el estado del producto y de la documentación; cada entrada se limita a comportamiento verificable en el código.

## [Unreleased]

## [0.13.0] - 2026-10-02

> **Estado: publicado (2026-10-02).** La wave **v0.13.0 "Visual Identity, Motion & Progress Experience"** está integrada desde `FINAL_DISCOVERY_SHA` `27d2df6a4e6e5ae607698d27e7aa21bfdceadf7a` y pasó la auditoría de diseño gobernada (`atlas-design-audit` v0.2) y sus gates de accesibilidad, responsive, performance y regresión. El release PR #229 (`chore(release): v0.13.0`, `release/0.13.0` → `main`, RC head `a336f685ee99ff595aeb29471fd1896fe3ec807d`) se fusionó en `main` mediante **merge normal (no squash)**, dejando el merge commit `2380205dcbb3c2b77251348755ae619460be084b` (padres `692f0eb5d5af4330c359de6ee6f09ec841dd9cd8` y `a336f68`). La RC se cortó del head de `develop` (`V0_13_READY_SHA` `dbc9aed6084477cd698f6c945cb03165fb73aaed`) y su delta frente a ese SHA fue solo `package.json`, `package-lock.json` y `CHANGELOG.md`; `package.json`/`package-lock.json` quedaron en **0.13.0**. El tag anotado `v0.13.0` (objeto `50f6d3a054b32fbb97f1fede4b3b366536ca2e8d`, target pelado `2380205`) apunta a ese commit. **No se requirió migración de producción** (sin delta de migración/schema desde v0.12.0: `lib/db/**` sin cambios). El deployment de producción de Vercel (id `6812952740`) del commit `2380205`, environment `Production`, quedó en `SUCCESS` ([https://atlas-fitness-9gbkoxeis-eindi-acme.vercel.app](https://atlas-fitness-9gbkoxeis-eindi-acme.vercel.app)). El **smoke público sin sesión** pasó (`/`, `/login`, `/onboarding` = 200; `/dashboard/today` = 307 → `/login`; `GET /api/auth/me`, `GET /api/exercises/1/progression`, `GET /api/workouts/active`, `GET /api/stats/habits?period=week` y `GET /api/habit-targets` = 401) y el **smoke autenticado de producción** (workflow `Production Auth Smoke` run `37033049450`, `mode=smoke`, `release_sha=2380205…`) concluyó `success` con `overallResult: PASS` y recovery/cleanup `PASS` (artefacto `production-smoke-evidence`, id `11237932876`). Evidencia de calidad pre-release: [`docs/operations/2026-10-02-v0.13.0-pre-release-quality-evidence.md`](./docs/operations/2026-10-02-v0.13.0-pre-release-quality-evidence.md); evidencia de ejecución de release: [`docs/operations/2026-10-02-v0.13.0-release-execution-evidence.md`](./docs/operations/2026-10-02-v0.13.0-release-execution-evidence.md). Las entradas de abajo describen comportamiento verificable en el código integrado y sus tests.

### Added

- **Fundación visual v0.13 (A).** `app/globals.css` `@theme` y su espejo `lib/ui/tokens.ts` incorporan roles semánticos (acción, `verified`, neutral/historia, `unknown`, warning, danger) y roles de forma (control/panel/hero/pill) y tipografía (display/title/body/caption/numeric). `lib/ui/roles.ts` declara contratos de composición (`SURFACE_ROLE_CLASS`, `RADIUS_ROLE_CLASS`, `TYPE_ROLE_CLASS`, `FOCUS_RING_CLASS`). El progreso verificado obtiene un acento reservado (`--color-verified`) distinto del verde de acción de marca.
- **Iconografía gobernada (B).** `components/ui/AtlasIcon.tsx` + `components/ui/atlas-icons.ts` definen un set SVG curado (navegación, acciones de sesión, signos de estado) sobre grid 24, stroke 1.9, `currentColor` y `aria-hidden` por defecto. Reemplazan glifos Unicode arbitrarios (`◎ ⇄ ≣ ↺`) en navegación, sesión y estados. Sin paquete de iconos nuevo; los emoji de ánimo quedan como excepción expresiva explícita.
- **Motion CSS por propósito (C).** `lib/ui/motion.ts` espeja las primitivas de `app/globals.css` (`motion-orient`, `motion-confirm`, `motion-progress`, `motion-celebrate`) con duraciones dentro de los rangos aprobados y equivalente bajo `prefers-reduced-motion: reduce`. Sin librería Motion/Framer Motion; sin `transition: all`; sin bucle de atención perpetuo.
- **Progresión verificada (D) y cierre con PR verificado (E).** `components/session/ExerciseProgressionPanel.tsx` presenta los estados del read model v0.12 (`baseline`/`new_pr`/`ties_best`/`below_best`/ausencia/unknown/error) con signos e iconos gobernados y fuente visible, sin deducir PR en el frontend. `components/session/VerifiedPrCelebration.tsx` es la **única** superficie que consume `motion-celebrate`, y solo tras una transición local real `abierto → cerrado` validada contra el read model (`readStatus=ready`, `comparison=new_pr`, workout/serie de la cohorte exacta), con guarda en `sessionStorage` para no repetir la animación al refrescar.
- **`atlas-design-audit` v0.2.** Skill de auditoría de diseño gobernada con Phase 0 de seguridad de fuentes de datos, tiers de evidencia y routing condicional de especialistas.

### Changed

- **Adopción acotada de roles de superficie/forma en rutas prioritarias (PR #226, `fix/v0-13-release-gates`).** Paneles agrupados de Today/Progress/Habits/Settings pasan a `Card level="panel"` (superficie plana con borde sutil); los radios arbitrarios que igualaban un rol se reemplazan por `rounded-panel`/`rounded-hero`; las tarjetas de marca/hero conservan su acento.
- **Accesibilidad del control de período de Progreso.** El `radiogroup` admite Arrow/Home/End con foco móvil (roving tabindex); `SegmentedControl` agrega Home/End y objetivo de 44 px. Controles frecuentes alcanzan el objetivo preferido de 44 px; glifos decorativos de Settings/Coach quedan `aria-hidden`; transiciones crudas quedan cubiertas por `prefers-reduced-motion`.
- **200 % texto (PR #226 y #227, `fix/v0-13-habit-200`).** La identidad de Perfil y el contenido de hábitos envuelven en lugar de truncarse/colapsar; se elimina la lectura duplicada de consistencia y el nombre de ejercicio duplicado en sesión. El `success == brand` queda documentado como alias intencional de finalización genérica (distinto del rol `verified`).

### Not shipped (no describir como parte de v0.13)

- **Sin** Body Map productivo, Three.js, librería Motion/Framer Motion, ilustración decorativa/anatómica de producción, badges, ranks, quests/misiones, widgets, fuente nueva ni paquete de iconos nuevo.
- **Sin** nuevas métricas de progresión ni claims de fuerza, recuperación, readiness, hipertrofia, riesgo de lesión, 1RM o mejora porcentual; **sin** ranking/score/leaderboard; **sin** anillo de PR sin denominador; **sin** confetti por set; **sin** celebración al montar el panel persistente ni replay del PR verificado al recargar.
- Quedan **DEFER/BACKLOG**: refinamientos de routing de `atlas-design-audit` v0.3; migración de radios/superficies en detalle de rutinas y pantallas de session/workout; overflow horizontal de 8 px a 200 % en Progreso; clipping de 200 % en Session (deuda previa a v0.13); `cn()` sin `tailwind-merge`.

## [0.12.0] - 2026-09-30

> **Estado: publicado (2026-09-30).** El release PR #215 (`chore(release): v0.12.0`, `release/0.12.0` → `main`) se fusionó en `main` mediante un **merge normal (no squash)**, dejando el merge commit `16bfea5b250b203c7d039e75857c3cbeb1a95e0d` (padres `7e62d3bf0b33072bf62f1aee3a4e7ab15abd3087` y `edf4071034237d841f45021adfeff0a4fa6ff526`). El candidato se cortó del head de implementación en `origin/develop` `f9528c080003fd681a323dc1fe026a48e4a73761` (merges de PR #209, #210, #211, #212, #213 y #214); el delta de la RC frente a ese SHA fue solo `package.json`, `package-lock.json` y `CHANGELOG.md`. El tag anotado `v0.12.0` (objeto `e1cb8f04b5c780879cd27342ccb30369348c85ee`, target pelado `16bfea5`) apunta a ese commit y `package.json`/`package-lock.json` quedaron en **0.12.0**. La regresión de RC sobre el head exacto `edf4071` (Node v22.23.2) pasó: `npm ci`, typecheck (0 errores), lint (0 errores, 1 warning preexistente en `lib/api/habits.test.ts` ajeno a v0.12), Jest **296 suites / 2351 tests** sin fallos, build, y Playwright **95 passed / 1 skipped / 0 failed**, más `npx jest scripts/production-smoke --runInBand` (14 suites / 105 tests) y 25 suites focales de v0.12 (274 tests). El CI de GitHub sobre el PR #215 (run 36799886674) pasó Lint/Typecheck/Test, Playwright E2E y Vercel preview. La migración `0025_workout_sets_semantics` (aditiva: seis `ADD COLUMN` nullable + índice parcial de cohorte, **cero backfill** semántico, **cero reescritura** de pesos históricos) corrió en el gate pre-merge sobre `release/0.12.0` (workflow "Migrate Production DB", run 36799816542, `SUCCESS`) y se reafirmó post-merge sobre `main` @ `16bfea5` (run 36800194783, `SUCCESS`). El deployment de producción de Vercel (id **6773788073**) del commit `16bfea5`, environment Production, quedó en `SUCCESS` ([https://atlas-fitness-8lpwf92ti-eindi-acme.vercel.app](https://atlas-fitness-8lpwf92ti-eindi-acme.vercel.app)). El **smoke público sin sesión** pasó: `GET /`, `/login` y `/onboarding` = 200; `/dashboard/today` = 307 → `/login`; y las rutas protegidas sin sesión devolvieron 401 (`GET /api/auth/me`, `GET /api/stats/prs`, `GET /api/exercises/1/progression`, `POST /api/workouts/1/sets`, `PATCH /api/workouts/1/sets/1`). El **smoke autenticado de producción** se ejecutó y **PASÓ** (workflow `Production Auth Smoke` run **36800289552**, `workflow_dispatch` desde el SHA confiable de `main` `16bfea5b250b203c7d039e75857c3cbeb1a95e0d`, `mode=smoke`, `release_sha=16bfea5…`): `overallResult: PASS`, target exacto (deployment id `6773788073`, environment `Production`), recovery/cleanup `PASS` (`fixtures_removed`, 0 orphans). Este repo publica mediante tag anotado, no mediante GitHub Releases: no se creó un objeto GitHub Release. La evidencia de release y la matriz claim→evidencia están en [`docs/operations/2026-10-01-v0.12.0-release-execution-evidence.md`](./docs/operations/2026-10-01-v0.12.0-release-execution-evidence.md).

### Added

- **Captura semántica explícita, versionada y additive (`semantic_capture_version=1`).** `workout_sets` agrega columnas nullable `semantic_capture_version`, `load_mode`, `amount_basis`, `side`, `set_purpose` y `rep_count_basis` (migración `0025_workout_sets_semantics`: seis `ADD COLUMN` + índice parcial de cohorte `workout_sets_external_pr_cohort_idx`, con CHECKs como defensa en profundidad). El `weight_kg` histórico se conserva **verbatim** y las filas pre-v0.12 quedan con la tupla semántica en `NULL` (`unknown`), nunca inferida ni migrada. El dominio puro vive en `lib/progression/**` (canonicalización `canonicalSemantics`, decimal exacto y `compare`) y en `types/progression.ts`/`types/progression-read.ts`, con reason codes tipados (`unknown_semantics`, `unsupported_capture_version`, `invalid_semantic_combination`, `unsupported_load_mode`, `unsupported_side`, etc.).
- **Escritores web y Telegram exigen semántica completa.** `POST`/`PATCH /api/workouts/[id]/sets` (y `lib/services/workout-sets.ts`) validan la tupla completa en create/update y rechazan tuplas parciales; una edición no puede cambiar el monto sin revalidar la tupla final. La UI usa `components/session/SetSemanticsControls.tsx` y el borrador de sesión (`lib/session/semantics-draft.ts`) con controles mode-aware (peso corporal "sin carga externa", por lado, asistencia, alternating con `repCountBasis` visible). En Telegram, `/log` exige campos semánticos explícitos; la sintaxis vieja responde con el nuevo uso y **no escribe**, y `/resumen` usa etiquetas mode-aware/unknown (evidencia: PR #211).
- **Read model acotado de progresión y PR truth.** `GET /api/exercises/[id]/progression` (ejercicio exacto por ownership, cohorte por `reps`/`amountBasis`/`side`, cursor acotado) compone `lib/services/exercise-progression.ts` sobre `lib/db/progression-queries.ts`. Devuelve el representante del último workout cerrado comparable (`currentRepresentative`), el best elegible exacto (`currentBest`), el representante previo comparable y `comparison: baseline|new_pr|ties_best|below_best` bajo `progressionRuleVersion=1` (métrica `same_reps_external_load`). La primera sesión elegible es **baseline**; solo una carga externa **estrictamente mayor** para las mismas reps/basis/side es **new_pr**; la igualdad es `ties_best`. Un workout **abierto** nunca genera PR, y el `limit`/cursor de historia **no** afecta la respuesta de PR (evidencia: PR #212).
- **Superficie de progresión en UI.** `components/session/ExerciseProgressionPanel.tsx` + `hooks/useExerciseProgression.ts` muestran la comparación de cohorte con estados carga/vacío/unknown/error, y `hooks/useExerciseProgression.test.ts`/`ExerciseProgressionPanel.test.tsx` cubren su contrato (evidencia: PR #214).

### Changed

- **PR legacy retirado.** `GET /api/stats/prs` queda como tombstone tipado `410 Gone` / `PR_CONTRACT_RETIRED`; se removió el badge de PR legacy del workout y la lógica `isPR` de peso desnudo. Tras v0.12 hay **una sola** definición de PR dirigida al usuario (evidencia: PR #213).
- **Volumen y "fuerza" mixtos retirados.** Se suprimieron `totalVolumeKg`/`sumVolumeKg` en `guided-session.ts` y `progress-summary.ts` y el "gráfico de fuerza" (`strength-progress.ts`) de Progreso y del cierre de sesión; el delta de "mejora" por peso máximo del close-summary se removió. Quedan duración, conteo de series y racha (evidencia: PR #213).
- **"Última vez" honesto.** El read model de sesión previa conserva el contrato raw de v0.11 y ahora expone la tupla semántica o `unknown`; no se infiere comparación ni se etiqueta la carga desnuda como resistencia total (evidencia: PR #213/#214).
- **Historial raw acotado.** `/api/stats/exercise/[id]/history` permanece como superficie raw de compatibilidad, con cursor acotado y sin campos de PR; la historia legacy sigue visible con estado `unknown` (evidencia: PR #212).

### Not shipped (no describir como parte de v0.12)

- **Sin** PR de peso corporal, peso añadido, asistencia, alternado ni e1RM; **sin** PR de rango de reps o volumen; **sin** rankings, Body Map, motion/animación, Three.js, gamificación, quests/badges ni rediseño de design system; **sin** recomendación automática de carga ni inferencia de readiness/recuperación/pain. Tampoco se reescribe ni se convierte ningún peso histórico a semántica declarada.
- La semántica histórica de PR de ADR-001 queda superada **solo para afirmaciones nuevas dirigidas al usuario** por este contrato; el texto anterior se conserva como historia en el addendum de ADR-001.

## [0.11.0] - 2026-09-29

> **Estado: publicado (2026-09-29).** El release PR #197 (`chore(release): v0.11.0`, `release/0.11.0` → `main`, head `a8c9bc95aec95f5398a5de0cff4afcb91a83fc78`) se fusionó en `main` mediante un **merge normal (no squash)**, dejando el merge commit `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e` (padres `d2e6bc4d9153d8826f049876edf20fde92d21cc8` y `a8c9bc9`); el delta de la RC frente al SHA de implementación en `origin/develop` al corte (`28dad30dc2ebd827bd1fa88dcf986f84f725afd5`) fue solo `package.json`, `package-lock.json` y `CHANGELOG.md`. El tag anotado `v0.11.0` (objeto `eb2aab85a7739b0caa454726f230784f2ae92424`, target pelado `27fe2a0`) apunta a ese commit y `package.json`/`package-lock.json` quedaron en **0.11.0**. La regresión de RC sobre el head exacto `a8c9bc9` (Node v20.15.0) pasó: `npm ci`, typecheck, lint, Jest 264 suites / 2023 tests sin fallos, build y Playwright 93 passed / 1 skipped / 0 failed (19 specs; `e2e/exercise-session-memory.spec.ts` 8/8), más 8 suites / 104 tests focales de v0.11; el CI de GitHub (run 36659286884) sobre el PR #197 pasó Lint/Typecheck/Test, Playwright E2E y Vercel preview. La migración `0024_workout_exercise_notes` (aditiva: tabla nueva + índices parciales aditivos, **cero backfill**, sin reescritura destructiva) corrió en el gate pre-merge sobre `release/0.11.0` (workflow "Migrate Production DB", run 36659772672, `SUCCESS`) y se reafirmó post-merge sobre `main` @ `27fe2a0` (run 36659836574, `SUCCESS`). El deployment de producción de Vercel (id **6750037524**) del commit `27fe2a0`, environment Production, quedó en `SUCCESS` ([https://atlas-fitness-8tih7vhbe-eindi-acme.vercel.app](https://atlas-fitness-8tih7vhbe-eindi-acme.vercel.app)) y el **smoke público sin sesión** pasó: `GET /`, `/login` y `/onboarding` = 200; `/dashboard/today` = 307 → `/login`; `GET /api/auth/me`, `GET /api/stats/habits?period=week`, `GET /api/habit-targets`, `GET /api/stats/habit-adherence?period=week`, `GET /api/workouts/1/exercises/1/context` y `PUT /api/workouts/1/exercises/1/note` = 401. **El smoke autenticado de producción se ejecutó y PASÓ** (cierre operativo post-release, 2026-09-30; el release original lo había dejado pendiente): el workflow `Production Auth Smoke` run **36747341881** (`.github/workflows/production-auth-smoke.yml`, SHA confiable de `main` `1a211fbc7cf9d0611edd2c45ae4a0b89322d6f60`, `workflow_dispatch`, `mode=smoke`, `release_sha=27fe2a04e716b814f4c10fbdb29b9a827cdaf39e`) concluyó `success` con `overallResult: PASS` y recovery/cleanup `PASS` (artefacto sanitizado `production-smoke-evidence`, sin password/cookies/headers). Verificó login real con password de la identidad QA dedicada, control sin sesión `401`, historial del ejercicio exacto (series previas raw) excluyendo el workout abierto, nota con `version:1` y ownership, CAS obsoleto `409` sin mutación inesperada, logout con replay del cookie viejo `401` y re-login con persistencia, y limpieza visible de fixtures (nota borrada cuando aplica, A/B soft-deleted, lista/activo sin fixtures, sesión final revocada). El residuo QA-only aceptado `longestStreak` **no** es evidencia de release. **No** se movió ni recreó el tag `v0.11.0`, **no** se cambió la versión de paquete y **no** se creó un nuevo release. Evidencia: [`docs/operations/2026-09-30-production-smoke-h5-execution-evidence.md`](docs/operations/2026-09-30-production-smoke-h5-execution-evidence.md). Este repo publica mediante tag anotado, no mediante GitHub Releases: **no se creó un objeto GitHub Release**. Las entradas de abajo describen comportamiento verificable en el código integrado y sus tests.

### Added

- **Nota de ejercicio explícita, versionada y con ownership del usuario (`WorkoutExerciseNote`).** Durante una sesión activa el usuario puede crear, editar o borrar una nota para un ejercicio. Es **entrada explícita del usuario** (1–280 puntos de código Unicode, recortada) y antes solo existía como borrador local que se perdía al recargar/navegar. Ahora se persiste con ownership `user/workout/exercise`, `version` monotónica y compare-and-swap `{ noteId, version }`; al cerrar el workout la nota queda **inmutable** como registro histórico. Migración aditiva `0024_workout_exercise_notes` con **cero backfill** y tabla vacía. Tipos y validación pura en `types/exercise-session-memory.ts` y `lib/session/exercise-session-memory.ts` (helper compartido `countExerciseNoteCodePoints` con `Array.from(...).length`; `.length` y `maxLength` no son la cota autoritativa); ciclo de vida transaccional en `lib/services/exercise-session-memory.ts` (evidencia: PR #191/#192).
- **Read model acotado "Última vez" (series y nota previas del mismo ejercicio).** Al volver al mismo `exerciseId`, el player muestra las series completadas del encuentro previo **verbatim como registros históricos** (reps y `weightKg` decimal string) y la última nota guardada. Las dos fuentes son independientes: pueden venir de workouts distintos y llevan **fechas Córdoba independientes** (orden por `endedAt DESC, id DESC`). Se excluye el workout abierto/actual y los workouts/sets borrados. Es un read model, no una tabla: `getExerciseSessionContext(userId, workoutId, exerciseId)`. Endpoints `GET /api/workouts/[id]/exercises/[exerciseId]/context` y `PUT`/`DELETE .../note` (rutas delgadas, `userId` solo desde la sesión, errores `{code,message}`), con parser total cliente en `lib/api/exercise-session-memory.ts` (evidencia: PR #192/#193).
- **Paneles de sesión guiada.** El panel Notas pasó de borrador local a memoria persistida con guardado/borrado explícitos, estado de conflicto y borrador local preservado ante error de red; se agregó el panel "Última vez" con series y nota fechadas de forma independiente y estados vacío/carga/error locales que nunca bloquean el registro de series. Hooks `hooks/useExerciseSessionMemory.ts` (aborta la request obsoleta al cambiar de ejercicio y refetch tras conflicto), componentes `components/session/ExerciseNotePanel.tsx` y `components/session/LastCompletedPanel.tsx`, cableado acotado en `components/session/GuidedExerciseCard.tsx` (evidencia: PR #194).
- **Evidencia E2E del loop completo.** `e2e/exercise-session-memory.spec.ts` (8 casos) prueba estado real de API/DB: persistencia con versión exacta a través de update/reload/re-auth, `409` por CAS obsoleto, series previas provenientes del workout cerrado excluyendo el actual, inmutabilidad de la nota tras el cierre, aislamiento cross-user, compatibilidad skip/hold con nota retenida, copy de feedback honesto, flujo mobile 390px y límite Unicode (280 puntos de código aceptados con input astral, 281 rechazados por el servidor) (evidencia: PR #195).

### Changed

- **Copy de feedback post-workout corregido.** `lib/copy/session.ts` (`feedbackHelper`) ya no afirma que Atlas usa el feedback para calibrar recuperación o próximas cargas; ahora dice: "Guardamos este feedback como parte de esta sesión. No cambia tu plan ni recomienda cargas automáticamente." Es el **único** cambio adyacente a Coach: no agrega consumo de feedback, no agrega inputs al Coach y no introduce aprendizaje (evidencia: PR #194).

### Not shipped (no describir como parte de v0.11)

- El feedback post-workout y las series/notas **no** se envían a Gemini, Telegram, analytics ni a otro usuario; el feedback sigue siendo write-only salvo su propio GET.
- **Sin** afirmación de progresión, PR, e1RM, readiness/recuperación, recomendación de próxima carga, aprendizaje del Coach ni automatización por feedback.
- Permanecen **DEFER/EXCLUDE** (sin describir como entregados): pantalla dedicada de historial por ejercicio; nuevas categorías de PR/e1RM; recomendación automática de próxima carga; taxonomía de load-mode (bodyweight/asistido/unilateral); warm-up/drop-set/superset; RPE/RIR por set; sustitución real de ejercicio; read-back/uso determinístico del feedback; consumo de historial/feedback/hábitos/notas por Coach/Plan; ensamblador de contexto de preferencias; cola offline/idempotencia de sets y timer de descanso persistente; gamificación (XP, niveles, misiones/quests, badges), motion/animación; y todo lo listado en §24/§25 del brief v0.11.
- **Storage/retention sin cambios:** las notas persisten con el historial del workout y el soft-delete de un workout excluye sus notas y sets del contexto futuro. Sin cambios de export/retention.

## [0.10.0] - 2026-09-29

> **Estado: publicado (2026-09-29).** El release PR #186 (`chore(release): v0.10.0`, `release/0.10.0` → `main`, head `8bad403645d3cc41afbca9267d0030e139a801ac`) se fusionó en `main` mediante un merge normal (no squash), dejando el merge commit `531bf0706355763885c9798fc012a5eb6bbc0298`; el tag anotado `v0.10.0` (objeto `a03d0591f172f87a8b3410a2e003d614dba38a31`) apunta a ese commit y `package.json`/`package-lock.json` quedaron en `0.10.0`. La migración de producción `0023_habit_target_schedules` (aditiva, sin backfill) corrió en el gate pre-merge sobre `release/0.10.0` (workflow "Migrate Production DB", run 36580211527) y se reafirmó post-merge sobre `main` @ `531bf07` (run 36580447444), ambas en `SUCCESS`. El deployment de producción de Vercel (id 6736930690) del commit `531bf07` quedó en `SUCCESS` y el smoke sin sesión pasó: `/`, `/login`, `/onboarding` = 200; `/dashboard/today` = 307 → `/login`; `/api/stats/habits?period=week`, `/api/habit-targets` y `/api/stats/habit-adherence?period=week` = 401. Este repo publica mediante tag anotado, no mediante GitHub Releases: no se creó un objeto GitHub Release. Las entradas de abajo describen comportamiento verificable en el código integrado y sus tests; toda métrica citada tiene evidencia en `lib/**`, `app/**`, `components/**`, `hooks/**` o `e2e/**`.

### Added

- **Intención explícita por días objetivo de hábitos.** Para cada hábito del catálogo fijo (`hydration`, `walk`, `mobility`, `sleep`), el usuario puede declarar en qué días de la semana espera registrarlo. Cada versión tiene vigencia por fecha en hora de Córdoba (`effective_from`/`effective_to`), `version` monotónica y **no hay backfill**: los logs previos al primer objetivo siguen siendo actividad observada y quedan fuera del cumplimiento. Tablas nuevas `habit_target_schedules` + `habit_target_days` (migración `0023_habit_target_schedules`, `lib/db/schema.ts`) y ciclo de vida transaccional con compare-and-swap (`lib/services/habit-targets.ts`).
- **Crear, actualizar y desactivar explícitos con conflicto optimista.** El token es el par `{ targetId, version }` (nunca un timestamp); un token obsoleto responde `409` sin tocar el estado del servidor. Una edición del mismo día reemplaza la versión de hoy; desactivar una versión creada hoy la elimina de forma transaccional (único hard delete permitido) sin borrar historia previa, y desactivar una versión anterior la cierra el día anterior incrementando `version`. Repetir la misma intención es idempotente (`lib/services/habit-targets.ts`).
- **API de días objetivo y de cumplimiento.** `GET /api/habit-targets`, `PUT`/`DELETE /api/habit-targets/[habitKey]` y `GET /api/stats/habit-adherence?period=week|month|quarter`, con parsers totales en `lib/api/habit-targets.ts` y `lib/api/habit-adherence.ts`, hooks `hooks/useHabitTargets.ts`/`hooks/useHabitAdherence.ts` y card dedicada en Progreso (`components/progress/HabitTargetAdherenceCard.tsx`).
- **Cumplimiento contra intención: `N de M días objetivo`.** El numerador son los habit-days esperados transcurridos con registro (`done = true`) y el denominador los habit-days esperados transcurridos en la ventana. `configurationState` (intención vigente) y `metricState` (denominador de la ventana) son **independientes**: un objetivo terminado puede dar `not_configured` junto a un resultado histórico. Si el denominador es `0`, el estado es `no_expected_days` y no se emite ratio. Dominio puro en `lib/services/habit-target-adherence.ts` y tipos en `types/habit-adherence.ts`.
- **Configuración y señal "Objetivo de hoy".** Sección "Mis días objetivo" con selector accesible de lunes a domingo y resumen de vigencia en `components/habits/**`; mark diario que distingue esperado-completado, esperado-sin-registro, extra-registrado, no-esperado y futuro; y la señal "Objetivo de hoy" sin ocultar ni impedir registros extra (`components/today/TodayHabitsCard.tsx`, `components/habits/HabitTargetTodayBadge.tsx`).

### Changed

- **Actividad y cumplimiento quedan explícitamente separados.** `/api/stats/habits` y su card de Progreso siguen siendo observacionales (contrato v0.9 sin cambios); el cumplimiento contra días objetivo vive en su propio endpoint, su propia card y su propio copy.
- **Progreso más honesto.** Se retiraron los botones inertes de Notificaciones/Compartir del header (`components/progress/ProgressHeader.tsx`) y las sesiones recientes muestran el volumen real por sesión cuando existen sets elegibles (`lib/services/progress-summary.ts`, `components/progress/RecentSessionsCard.tsx`).

### Fixed

- Las sesiones recientes de Progreso ya no imprimen "Volumen no disponible" cuando el volumen de la sesión existe.
- El header de Progreso ya no muestra controles habilitados sin acción.

## [0.9.0] - 2026-09-27

### Added
- Lectura de **actividad de hábitos registrada**: un registro de solo lectura con ventana de semana, mes o trimestre en hora de Córdoba, sin metas, sin porcentajes y sin cumplimiento.
- Endpoint autenticado `GET /api/stats/habits?period=week|month|quarter`, con período validado y valor por defecto explícito.
- Cliente tipado que rechaza cualquier respuesta fuera del contrato —incluida una clave de hábito desconocida— en lugar de renderizarla parcialmente.
- Hook `useHabitActivity`: los números quedan asociados al período consultado, así cambiar de período nunca muestra los del período anterior.
- Card "Actividad de hábitos registrada" en Progreso: días con registro, días transcurridos del período y fuente declarada de cada número.
- Registro de actividad en la pantalla de Hábitos: selector de período y calendario día por día, junto a los controles de hoy.

### Changed
- La card de hábitos de Progreso reporta actividad **observada** del período elegido en lugar de sugerir una consistencia histórica que no se calculaba.
- El vocabulario de hábitos es de actividad registrada ("días con registro", "sin registro", "todavía no llegó"); no hay "% adherencia", "meta" ni "cumplimiento".
- El resumen de hoy en la pantalla de Hábitos ahora aclara que el detalle día por día del período elegido está justo debajo.

### Fixed
- La card "Hábitos consistentes" ya no muestra un estado vacío como si fuera una medición: se removió ese componente y el detalle real vive en el registro de actividad por día.
- La card "Bienestar registrado" declara que refleja solo el check-in de hoy y que no se acumula con el período elegido, para que no se lea como un dato de mes o trimestre.

## [0.8.0] - 2026-09-27

### Added
- Creación de rutinas a partir de propuestas de Routine Coach: la propuesta se arma y se valida como borrador editable antes de crear cualquier rutina.
- Ciclo de vida del plan con scoping de rutinas: las rutinas quedan acotadas al plan al que pertenecen, tanto en el listado como en la lectura individual.
- Onboarding persistido por cuenta: completar el recorrido queda registrado en el servidor para la cuenta autenticada.

### Changed
- Plan semanal: nueva capa de estrategia que compone la propuesta como un conjunto coherente, en lugar de resolver cada día por separado.
- Editor de plan manual: alcance y navegación de rutinas más claros y acotados al plan editado.

### Fixed
- El reemplazo de un plan guiado ya confirmado vuelve a permitirse.

## [0.7.1] - 2026-09-25

### Added
- Pantalla dedicada de Hábitos y hub del plan semanal activo con una vista real de sus siete días.
- Mejora del plan semanal activo con propuesta, comparación y confirmación explícita antes del reemplazo transaccional.

### Changed
- Mi Atlas usa las preferencias guardadas y datos reales de cuenta/actividad; iniciar un entrenamiento adaptado desde Hoy conserva el contexto exacto del check-in.
- Las adaptaciones aceptadas persisten los ejercicios omitidos y objetivos reducidos al reanudar la sesión.

### Fixed
- Los controles de ánimo de Hoy ya no desbordan el viewport móvil de 390 px.

## [0.7.0] - 2026-09-25

### Added
- Contexto de Coach persistido por usuario (`goal`, `pace`, `equipment`) y sección explícita de edición/guardado en Perfil. `hasSavedPreferences` refleja si existe una fila guardada, incluso cuando sus tres valores son `null`.
- Importación de respuestas antiguas del navegador con vista previa y confirmación explícita; el alta condicional no reemplaza una fila que ya exista.

### Changed
- Al terminar onboarding se sincronizan las respuestas con el perfil autenticado; omitirlo solo marca el recorrido como completo y navega a Hoy, sin sincronizar preferencias.
- El brief del plan guiado precarga los valores no nulos guardados (incluido `days-5` como cinco días editables). Leerlos no genera ni guarda un plan.
- La generación semanal autenticada usa el brief editable y el catálogo visible del usuario en el servidor. Gemini es opcional y la revisión atribuye la propuesta a Gemini o al respaldo determinista; muestra el objetivo y los datos del borrador, no una explicación basada en historial, check-ins o aprendizaje automático. El guardado sigue siendo una acción explícita, atómica e idempotente.

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
