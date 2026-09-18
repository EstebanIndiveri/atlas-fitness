# Convenciones Frontend — Atlas Fitness

Ver también `AGENTS.md` §§8–10 y ADR-002.

## Estructura

- Páginas en `app/dashboard/**`: composición fina.
- UI reutilizable en `components/` por dominio (`workout/`, `exercises/`, `auth/`, `ui/`).
- Estado de servidor vía fetch a `/api/*`; hooks `useX` para orquestar UI.
- No meter Drizzle ni secretos en client components.

## Componentización

- Un concern por componente.
- Extraer: `WorkoutActivePanel`, `SetRow`, `AddSetSheet`, `TipCard`, `StreakChip`, etc.
- Hooks: `useActiveWorkout`, `useAddSet`, `useStreak` — sin JSX.

## Estilos

- Una fuente de tokens: Tailwind v4 `@theme` en `app/globals.css`, espejado en `lib/ui/tokens.ts`.
- Utilidades semánticas (`bg-brand`, `text-ink`, `bg-canvas`, `rounded-md`) — no hex suelto en páginas.
- Primitivas en `components/ui/` (Button, Card, Input, Empty/Loading/Error) y shell en `components/shell/`.
- Mobile-first; teclado numérico en inputs de peso/reps.
- Copy `es-AR` centralizado (`lib/copy/ui.ts` y diccionarios de dominio).

## Anti-patrones

- TSX >250 líneas sin extraer.
- Duplicar formatters de fecha/peso.
- Optimistic UI sin rollback/toast de error.
