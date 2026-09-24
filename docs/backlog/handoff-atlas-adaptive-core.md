# Handoff — Atlas Adaptive Core V1
Fecha: 2026-09-19
Fuentes consolidadas: visión de producto (ChatGPT GPT-5.6) + auditoría de repo (Copilot/Claude Opus 4.8) + mockup de Stitch.
Estado: documento de dirección original para agentes; los porcentajes, prerequisitos y estados de implementación que aparecen debajo pertenecen a la planificación del 2026-09-19, no al estado actual del producto.

> **Reconciliación actual (2026-09-24):** parte del slice aquí descrito ya está implementada y released hasta v0.6.1 (check-in, Hoy, adaptación con Coach, sesión guiada, feedback y progreso). PR #114 estabilizó además los E2E de ese recorrido en `develop`. Este documento conserva su visión y decisiones originales; para distinguir lo implementado de lo que sigue abierto, usar [`handoff-2026-09.md`](./handoff-2026-09.md) y [`README.md`](./README.md). No tratar los prerequisitos del Track A como backlog operativo vigente sin contrastarlos allí.

---

## 0) Resumen ejecutivo

Atlas evoluciona de **colección de features CRUD** a **Adaptive Wellness Coach**.
Producto = `contexto → interpretación → recomendación → acción → aprendizaje`.
Gemini es implementación; **Coach Atlas es el producto**.

Realidad técnica: ~40% del núcleo es reutilizable (loop de sesión), ~60% es capa nueva
(plan diario, check-in, coach trazable, progreso, hábitos).

Estrategia: **no big bang**. Dos tracks + un vertical slice con **datos reales únicamente**.

---

## 1) Principios no negociables

1. **Coach Atlas es una capa de decisión, no un chat.** IA contextual y accionable.
2. **Toda recomendación es explicable y el usuario conserva el control** (propone, no modifica en silencio).
3. **DATA HONESTY RULE:** ninguna métrica/score/número visible sin fuente real.

### DATA HONESTY RULE (guardrail por tipos, no solo doc)

Toda métrica visible debe tener `source` identificable:
1. `user_input` — entrada explícita del usuario
2. `atlas_computed` — cálculo determinístico sobre datos propios
3. `external_integration` — integración externa real
4. `ai_recommendation` — inferencia de IA presentada como recomendación

Nunca: valores demo en producción, biometría inexistente, scores arbitrarios, precisión falsa.

Implementación sugerida:
```ts
type MetricSource = 'user_input' | 'atlas_computed' | 'external_integration' | 'ai_recommendation';
type Metric<T> = { value: T; source: MetricSource };
```
Componente `<MetricValue>` exige `source`. Sin fuente, no compila (TS strict, sin `any`).

---

## 2) Roadmap de dos tracks

```
TRACK A — STABILIZATION (no cambia producto)   →  BASELINE ESTABLE  →  TRACK B — ATLAS ADAPTIVE
```

### Track A — Fase 0: Baseline técnico
- Cerrar/merge trabajo pendiente (Skip/Hold #30 backend → #29 frontend).
- Resolver bugs conocidos: concurrencia de cola (last-write-wins), prioridad `queue` vs `queueOverride`,
  hold que re-selecciona el mismo ejercicio.
- Rotar secretos expuestos (Turso, Telegram, Gemini, cookies).
- Branch protection en `develop` y `main`; CI obligatorio + 1 aprobación.
- Excluir `.worktrees/` en Jest y ESLint.
- Cortar `release/*` baseline; alinear `main`/`develop`.

**DoD Track A:** main/develop alineados, CI estable, sin blockers conocidos,
sin secretos comprometidos, release identificable, tests verdes.

### Track B — Fase 1: Atlas Adaptive Core V1
Sin hábitos automáticos, sin Apple Health, sin pasos/sueño automáticos, sin recovery score.

```
DAILY CHECK-IN → TODAY PLAN → COACH ADAPTATION → ACTIVE WORKOUT → POST-WORKOUT → PROGRESS
```

---

## 3) Dependencia dura Track A → Track B (crítica)

La **"Adaptación con Coach Atlas"** (reducir ejercicios/series por energía/tiempo) es **el mismo dominio**
que Skip/Hold: una mutación de la cola de ejercicios de la sesión.

Skip/Hold construye ese modelo en `lib/session/queue.ts`, `types/session-queue.ts`,
con idempotencia (`clientMutationId`) y concurrencia.

→ **Coach adaptation debe construirse SOBRE esa cola**, reutilizando idempotencia y concurrencia.
Dos mecanismos paralelos generarían el mismo bug add/add + last-write-wins ya detectado entre #29/#30.

**Conclusión:** Track A no es solo higiene; es el **cimiento** de la feature estrella de Track B.
No diseñar Coach adaptation hasta que el modelo de cola de #30 esté mergeado y estable.

---

## 4) Modelo de datos (mínimo V1)

Nuevo:
- `DailyCheckIn` — **ánimo y energía separados** (dimensiones distintas).
- `TrainingPlan` V1 — `{ userId, routineAssignments: [{ dayOfWeek, routineId }] }` (sin periodización).
- `CoachRecommendation` — `{ original, adaptado, motivo, sourceData, suggestedChanges, accepted/rejected, timestamp }`.
- `PostWorkoutFeedback` — esfuerzo, sensación, molestias.

Reutilizado: `User`, `Routine`, `Exercise`, `WorkoutSession`, `Set/ExercisePerformance`,
`Mood`, historial, integración Gemini, streak/consistencia.

V2 (NO ahora): mesociclos, microciclos, fatiga, volumen por grupo, deload, progresión automática,
periodización, wearables, HRV, RHR, sleep stages, recovery score.

---

## 5) Reglas técnicas específicas del slice

- **Timezone:** "hoy" y `dayOfWeek` se calculan en `America/Argentina/Cordoba` (AGENTS.md §6),
  nunca UTC ni hora del cliente. Test de regresión obligatorio.
- **Resolución "entrenamiento de hoy"** debe contemplar estados: rutina soft-deleted, día de descanso,
  sesión ya completada hoy, doble sesión, sin plan.
- **Coach adaptation:** salida estructurada validada con Zod +
  **fallback determinístico real** (p. ej. energía baja → mantener compuestos, quitar accesorios, -30% volumen).
  Gemini solo mejora texto/selección cuando está disponible; la CTA nunca queda en no-op.
  Fallback testeable sin mocks.
- **Idempotencia** de la adaptación vía `clientMutationId`, reutilizando la cola de #30.
- **"Aprendizaje" V1 es ensamblado determinístico de contexto**, no ML. Copy interno:
  "Atlas usa tu último resultado", no "Atlas aprende".
- **Descomposición:** `app/dashboard/workout/[id]/page.tsx` ya tiene 446 líneas (excede §7/§10).
  El nuevo "Hoy" + sesión activa debe extraer hooks/componentes; archivos ≤ ~250 líneas.

---

## 6) Empty states (criterio de aceptación, con tests)

- **Sin plan:** "Todavía no tenés un plan. [Crear mi plan] [Crear rutina manualmente]".
- **Sin historial:** "Tu progreso empieza con tu primera sesión. [Empezar entrenamiento]".
- **Sin check-in:** "¿Cómo estás hoy? Responder toma menos de 10 segundos."
- **IA indisponible:** "Coach Atlas no está disponible temporalmente. Tu entrenamiento original sigue listo. [Empezar]".

---

## 7) Correcciones al mockup de Stitch (antes de codificar)

1. **Separar ánimo y energía** (hoy mezclados en el check-in).
2. **Quitar "Basado en datos biométricos"** → "Basado en tu plan, check-in e historial".
3. **Quitar "80% energía" y "Recuperación completa"** → "Energía alta" / "Buen descanso registrado".
4. **Hábitos (agua/pasos/sueño) NO como datos existentes** → Should posterior, todos `source: user_input`.
5. **i18n:** "Push & Core Hypertrophy" → "Empuje y torso superior · Hipertrofia" (sin mezcla de idioma).
6. **Accesibilidad en dispositivo:** ≥16px contenido, targets ≥44×44px, contraste WCAG AA,
   estados active/disabled/loading (se usa entrenando, baja precisión táctil).

Conservar: hero verde dominante, doble CTA (Empezar / ✨ Adaptar), el "porque" contextual,
chips de adaptación, consistencia semanal por encima de racha, dirección visual
(warm off-white, sage/forest green, tipografía oscura, esquinas redondeadas, whitespace).

---

## 8) MoSCoW — Atlas Adaptive Core V1

**Must**
- DailyCheckIn (ánimo + energía separados).
- TrainingPlan V1 + resolución "hoy" en TZ Córdoba con sus estados.
- Hero "Entrenamiento de hoy" con el *porque* real.
- CoachRecommendation persistido y trazable.
- Adaptación con preview → aceptar/rechazar, sobre la cola de Skip/Hold, con fallback determinístico.
- Ejecución de sesión existente (reutilizada) + PostWorkoutFeedback.
- Progreso básico: consistencia semanal (dato real).
- Empty states como aceptación con tests.

**Should:** hábitos manuales (agua/sueño/pasos) tras el slice, todos `source: user_input`.

**Won't (V1):** biometría, wearables, HealthKit/Health Connect, recovery score,
periodización/deload, "aprendizaje" ML, gráficos avanzados.

---

## 9) Definition of Done del slice

- Recorrido `Hoy → check-in → plan del día → adaptar(preview/accept) → sesión → post-workout → progreso`
  con datos reales únicamente.
- Tests TDD por función/service: happy + edge + error, incluyendo 4 empty states y fallback de IA (sin mocks).
- Timezone Córdoba testeado.
- Adaptación idempotente (`clientMutationId`) reutilizando cola de #30.
- Cero `any`, cero métrica sin `source`, archivos ≤ ~250 líneas.
- CI verde: lint, tsc, jest, Playwright del recorrido Must.

---

## 10) Brief final para el agente

> Implementar **Atlas Adaptive Core V1**: Today → Daily Check-in (ánimo+energía separados) →
> Scheduled workout (plan `dayOfWeek→routineId`, "hoy" en TZ Córdoba) → Coach adaptation con
> preview/accept-reject **explicable, construida sobre el modelo de cola de sesión de Skip/Hold (#30)
> y con fallback determinístico** → ejecución de sesión existente → post-workout feedback → progreso básico.
> Reutilizar el loop de sesión actual. **Ninguna métrica sin `source` (DATA HONESTY RULE por tipos);
> ningún dato de biometría/wearable/score.**
> **Prerrequisito: Track A cerrado** (Skip/Hold mergeado y estable, branch protection, secretos rotados, release baseline).

---

## 11) División de responsabilidades de las fuentes

- **Stitch:** qué sensación/jerarquía debe tener (referencia visual base, con las 6 correcciones).
- **Visión de producto:** qué debería ser Atlas (norte estratégico).
- **Auditoría de repo:** qué existe realmente y cuánto cuesta llegar (anclaje técnico).
