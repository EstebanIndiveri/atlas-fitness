# Handoff — Atlas Fitness · finalización de publicación v0.7.1 (Septiembre 2026)

> **Documento de checkpoint operativo.** Es la fuente de verdad para que un agente o persona entienda el estado del proyecto, qué está hecho/released, qué quedó diferido en backlog y cómo continuar. Snapshot: 2026-09-25. v0.7.0 se publicó mediante el PR #126 y el tag `v0.7.0` apunta al commit `dae2bc949538f9cb9fa02faf8db0712d04b9d9f9`. Los cambios de producto v0.7.1 se integraron mediante el PR de release #138, fusionado en `main` como `ba0857c5c42f730263e2d735ff57e69f6b0d42ea`; `package.json` y `package-lock.json` están en 0.7.1. Esta PR finaliza la metadata documental. Al snapshot indicado, `v0.7.1` aún no tiene tag ni GitHub Release. Después de mergear esta PR, el tag debe apuntar al commit final de `main` resultante de este merge (no al commit de #138). El CI post-merge del candidato desde `develop` (run 36201073118) pasó. No hubo cambios de migraciones desde el tag v0.7.0.

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
- Progreso no inventa consistencia de hábitos; muestra empty state y “today-only context” en [`components/progress/ProgressInsightCards.tsx`](../../components/progress/ProgressInsightCards.tsx).
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
8. **Progress**: pantalla Progreso Figma-aligned con interpretación, resumen, consistencia semanal, fuerza, bienestar, hábitos y sesiones recientes en [`app/dashboard/progress/page.tsx`](../../app/dashboard/progress/page.tsx).

DoD funcional: el loop principal y Coach Context están incluidos en la release v0.7.0. Las cifras E2E anotadas abajo son evidencia histórica de sus respectivas waves y no deben presentarse como una corrida de la suite sobre el estado actual. Para futuras waves, el DoD de release sigue exigiendo revalidación end-to-end, auditoría pre-PR y suite full limpia.

**E2E de PR #114 (evidencia histórica):** las carreras de observación de respuesta/acción fueron corregidas y el golden path quedó estabilizado según la evidencia de esa wave. Resultado registrado entonces: 40 E2E aprobados y 1 omitido intencionalmente; los specs críticos de auth/workouts/session/routines-editor pasaron 51/51 en `repeat-each=3`. RoutineEditor cubre `90 → vacío → 30`. PR #124 agrega `e2e/coach-context.spec.ts`; las cifras de PR #114 no representan una corrida de la suite sobre el estado posterior a #124.

## 5. Entregado v0.3.1 → v0.7.1

- **v0.3.1**: Coach adaptation interpreta freeText (tiempo/fatiga/sin máquinas), motivos trazables, Today completed-state + Adaptar, sesión guiada mobile con set table/notas/CTA fija y fixes de inputs de descanso/sets.
- **v0.3.2**: `dayReason` honesto y determinístico, Progress fixes (chart desde 1 punto, labels/overflow), CTA “Crear con Coach Atlas” en rutinas/plan.
- **v0.4.0**: edición de plan semanal (`GET/PATCH /api/training-plan/[id]`, `/dashboard/plan/[id]/edit`, `usePlanBuilder` edit), wizard guiado de plan semanal, persistencia de rutinas por día con cleanup compensatorio, convergencia Figma de sesión guiada/Progreso/detalle de rutina.
- **v0.5.0**: convergencia Figma de Onboarding, Entrenar hub, Perfil/Settings y bottom nav con iconos + active states.
- **v0.6.0**: convergencia Figma de Hoy home; generación de plan semanal Coach AI (Gemini + fallback determinístico verificable); CHANGELOG + handoff. Fix del contrato `streak-chip` (golden-path E2E).
- **v0.6.1**: fixes UX/UI de dispositivo real + Figma (`12:1830` player, `8-1413` hero): CTA verde+check, descanso siempre visible, "Añadir serie", contraste de ánimo (raíz `cn()` sin tailwind-merge), overflow de hábitos, hero+progress bar, equipamiento real en Perfil y limpieza de filas backlog.
- **v0.7.0 (publicado 2026-09-25, release PR #126)**: incluye el trabajo de Coach Context de los PR #118–#124: preferencias `goal/pace/equipment` persistidas por usuario; Finish de onboarding sincroniza y Skip no; importación legacy con preview, confirmación y protección condicional de filas existentes; edición explícita en Perfil sin cambiar el plan activo; precarga editable del brief guiado; generación semanal autenticada con atribución Gemini/fallback; guardado explícito e idempotente. Ver límites en §6–§7.
- **v0.7.1 (PR #130–#137 integrados por el release PR #138)**: pantalla dedicada de Hábitos; hub del plan semanal activo y mejora con comparación/confirmación explícita; Mi Atlas basado en preferencias guardadas y actividad real; inicio de entrenamientos adaptados desde Hoy y persistencia del check-in, ejercicios omitidos y objetivos reducidos al reanudar; corrección de overflow móvil de los controles de ánimo. Los metadatos de publicación se finalizan en esta PR; al snapshot de arriba el tag todavía no existe.

Ver [`../../CHANGELOG.md`](../../CHANGELOG.md) para detalle agrupado Added/Changed/Fixed.

## 6. Estado del release y snapshot de base

**Release v0.7.0 (2026-09-25):** el PR #126 se fusionó en `main`; el tag `v0.7.0` apunta a `dae2bc949538f9cb9fa02faf8db0712d04b9d9f9`. Como parte del back-merge, PR #127 fast-forwarded `develop` a ese SHA; al completar esos pasos, `main` y `develop` quedaron sincronizadas en el commit del release. El deployment de producción en [`https://atlas-fitness-655yg94r0-eindi-acme.vercel.app`](https://atlas-fitness-655yg94r0-eindi-acme.vercel.app) sobre ese commit tuvo éxito; la raíz respondió HTTP 200 y el workflow de migración de producción pasó.

**Release v0.7.1 / metadata finalization (snapshot 2026-09-25):** el SHA de entrada de `develop` fue `6996dd8463d2c4b2cf08c40f900639c9ea504eca`; el CI post-merge run 36201073118 pasó Playwright, ESLint, typecheck, Jest y build. El PR de release #138 se fusionó en `main` como `ba0857c5c42f730263e2d735ff57e69f6b0d42ea`, con `package.json` y `package-lock.json` en 0.7.1. Esta PR de documentación coloca las notas bajo `0.7.1` y prepara los metadatos finales. Después de mergear esta PR, crear el tag `v0.7.1` apuntando al commit final de `main` resultante de este merge, no a `ba0857c`. Al snapshot, no existe el tag ni un GitHub Release; por lo tanto, todavía no se declara publicada v0.7.1. No hay cambios de migraciones desde `v0.7.0` y esta preparación no requiere una migración nueva.

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
9. Release: cortar `release/x.y.z` desde `develop`, bump `package.json`, PR a `main` (`--merge`, no squash), tag `vX.Y.Z`, back-merge `main→develop` (fast-forward), verificar prod con `curl` (`/`, `/login`, `/onboarding` = 200; `/dashboard/today` = 307).

### Resultado de release v0.7.0

- [x] PR #118–#124 integrados como trabajo de Coach Context.
- [x] PR #126 fusionado en `main`; tag `v0.7.0` apunta a `dae2bc949538f9cb9fa02faf8db0712d04b9d9f9`.
- [x] PR #127 completó el back-merge por fast-forward; al cierre del release, `develop` quedó en el SHA del tag `v0.7.0`.
- [x] Deployment de producción sobre ese commit exitoso; la raíz respondió HTTP 200 y el workflow de migración de producción pasó.

## 7. Backlog restante

### Alto impacto / próximo

- La estabilidad E2E del golden path quedó verificada por PR #114; no queda como tarea Playwright Must. Si PO/QA requiere una validación manual adicional con datos QA reales (`qa@atlas.test`) y empty states, mantenerla separada de los resultados E2E registrados.
- **Explicación más detallada por día (opcional)**: la revisión ya atribuye Gemini/fallback y muestra el objetivo y el borrador (día, foco, ejercicios, series/repeticiones). Si se amplía, limitar razones a los campos del brief y al contenido generado; hoy no presenta un razonamiento personalizado basado en historial/check-ins.

### Deferred / follow-up (Perfil)

- **Notificaciones y recordatorios**: siguen diferidos; no hay pantalla ni acción real implementada.

Coach Context no aprende de las preferencias ni modifica el plan activo al editarlas. Los campos son entradas explícitas del usuario y, en el plan guiado, solo inicializan controles editables; generación, revisión y guardado requieren acciones separadas del usuario.

### UX gaps conocidos / validaciones pendientes

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

1. **Estado de la wave (snapshot 2026-09-25)**: v0.7.0 fue la última release etiquetada antes de la integración v0.7.1; PR #126 la fusionó en `main` y PR #127 sincronizó `develop` con el SHA del tag. El release PR #138 ya integró v0.7.1 en `main`; la metadata se finaliza en esta PR y el tag se debe crear sobre el commit final que produzca su merge. No hay tag v0.7.1 al snapshot. Los resultados E2E de PR #114 son evidencia histórica, no una validación de la wave v0.7.1.
2. **Tratar IA como enhancer, no dependencia**: el wizard debe ser útil con catálogo real aunque Gemini no responda; Gemini solo puede mejorar selección/texto validado.
3. **Agregar tests de contrato para weekly-plan AI**: catálogo vacío, IDs inválidos de Gemini, respuesta malformada, timeout, no key, días 1–6, foco/equipment raros.
4. **Auditar copy de honestidad**: cualquier “Atlas sabe/aprende/recuperación” debe mapear a datos reales o cambiarse a “Atlas usa tu plan/check-in/historial”. No describir las preferencias guardadas como aprendizaje, ni atribuir la propuesta a datos que el brief no incluye.
5. **Branch protection sigue siendo riesgo organizacional**: documentar como bloqueado hasta que el owner del repo active reglas y CI requerida.
6. **Mantener docs vivas**: actualizar este handoff y changelog en cada release menor; si cambia un contrato público, actualizar ADR/engineering docs relacionados.
