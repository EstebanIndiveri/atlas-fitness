# Estructura del repositorio

> **Alcance temporal:** los conteos y el diagnóstico siguientes describen el snapshot auditado en `53bc87b` (18-09-2026). La afirmación de que ownership no se aplicaba uniformemente quedó superada por ADR-005 y el código actual.

## Estado actual

Ownership de catálogo está centralizado en `lib/auth/ownership.ts` y aplicado en los services de ejercicios y rutinas, además de las validaciones de rutinas/workouts. Ver [ADR-005](../architecture/ADR-005-ownership-catalog.md) y `lib/services/exercises.ts`, `lib/services/routines.ts`, `lib/services/workouts.ts`.

## Tipo

Es una aplicación Next.js única. Aunque `AGENTS.md` usa la palabra monorepo, no
hay workspaces ni paquetes independientes.

El commit auditado contiene 239 archivos versionados, 192 archivos TS/TSX y 23
Route Handlers.

## Mapa

```text
atlas-fitness/
├── app/
│   ├── api/                         # 23 Route Handlers
│   ├── dashboard/
│   │   ├── history/
│   │   ├── session/
│   │   │   └── [workoutId]/
│   │   ├── settings/
│   │   └── workout/[id]/
│   ├── login/
│   ├── register/
│   ├── layout.tsx
│   ├── manifest.ts
│   └── page.tsx
├── components/
│   ├── pwa/
│   ├── session/
│   ├── shell/
│   └── ui/
├── hooks/
├── lib/
│   ├── ai/
│   ├── api/
│   ├── auth/
│   ├── copy/
│   ├── db/
│   ├── dev/
│   ├── format/
│   ├── pwa/
│   ├── services/
│   ├── session/
│   ├── styles/
│   ├── telegram/
│   ├── time/
│   ├── ui/
│   └── workouts/
├── types/
├── e2e/
├── scripts/setup-local.ts
├── public/
├── docs/
├── proxy.ts
└── .github/workflows/ci.yml
```

## Entry points

- `app/page.tsx`: landing pública.
- `app/dashboard/page.tsx`: dashboard autenticado.
- `app/dashboard/workout/[id]/page.tsx`: sesión manual.
- `app/dashboard/session/page.tsx`: selector de rutina.
- `app/dashboard/session/[workoutId]/page.tsx`: sesión guiada.
- `app/dashboard/history/page.tsx`: historial.
- `app/dashboard/settings/page.tsx`: PWA y Telegram.
- `proxy.ts`: redirección de rutas autenticadas.
- `app/api/**/route.ts`: API.

## Capas

### `app/`

Define navegación, páginas y transporte HTTP. Las páginas privadas son
principalmente Client Components y cargan datos desde la API interna después
de montar.

### `components/` y `hooks/`

El design system vive en `components/ui/`; shell, PWA y sesión guiada tienen
componentes propios. `useGuidedSession`, `useRestTimer`, `useLinkCode` y
`useInstallPrompt` concentran estado interactivo.

### `lib/services/`

Contiene casos de uso de auth, workouts, sets, rutinas, stats, streaks,
check-ins, tips, resumen diario y vínculo Telegram. Es la capa correcta para
ownership e invariantes, aunque hoy no todos los servicios las aplican.

### `lib/db/`

Contiene cliente, schema, migraciones y seed. El schema también exporta tipos
usados por la UI, lo que filtra persistencia hacia presentación.

### Adapters

- `lib/telegram/`: cliente, parser, idempotencia y handlers por comando.
- `lib/ai/`: adapter Gemini.
- `lib/pwa/`: manifest, copy y política del service worker.

## Convenciones observadas

- Componentes: PascalCase.
- Hooks: camelCase con prefijo `use`.
- Servicios/utilidades: kebab-case.
- Unitarios junto al módulo.
- E2E en `e2e/*.spec.ts`.
- Alias `@/*`.
- Código en inglés y copy en español.

## Hotspots

| Archivo | Líneas | Motivo |
|---|---:|---|
| `app/dashboard/workout/[id]/page.tsx` | 446 | carga, formularios, timer, PRs y modal |
| `lib/db/seed.ts` | 266 | datos y lógica de seed |
| `lib/db/schema.ts` | 263 | esquema completo |
| `lib/services/streaks.ts` | 258 | cálculo, persistencia y nudge |
| `lib/services/workout-sets.ts` | 197 | CRUD e invariantes |
| `hooks/useGuidedSession.ts` | 188 | orquestación cliente |

El hotspot más claro para extraer es la página de workout manual. Telegram ya
está correctamente dividido entre coordinador y `handlers/`.

## Límites filtrados observados en el snapshot histórico

- UI importa `Workout`, `WorkoutSet`, `Exercise` y `DailyTip` desde el schema.
- Fechas DB tipadas como `Date` viajan como strings JSON.
- Algunas rutas validan con Zod; otras confían en interfaces TypeScript.
- Rutinas y ejercicios personalizados no tienen ownership uniforme.

## Evidence

- `app/`
- `app/api/`
- `components/`
- `hooks/`
- `lib/services/`
- `lib/db/`
- `lib/telegram/`
- `lib/ai/`
- `lib/pwa/`
- `types/`
- `proxy.ts`
- `scripts/setup-local.ts`
