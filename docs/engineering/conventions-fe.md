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

- Una fuente de tokens (theme / CSS variables).
- Mobile-first; teclado numérico en inputs de peso/reps.
- Copy `es-AR` centralizado (constantes o diccionario simple).

## Anti-patrones

- TSX >250 líneas sin extraer.
- Duplicar formatters de fecha/peso.
- Optimistic UI sin rollback/toast de error.
