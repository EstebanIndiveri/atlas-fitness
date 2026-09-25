# Handoff — Atlas Fitness · Checkpoint post PR #114 (Septiembre 2026)

> **Documento de checkpoint operativo.** Es la fuente de verdad para que un agente o persona entienda el estado actual del proyecto, qué está hecho/released, qué quedó diferido en backlog y cómo continuar paso a paso. Última actualización: 2026-09-24. La última versión publicada es v0.6.2, una release de estabilidad de testing/documentación sin nuevas funcionalidades de producto; este checkpoint conserva el contexto de `develop` tras PR #114.

## 1. Recap producto / visión

Atlas Fitness es un coach de entrenamiento mobile-first: no busca ser un CRUD de rutinas sino un loop de hábito donde el usuario registra cómo está, ve qué toca hoy, puede adaptar la sesión con Coach Atlas, entrena guiado, deja feedback y vuelve a Progreso con datos reales. La visión de [`handoff-atlas-adaptive-core.md`](./handoff-atlas-adaptive-core.md) sigue vigente: **contexto → interpretación → recomendación → acción → aprendizaje**, con una regla central: Coach Atlas propone y explica, nunca inventa ni modifica silenciosamente.

## 2. Snapshot de arquitectura

Stack y límites están documentados en [`ADR-001`](../architecture/ADR-001-system-stack.md), [`ADR-002`](../architecture/ADR-002-client-channels.md), [`ADR-003`](../architecture/ADR-003-gemini-guided-session.md), [`ADR-004`](../architecture/ADR-004-sessions.md) y [`ADR-005`](../architecture/ADR-005-ownership-catalog.md).

- **Runtime/UI**: Next.js 16 App Router + React 19 + TypeScript strict. Rutas UI en `app/**`; pantallas dashboard en `app/dashboard/**`.
- **API**: route handlers delgados en `app/api/**`, con auth/validación y delegación a services. Patrón: route → validate → auth/session → service → DB/adapters → response; ver [`conventions-be.md`](../engineering/conventions-be.md).
- **Dominio/servicios**: `lib/services/**` concentra casos de uso: planes, Today, workouts, sesión guiada, progreso, Coach adaptation, feedback, hábitos.
- **IA/adapters**: `lib/ai/**` contiene Gemini/fallbacks. Gemini debe ser server-side; sin key o con error no bloquea el flujo.
- **Componentes**: `components/**` está organizado por dominio (`today`, `session`, `plan`, `progress`, `training`, `profile`, `onboarding`, `shell`, `ui`). Hooks compartidos viven en `hooks/**`.
- **DB**: `lib/db/**` usa Drizzle + Turso/libSQL. `lib/db/schema.ts` define auth sessions, catálogo, rutinas, workouts, planes, feedback, hábitos, Telegram, etc.
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

1. **Onboarding**: completo visualmente con wizard de 4 pasos, opciones accesibles y CTA sticky en [`components/onboarding/OnboardingWizard.tsx`](../../components/onboarding/OnboardingWizard.tsx).
2. **Today**: **convergido a Figma y released (v0.6.0/v0.6.1)**. [`app/dashboard/today/page.tsx`](../../app/dashboard/today/page.tsx) compone header, check-in ánimo/energía, hero, Coach, hábitos, semana e install toast. En v0.6.1 se corrigieron regresiones de dispositivo real: contraste del ánimo seleccionado, overflow de hábitos y hero/progress bar.
3. **Start/adapt**: Hoy y Entrenar pueden iniciar rutina programada; Adaptar navega a `/dashboard/session/adapt` con rutina/objetivo. Coach adaptation existe con preview/apply y fallback.
4. **Guided session**: completo y responsive: header, ejercicio activo, Técnica/media, Notas, set table, rest/skip/hold y CTA de completar serie (`components/session/**`, `app/dashboard/session/[workoutId]/page.tsx`). En v0.6.1: CTA verde con check, timer de descanso como barra fija siempre visible, "Añadir serie" funcional (`addSet()` cap 12) y estados de serie con círculos; sin inventar historial previo.
5. **Post-workout**: feedback post-workout y close summary existen en services/routes/componentes de sesión.
6. **Progress**: pantalla Progreso Figma-aligned con interpretación, resumen, consistencia semanal, fuerza, bienestar, hábitos y sesiones recientes en [`app/dashboard/progress/page.tsx`](../../app/dashboard/progress/page.tsx).

DoD funcional: el loop está implementado y released end-to-end hasta v0.6.1. DoD de release por wave sigue exigiendo revalidación end-to-end, auditoría pre-PR y suite full limpia.

**E2E en `develop` tras PR #114:** las carreras de observación de respuesta/acción fueron corregidas y el golden path quedó estabilizado según la evidencia de la wave. Resultado registrado: 40 E2E aprobados y 1 omitido intencionalmente; los specs críticos de auth/workouts/session/routines-editor pasaron 51/51 en `repeat-each=3`. RoutineEditor cubre `90 → vacío → 30`. Esto documenta estado de pruebas, no un cambio de producto adicional.

## 5. Entregado v0.3.1 → v0.6.1

- **v0.3.1**: Coach adaptation interpreta freeText (tiempo/fatiga/sin máquinas), motivos trazables, Today completed-state + Adaptar, sesión guiada mobile con set table/notas/CTA fija y fixes de inputs de descanso/sets.
- **v0.3.2**: `dayReason` honesto y determinístico, Progress fixes (chart desde 1 punto, labels/overflow), CTA “Crear con Coach Atlas” en rutinas/plan.
- **v0.4.0**: edición de plan semanal (`GET/PATCH /api/training-plan/[id]`, `/dashboard/plan/[id]/edit`, `usePlanBuilder` edit), wizard guiado de plan semanal, persistencia de rutinas por día con cleanup compensatorio, convergencia Figma de sesión guiada/Progreso/detalle de rutina.
- **v0.5.0**: convergencia Figma de Onboarding, Entrenar hub, Perfil/Settings y bottom nav con iconos + active states.
- **v0.6.0**: convergencia Figma de Hoy home; generación de plan semanal Coach AI (Gemini + fallback determinístico verificable); CHANGELOG + handoff. Fix del contrato `streak-chip` (golden-path E2E).
- **v0.6.1**: fixes UX/UI de dispositivo real + Figma (`12:1830` player, `8-1413` hero): CTA verde+check, descanso siempre visible, "Añadir serie", contraste de ánimo (raíz `cn()` sin tailwind-merge), overflow de hábitos, hero+progress bar, equipamiento real en Perfil y limpieza de filas backlog.

Ver [`../../CHANGELOG.md`](../../CHANGELOG.md) para detalle agrupado Added/Changed/Fixed.

## 6. Checkpoint actual (develop post PR #114; última release v0.6.2)

**Base verificada**: `develop` está en el merge de PR #114 (`d53c1dfa4904d1f4dc44ebc600ec5510e65148f7`), posterior a la última release `v0.6.1`. No afirmar que `develop` está alineada con `main`.

**Salud del repo (evidencia registrada en PR #114)**: typecheck y build aprobados; Jest 198 suites / 1126 tests aprobados; E2E 40 aprobados / 1 omitido intencionalmente; specs críticos auth/workouts/session/routines-editor 51/51 en `repeat-each=3`; lint 0 errores y 1 warning preexistente (`lib/api/habits.test.ts:48`). La cifra Jest y los checks describen la wave, no un claim de release o de nuevas funciones.

**Qué está cerrado**: el golden path de producto (onboarding → Hoy → start/adapt → sesión guiada → post-workout → progreso) está implementado y released hasta v0.6.1. PR #114 cierra la inestabilidad E2E de carreras wait/action; la evidencia de la wave está arriba. Coach AI weekly-plan quedó completo con Gemini + fallback determinístico y tests de contrato.

**Paso a paso para retomar (nuevo agente o persona)**:

1. Leé este handoff + [`AGENTS.md`](../../AGENTS.md) + los ADRs relevantes antes de tocar código.
2. Node 20 (CI usa 20). En este entorno: `export PATH=$HOME/.nvm/versions/node/v20.15.0/bin:$PATH`. Instalá con `npm install` y, para datos locales, `npm run setup:local` (usuario `qa@atlas.test`).
3. Verificá el baseline con binarios de repo-root (no `npx`, que reinstala): `node_modules/.bin/tsc --noEmit`, `node_modules/.bin/jest --silent`, `node_modules/.bin/eslint <archivos>`.
4. Elegí un item del backlog (§7). Creá rama con prefijo correcto (`feat/`, `fix/`, `chore/`, `docs/`) desde `develop` actualizado.
5. TDD: escribí el test que falla, implementá lo mínimo, mantené verde. Sin `any`; JSDoc + tipos de retorno en funciones públicas; archivos ~200–250 líneas.
6. Si el trabajo es grande y paralelizable, despachá subagentes con **ownership de archivos disjuntos** (un archivo = un agente); vos orquestás todo el git/PR. Verificá con `git status` que no se pisaron paths.
7. Convergencia Figma: los tools MCP `figma-*` están deferidos — buscá con el tool de búsqueda de tools y llamá `figma-get_screenshot` con el `nodeId` (frames pulidos = serie `12:*`; hero Hoy = `8-1413`). Los subagentes no pueden llamar Figma; el orquestador baja el screenshot y embebe el spec.
8. Auditoría pre-PR obligatoria: full suite verde → agente `code-review` sobre el diff completo → aplicar **todas** las observaciones → re-correr suite → commits Conventional Commits → PR a `develop`.
9. Release: cortar `release/x.y.z` desde `develop`, bump `package.json`, PR a `main` (`--merge`, no squash), tag `vX.Y.Z`, back-merge `main→develop` (fast-forward), verificar prod con `curl` (`/`, `/login`, `/onboarding` = 200; `/dashboard/today` = 307).

## 7. Backlog restante

### Alto impacto / próximo

- La estabilidad E2E del golden path quedó verificada por PR #114; no queda como tarea Playwright Must. Si PO/QA requiere una validación manual adicional con datos QA reales (`qa@atlas.test`) y empty states, mantenerla separada de los resultados E2E registrados.
- **Explicabilidad del plan semanal**: mostrar al usuario por qué cada día/rutina fue propuesta y si vino de IA (`source: 'gemini'`) o de fallback determinístico.
- **Tour de onboarding que alimente a Coach**: el onboarding ya persiste `goal/pace/equipment` (localStorage `atlas:onboarding:answers`), pero esa info debería quedar disponible/visible para que Coach Atlas arme o sugiera rutinas y el usuario la pueda contrastar/editar. Hoy la pantalla "cómo vas a entrenar" no lo deja claro.

### Deferred / follow-up (Perfil — rows quitadas o sin editor propio)

- **Preferencias de Coach** y **Notificaciones y recordatorios**: filas removidas de "Mi Atlas" en v0.6.1; reintroducir solo cuando existan pantallas/acciones reales.
- **Editor dedicado de Equipamiento/Objetivos** desde Perfil: hoy "Equipamiento" muestra el valor real del onboarding y enlaza al plan builder; falta un editor puntual que no obligue a rehacer el flujo guiado.
- **Pantalla de Hábitos de bienestar**: la fila enlaza a Hoy (donde viven los hábitos); si PO prioriza, crear una vista dedicada.

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

1. **Estado de la wave**: Hoy y coach-weekly-plan AI están released hasta v0.6.1; PR #114 estabilizó los E2E. No presentar esa validación como feature nueva.
2. **Tratar IA como enhancer, no dependencia**: el wizard debe ser útil con catálogo real aunque Gemini no responda; Gemini solo puede mejorar selección/texto validado.
3. **Agregar tests de contrato para weekly-plan AI**: catálogo vacío, IDs inválidos de Gemini, respuesta malformada, timeout, no key, días 1–6, foco/equipment raros.
4. **Auditar copy de honestidad**: cualquier “Atlas sabe/aprende/recuperación” debe mapear a datos reales o cambiarse a “Atlas usa tu plan/check-in/historial”.
5. **Branch protection sigue siendo riesgo organizacional**: documentar como bloqueado hasta que el owner del repo active reglas y CI requerida.
6. **Mantener docs vivas**: actualizar este handoff y changelog en cada release menor; si cambia un contrato público, actualizar ADR/engineering docs relacionados.
