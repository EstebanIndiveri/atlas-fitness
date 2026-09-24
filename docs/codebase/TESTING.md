# Testing

## Estado actual — develop post PR #114 (2026-09-24)

PR #114 está mergeado en `develop`. Evidencia registrada en la wave:

| Validación | Resultado |
|---|---|
| Jest | 198 suites / 1126 tests aprobados |
| E2E completo | 40 aprobados / 1 omitido intencionalmente |
| Specs críticos (`auth`, `workouts`, `session`, `routines-editor`) | 51/51 con `repeat-each=3` |
| Typecheck / build | Aprobados |
| Lint | 0 errores + 1 warning preexistente en `lib/api/habits.test.ts:48` |
| RoutineEditor | E2E valida descanso `90 → vacío → 30` |

El PR corrigió carreras de observación al registrar waits antes de ejecutar las acciones. También reemplazó el login QA permisivo por aserciones obligatorias de respuesta 200, navegación y mensaje de bienvenida. Estas son evidencias de la wave y no una declaración de que cada riesgo histórico del harness se haya cerrado.

### Cierres demostrados desde la auditoría anterior

- La DB de Jest está aislada bajo `/tmp`; se rechazan `local.db` y URLs remotas (`lib/db/database-url.ts`, `lib/db/test-database.ts`, `jest.setup-env.ts`).
- Las regresiones de sesión expirable/revocable y ownership de catálogo que figuraban como faltantes en el snapshot están cubiertas por `lib/auth/session-store.test.ts`, `lib/auth/ownership.test.ts` y los tests de services de ejercicios/rutinas.
- Las regresiones P0 de secreto de sesión/webhook, invariantes de workouts y aislamiento de DB se implementaron; ver el estado/evidencia en `docs/engineering/p0-hardening.md`.
- La carrera wait/action en E2E y el falso positivo de login descritos abajo fueron corregidos en PR #114. La cobertura RoutineEditor comprueba el borrado del valor y su reemplazo por 30.
- El riesgo de contaminación entre suites señalado abajo no se declara resuelto por PR #114: los resultados de esa wave no prueban por sí solos una solución de seed/reutilización de DB.

## HALLAZGO HISTÓRICO — resultados ejecutados sobre `53bc87b` (18-09-2026)

Sobre `53bc87b`, el 18-09-2026:

| Validación | Resultado |
|---|---|
| Jest | 48 suites, 272 tests aprobados |
| `npx jest --runInBand --coverage` | 91.78% statements, 81.49% branches |
| Playwright con DB fresca | 42 aprobados, 1 flaky aprobado en retry, 1 omitido |
| Typecheck | aprobado |
| Build | aprobado con warnings |
| npm audit | 4 moderadas |

El repositorio contiene 58 archivos de test: 48 Jest y 10 specs Playwright.

## Jest

`jest.config.ts` usa `next/jest`, proveedor V8, `jsdom`, alias `@/*` y excluye
E2E. `setupFiles`/`setupFilesAfterEnv` apuntan a `jest.setup-env.ts` y `jest.setup.ts`.
`ts-jest` está instalado, pero la configuración activa usa el transform de
Next/SWC.

No hay:

- script de coverage;
- `collectCoverageFrom`;
- thresholds.

Jest usa `jest.setup-env.ts` + `jest.setup.ts`: DB temporal bajo `/tmp`, guard contra `local.db` / Turso, y migrate por proceso. `npm test` no toca `./local.db`.

Por eso el porcentaje cubre archivos importados por las suites, no
necesariamente toda la superficie de producción.

## Playwright

`playwright.config.ts`:

- ejecuta Chromium;
- usa `npm run start`, por lo que requiere build previo;
- corre paralelo localmente y con un worker en CI;
- reutiliza server existente fuera de CI;
- captura trace en primer retry;
- inyecta DB/secrets de test al web server.

Los 10 specs cubren home, auth, workouts, sesión guiada, streaks, tips, Telegram,
crons, estilos y PWA. Un caso de prompt PWA se omite porque Chromium headless no
dispara `beforeinstallprompt`.

## Fortalezas

- buen volumen para el tamaño del código;
- services y helpers de dominio ampliamente cubiertos;
- pruebas de fallback Gemini;
- pruebas de idempotencia Telegram;
- pruebas de PWA, contraste y tokens;
- E2E de flujos Must;
- CI: Jest aísla su DB en `/tmp`. Playwright usa `file:./local.db` en un checkout fresco (E2E, no `npm test`).

## Riesgos del harness observados históricamente

### Tests destructivos

Mitigado (P0.3): bajo Jest el cliente rechaza `file:./local.db` y URLs remotas.
`npm test` crea un archivo único en `/tmp` y migra ahí. Los `DELETE` de suites
siguen existiendo, pero sobre esa DB aislada.

### Contaminación entre suites

Jest puede recrear `bench-press` sin media. El seed omite actualizar ejercicios
existentes, por lo que correr E2E después sobre la misma DB deja la sesión sin
el recurso esperado. Con DB fresca, Playwright pasa.

### Falso positivo histórico — corregido en PR #114

`e2e/auth.spec.ts:116-135` permite resultados alternativos y puede aprobar sin
demostrar un login QA exitoso.

### E2E flaky por carrera de observación — corregido en PR #114

La verificación final reprodujo un timeout en
`e2e/workouts.spec.ts:96-101`; el retry pasó. El test hace click y recién
después registra `waitForResponse`, por lo que puede perder una respuesta rápida.
El mismo orden aparece al guardar sets.

Debe registrar la espera antes de disparar la acción, por ejemplo con
`Promise.all([page.waitForResponse(...), button.click()])`.

### Regresiones sin test en la auditoría histórica

Faltan casos P1 para:

- ownership de ejercicios/rutinas personalizados;
- expiración/revocación de sesión.

P0 cubiertos: múltiples workouts activos; update/delete de sets finalizados; `routineId` inválido; secret de sesión fallback; webhook fail-open en producción.

## Warnings

El build completó con warnings por un `pnpm-lock.yaml` externo usado para
inferir workspace y por el módulo de `tailwind.config.ts`. ESLint no ignora
`coverage/`, por lo que una ejecución local de coverage agrega ruido posterior.

## Recomendación histórica

1. ~~DB temporal única por ejecución/worker.~~ (P0.3)
2. ~~Guard que aborte si tests apuntan a `local.db`.~~ (P0.3)
3. Seed idempotente que actualice datos canónicos.
4. Tests RED para P1 restantes.
5. Script y threshold de coverage por módulos críticos.
6. No reutilizar servers locales para validación reproducible.
7. Mantener E2E Must sobre build y DB fresca.

## Evidence

- `package.json`
- `jest.config.ts`
- `playwright.config.ts`
- `.github/workflows/ci.yml`
- `lib/db/client.ts`
- `lib/db/seed.ts`
- `lib/**/*.test.ts`
- `components/**/*.test.tsx`
- `hooks/*.test.ts`
- `e2e/*.spec.ts`
- `e2e/auth.spec.ts`
- `e2e/session.spec.ts`
