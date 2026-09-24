# Convenciones y calidad interna

> **Alcance temporal:** parte del diagnóstico de este documento refleja el snapshot auditado el 18-09-2026. La afirmación sobre README/ADR-003 quedó superada; los hallazgos restantes no se presentan como revalidados por PR #114.

## Reconciliación actual — develop post PR #114

- `README.md` ya no declara un scaffold: identifica v0.6.1 como última versión publicada y enlaza el checkpoint operativo.
- ADR-003 ya no está propuesto: su flujo de Gemini opcional y fallback determinista está implementado para la sesión guiada. Esto no implica uso de Gemini en otros productos o flujos.
- La observación de gobernanza a continuación corresponde al 18-09-2026; no se vuelve a certificar aquí el estado actual de GitHub.

## Normas

`AGENTS.md` y `docs/engineering/` definen TDD, TypeScript strict, rutas
delgadas, services, decimal string para peso, zona horaria Córdoba, copy es-AR
y PRs con review.

El código cumple una parte importante; GitHub no aplica varias reglas de
gobernanza.

## TypeScript y estilo

- `strict: true`, `noEmit`, alias `@/*`.
- `allowJs` y `skipLibCheck` siguen habilitados.
- ESLint 9 con reglas recomendadas de JS, TypeScript, React y hooks.
- `no-unused-vars` es warning, no error.
- No hay Prettier ni regla automatizada de orden de imports.

La política prohíbe `any`, pero producción contiene un cast explícito:

- `lib/services/tips.ts:55`

## Diseño de módulos

**Bien aplicado**

- services separados de routes;
- handlers Telegram por comando;
- componentes de sesión guiada separados;
- primitives UI y estados reutilizables;
- tipos de error compartidos;
- helpers puros para peso, fechas y progresión.

**A mejorar**

- `app/dashboard/workout/[id]/page.tsx` tiene 446 líneas y múltiples
  responsabilidades;
- el schema y la página manual superan el límite orientativo;
- UI importa tipos de persistencia;
- varias funciones públicas no tienen retorno explícito/JSDoc completo.

## Validación

La implementación es mixta:

- Zod en creación de workout y sets;
- validación manual en services de auth, mood y peso;
- `parseInt` para parámetros;
- interfaces TypeScript aplicadas directamente a `request.json()` en auth.

TypeScript no valida JSON en runtime. Login además asume que `email` y
`password` existen antes de llamar métodos sobre ellos. Se necesita un patrón
uniforme de schemas en el borde y reglas de negocio en services.

## Errores

`AppError` y `handleApiError` producen normalmente `{code,message}`. Algunas
rutas cron reimplementan el mapeo. Gemini devuelve `null` para cualquier falla
y Telegram registra errores HTTP sin propagarlos.

No hay logger estructurado, request ID, redacción central ni clasificación
operacional/programador.

## Frontend

- mobile-first y copy es-AR;
- primitives con variantes tipadas;
- labels/roles presentes en flujos principales;
- estados loading/empty/error reutilizables;
- varios Client Components hacen fetch manual y casts de respuesta.

Los errores de mutaciones a menudo se silencian o solo se escriben en consola;
faltan feedback y recuperación consistentes.

## Git y documentación — hallazgo histórico (18-09-2026)

Estado observado el 18-09-2026:

- `main` es default y está 55 commits detrás de `develop`;
- no hay rulesets ni branch protection;
- PRs recientes tienen cero reviews;
- existen commits `WIP` fusionados;
- no hay `CODEOWNERS`.

Esto contradice el flujo obligatorio de `AGENTS.md`.

En ese snapshot, README se consideró obsoleto porque declaraba scaffold y
dependencias/features pendientes; ADR-003 figuraba como “Propuesto” pese a
estar implementado. Ambas afirmaciones quedaron corregidas desde entonces.

## Evidence

- `AGENTS.md`
- `docs/engineering/conventions-fe.md`
- `docs/engineering/conventions-be.md`
- `docs/engineering/conventions-qa.md`
- `tsconfig.json`
- `eslint.config.mjs`
- `types/errors.ts`
- `lib/auth/middleware.ts`
- `lib/services/`
- `app/api/`
- `app/dashboard/workout/[id]/page.tsx`
- `README.md`
- `docs/architecture/ADR-003-gemini-guided-session.md`
