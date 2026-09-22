# Handoff — Atlas Fitness · Septiembre 2026

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
2. **Today**: en convergencia Figma en la wave actual. [`app/dashboard/today/page.tsx`](../../app/dashboard/today/page.tsx) compone header, check-in, hero, Coach, hábitos, semana e install toast. Aún debe tratarse como Unreleased hasta merge/release.
3. **Start/adapt**: Hoy y Entrenar pueden iniciar rutina programada; Adaptar navega a `/dashboard/session/adapt` con rutina/objetivo. Coach adaptation existe con preview/apply y fallback.
4. **Guided session**: completo para sesión guiada responsive: header, ejercicio activo, Técnica/media, Notas, set table, rest/skip/hold y CTA fija de completar serie (`components/session/**`, `app/dashboard/session/[workoutId]/page.tsx`).
5. **Post-workout**: feedback post-workout y close summary existen en services/routes/componentes de sesión.
6. **Progress**: pantalla Progreso Figma-aligned con interpretación, resumen, consistencia semanal, fuerza, bienestar, hábitos y sesiones recientes en [`app/dashboard/progress/page.tsx`](../../app/dashboard/progress/page.tsx).

DoD funcional: el loop está implementado por piezas. DoD de release exige todavía revalidación end-to-end completa, auditoría pre-PR y suite full limpia.

## 5. Entregado v0.3.1 → v0.5.0

- **v0.3.1**: Coach adaptation interpreta freeText (tiempo/fatiga/sin máquinas), motivos trazables, Today completed-state + Adaptar, sesión guiada mobile con set table/notas/CTA fija y fixes de inputs de descanso/sets.
- **v0.3.2**: `dayReason` honesto y determinístico, Progress fixes (chart desde 1 punto, labels/overflow), CTA “Crear con Coach Atlas” en rutinas/plan.
- **v0.4.0**: edición de plan semanal (`GET/PATCH /api/training-plan/[id]`, `/dashboard/plan/[id]/edit`, `usePlanBuilder` edit), wizard guiado de plan semanal, persistencia de rutinas por día con cleanup compensatorio, convergencia Figma de sesión guiada/Progreso/detalle de rutina.
- **v0.5.0**: convergencia Figma de Onboarding, Entrenar hub, Perfil/Settings y bottom nav con iconos + active states.

Ver [`../../CHANGELOG.md`](../../CHANGELOG.md) para detalle agrupado Added/Changed/Fixed.

## 6. En progreso ahora

- **Hoy home screen Figma convergence**: cambios en `components/today/**` y `app/dashboard/today/page.tsx` de la rama actual. No asumir released hasta merge.
- **Coach AI weekly-plan generation**: [`lib/ai/weekly-plan-draft.ts`](../../lib/ai/weekly-plan-draft.ts) ya arma plan semanal determinístico sobre catálogo real componiendo drafts de rutina. El cableado Gemini semanal directo está en curso; debe validar IDs del catálogo, limitar texto, mantener fallback y no requerir `GEMINI_API_KEY` para funcionar.
- **Documentación**: este handoff y backlog quedan como fuente operativa para nuevos agentes/personas.

## 7. Backlog restante

### Alto impacto / próximo

- Completar **coach-weekly-plan AI** con Gemini + fallback determinístico verificable. No bloquear el wizard si Gemini falla.
- Revalidar golden path completo con datos reales y empty states.
- Playwright Must para el recorrido cuando la UI cierre la wave.

### Bloqueado

- **Branch protection** en `develop`/`main`: requiere permisos de repo admin; no se resuelve con cambios de código.

### UX gaps conocidos

- Explicabilidad del plan semanal: mostrar al usuario por qué cada día/rutina fue propuesta y si vino de IA o fallback.
- Manejo de errores del wizard guiado: hacer más visible cuando falló la creación de una rutina o la limpieza compensatoria.
- Perfil todavía tiene varios valores “No configurado” por diseño honesto; convertirlos en flows reales solo si PO prioriza.
- Progreso de hábitos muestra contexto de hoy, no consistencia histórica; no convertirlo en porcentaje falso.

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

1. **Cerrar la wave antes de sumar alcance**: Hoy + coach-weekly-plan AI deben salir con fallback probado y sin claims inflados.
2. **Tratar IA como enhancer, no dependencia**: el wizard debe ser útil con catálogo real aunque Gemini no responda; Gemini solo puede mejorar selección/texto validado.
3. **Agregar tests de contrato para weekly-plan AI**: catálogo vacío, IDs inválidos de Gemini, respuesta malformada, timeout, no key, días 1–6, foco/equipment raros.
4. **Auditar copy de honestidad**: cualquier “Atlas sabe/aprende/recuperación” debe mapear a datos reales o cambiarse a “Atlas usa tu plan/check-in/historial”.
5. **No fragmentar ownership en la wave**: `components/today/**` y `lib/ai/**` están activos por otros agentes; quien integre debe resolver conflictos y correr suite completa.
6. **Branch protection sigue siendo riesgo organizacional**: documentar como bloqueado hasta que el owner del repo active reglas y CI requerida.
7. **Mantener docs vivas**: actualizar este handoff y changelog en cada release menor; si cambia un contrato público, actualizar ADR/engineering docs relacionados.
