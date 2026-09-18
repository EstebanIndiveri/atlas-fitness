# Integraciones externas

## Inventario

| Sistema | Uso | Estado |
|---|---|---|
| Turso/libSQL | Persistencia remota o SQLite local | Implementado |
| Telegram Bot API | Canal conversacional | Implementado |
| Google Gemini | Sugerencia en sesión guiada | Implementado con fallback |
| GitHub Actions | CI | Implementado |
| PWA web | Instalación y shell offline | Implementado manualmente |
| Scheduler | Invocación de crons | No versionado |
| Observabilidad | Métricas/trazas/alertas | Ausente |

## Turso/libSQL

`lib/db/client.ts` selecciona Turso mediante variables o
`file:./local.db`. Drizzle centraliza schema y migraciones.

Riesgos: fallback local silencioso, tests sobre la misma ruta, falta de
backup/restore documentado, pocos índices y operaciones multi-step no
atómicas.

## Telegram

### Entrada

`POST /api/telegram/webhook` comprueba
`X-Telegram-Bot-Api-Secret-Token` solo si la variable está configurada. Sin
secret acepta cualquier update y luego confía en `message.from.id`.

### Vinculación

Los códigos expiran en diez minutos, pero se generan con `Math.random()`.
Debe usarse CSPRNG y rate limiting.

### Salida

El cliente usa `fetch` sin timeout, retry/backoff o manejo de 429. Los errores
HTTP se loguean y no se propagan. Sin token, hace no-op para desarrollo/CI.

### Idempotencia

El `update_id` se inserta antes de ejecutar el comando y enviar respuesta. Esto
evita duplicados, pero puede perder el mensaje si falla el side effect.

## Gemini

`lib/ai/gemini.ts`:

- mantiene la key server-side;
- usa una URL fija;
- impone timeout;
- solicita JSON;
- valida forma mínima;
- restringe la decisión final a ejercicios pendientes;
- retorna fallback ante ausencia o falla.

Brechas:

- `gemini-2.0-flash` hardcodeado;
- REST manual y key en query string;
- sin JSON Schema;
- sin `import 'server-only'`;
- mensaje sin límite validado;
- nombres interpolados sin delimitación de input no confiable;
- errores sin observabilidad;
- sin cuota/rate limit ni versionado de prompt.

No se confirmó SSRF, XSS o prompt injection explotable en el flujo actual: la
URL es fija, React escapa texto y el ID pasa por allowlist. Debe documentarse
que nombres/IDs se envían al proveedor antes de aceptar contenido personalizado.

## PWA

La implementación es propia:

- `app/manifest.ts`;
- `lib/pwa/manifest.ts`;
- `public/sw.js`;
- `ServiceWorkerRegister`.

El service worker cachea shell/estáticos, nunca `/api/*`, y usa fallback para
navegación offline. Existen tests de política e instalabilidad. Faltan pruebas
de upgrade real y una estrategia documentada de versionado/cache.

## CI

GitHub Actions ejecuta lint, typecheck, migraciones, Jest, build y Playwright.
Ante fallo E2E sube `playwright-report` con retención de 30 días.

Faltan branch protection, review obligatorio, coverage gate, Dependabot,
CodeQL, deployment y environments protegidos.

## Crons

Hay dos endpoints protegidos por `CRON_SECRET`:

- `daily-tip`;
- `streak-nudge`.

No existe scheduler versionado ni runbook operativo. El tip diario todavía usa
pool local; Gemini allí figura como mejora futura.

## Privacidad

Se almacenan workouts, pesos, mood, Telegram IDs y el update Telegram completo
en `bot_messages.raw_request`. No se encontró política de consentimiento,
retención, exportación, borrado o subprocesadores.

## Evidence

- `.env.example`
- `lib/db/client.ts`
- `lib/db/schema.ts`
- `lib/telegram/client.ts`
- `lib/telegram/idempotency.ts`
- `lib/telegram/process-update.ts`
- `lib/telegram/webhook-secret.ts`
- `app/api/telegram/webhook/route.ts`
- `lib/ai/gemini.ts`
- `lib/session/resolve-next.ts`
- `app/api/cron/`
- `.github/workflows/ci.yml`
- `app/manifest.ts`
- `lib/pwa/manifest.ts`
- `public/sw.js`
- `components/pwa/ServiceWorkerRegister.tsx`
