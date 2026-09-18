# Hallazgos, riesgos y prioridades

## Veredicto

Atlas Fitness ya no es un scaffold: tiene un producto MVP funcional con
autenticación, workouts, rutinas, progreso, mood, Telegram, PWA y sesión guiada
con IA. La arquitectura base es razonable y la cobertura automatizada es
superior a la de muchos MVP.

El estado actual no debe considerarse listo para producción pública. Existen
dos bypasses de autenticación configuracionales, sesiones no revocables,
invariantes de workout quebradas, aislamiento incompleto de datos de usuario y
un harness de tests capaz de borrar datos locales. Además, la gobernanza
documentada no está siendo aplicada por GitHub.

## Escenario objetivo confirmado

La priorización asume una **beta pública wellness en Argentina durante los
próximos tres meses, sin recomendaciones médicas**.

Esto mantiene el producto fuera de un posicionamiento clínico, pero no elimina
la sensibilidad de datos de peso, actividad y mood. Para abrir la beta deben
estar resueltos todos los P0 y, como mínimo, los P1 de sesión, ownership, rate
limiting, privacidad, gobernanza y confiabilidad de Telegram.

## P0 — bloquear exposición pública

### P0.1 Secreto fallback permite falsificar sesiones

**Evidencia:** `lib/auth/session.ts:4-6`, `lib/auth/session.ts:26-47`.

Si `SESSION_SECRET` falta, se usa un valor público conocido. Una cookie HMAC
fabricada con cualquier `userId` es aceptada por `requireAuth`.

**Impacto:** bypass completo de autenticación y acceso a datos wellness.

**Acción:**

- validar entorno al iniciar;
- fallar en producción si falta o es débil;
- proporcionar un secret explícito en CI;
- rotar cualquier secret de entorno potencialmente desplegado;
- añadir test de regresión.

### P0.2 Webhook Telegram acepta requests sin autenticación

**Evidencia:** `lib/telegram/webhook-secret.ts:5-10`,
`app/api/telegram/webhook/route.ts:12-20`,
`lib/telegram/process-update.ts:55-65`.

Sin `TELEGRAM_WEBHOOK_SECRET`, cualquier request es válido. Los handlers confían
en `message.from.id`; con un ID vinculado, un atacante puede consultar o
modificar datos mediante updates falsos.

**Acción:** exigir secret en producción y siempre que exista bot token; permitir
modo inseguro solo con flag explícito de test/desarrollo; comparación
timing-safe y test de explotación.

### P0.3 Tests destructivos usan la DB local por defecto

**Evidencia:** `lib/db/client.ts:4-11`, tests de `lib/services/` que borran
tablas.

`npm test` puede operar sobre `file:local.db` y eliminar datos de desarrollo.

**Acción:** DB temporal obligatoria, guard de URL, migración/seed automáticos y
separación por worker/suite.

### P0.4 Invariantes centrales de workout no están protegidas

Pruebas directas sobre la API/services demostraron:

```json
{
  "simultaneousActiveWorkouts": 2,
  "updatedFinishedWorkoutSetWeight": "20",
  "deletedFinishedWorkoutSet": true,
  "invalidRoutineBodyStatus": 201
}
```

**Evidencia:** `lib/services/workouts.ts:22-41`,
`lib/services/workout-sets.ts:101-174`,
`app/api/workouts/route.ts:24-27`.

**Acción:**

- constraint/operación atómica para un workout activo;
- rechazar mutación de sets finalizados en service;
- devolver 400 para `routineId` inválido;
- tests RED de happy, edge, error y concurrencia.

## P1 — antes de beta pública

### P1.1 Sesiones deterministas, no expirables ni revocables

**Evidencia:** `lib/auth/session.ts:26-62`, `types/auth.ts:19-21`.

La cookie contiene solo `userId`. Dos logins producen el mismo token. El
servidor no valida `iat`/`exp`; `Max-Age` es una instrucción para el navegador,
no una invalidación criptográfica. Logout no revoca un token robado.

**Acción:** `iat`, `exp`, `sessionId` aleatorio y revocación/versionado por
usuario; rotación al cambiar credenciales.

### P1.2 Aislamiento incompleto de ejercicios y rutinas personalizados

**Evidencia:** `app/api/exercises/route.ts:10-19`,
`lib/services/routines.ts:11-33`, `app/api/routines/route.ts:8-12`,
`app/api/routines/[id]/route.ts:13-21`,
`lib/services/workouts.ts:22-30`,
`lib/services/workout-sets.ts:43-72`,
`lib/services/day-summary.ts:83-90`.

El schema soporta ejercicios y rutinas por usuario, pero listados, lectura,
creación de workout y mutaciones de sets no aplican siempre
`isSystem || userId === currentUser`. El day summary contiene un ejemplo
correcto que debe reutilizarse. El riesgo queda latente mientras solo existan
filas del seed y será explotable al habilitar recursos personalizados.

**Acción:** política de ownership central, validación transaccional y DTOs que
no expongan `userId`.

### P1.3 Sin rate limiting ni protección de consumo

**Progreso P1.3:** rate limit durable por IP+acción en `POST /api/auth/login` y
`POST /api/auth/register` (tabla `rate_limit_buckets`, ventana fija 60s, HTTP
429 + `Retry-After`). Telegram, webhook, Gemini y crons quedan para P1.3b.

Superficies:

- login/registro ✅ (P1.3);
- generación de códigos Telegram;
- webhook;
- Gemini;
- crons.

**Riesgo:** fuerza bruta, spam, DoS y costos externos. Corresponde a OWASP API
Security `API4:2023 Unrestricted Resource Consumption` y `API6`.

**Acción:** límites por IP/usuario/acción, cooldowns, cuotas y límites de body.

### P1.4 Integridad y validación de datos incompletas

Faltan límites de longitud/tamaño para nombres, notas, mensajes y credenciales;
CHECK constraints para mood, reps, pesos y targets; y validación uniforme de
params/body.

**Evidencia:** `lib/services/auth.ts`, `lib/db/schema.ts`,
`app/api/auth/login/route.ts`, `app/api/workouts/[id]/sets/route.ts`.

**Acción:** límites Zod alineados con constraints DB y errores `{code,message}`.

### P1.5 Privacidad de datos wellness no definida

Se almacenan pesos, entrenamientos, mood y mensajes Telegram. No se encontró
consentimiento, retención, exportación, eliminación de cuenta, clasificación de
datos ni inventario de terceros.

**Evidencia:** `lib/db/schema.ts`, `bot_messages.raw_request`, ausencia de
políticas en `docs/` y `README.md`.

**Acción:** política de privacidad y retención, borrado/exportación, minimización
de `raw_request`, threat model y revisión legal según mercados objetivo.

### P1.6 Gobernanza declarada, no aplicada

Estado de GitHub:

- sin rulesets o branch protection;
- sin reviewers obligatorios;
- PRs recientes con cero reviews;
- `main` 55 commits detrás de `develop`;
- commits `WIP` fusionados;
- sin `CODEOWNERS`.

**Evidencia:** `AGENTS.md:31-76`, inspección GitHub del 18-09-2026.

**Acción:** proteger `main/develop`, checks requeridos, una aprobación mínima,
CODEOWNERS, releases/RC reales y Conventional Commits.

### P1.7 Telegram puede perder updates

El update se persiste antes del side effect y el cliente no propaga errores
HTTP. Un fallo puede quedar marcado como duplicado permanentemente.

**Evidencia:** `lib/telegram/idempotency.ts`, `lib/telegram/client.ts`,
`lib/telegram/process-update.ts`.

**Acción:** estado transaccional/outbox, retry con backoff, timeout, manejo de
429 y métricas de entrega.

### P1.8 Escalabilidad de lecturas

| Hallazgo | Evidencia |
|---|---|
| streak relee historial completo | `lib/services/streaks.ts` |
| cron relee workouts finalizados globales | `lib/services/streaks.ts` |
| rutinas hacen query adicional por rutina | `lib/services/routines.ts` |
| resumen diario consulta sets por workout | `lib/services/day-summary.ts` |
| guided session consulta por ejercicio/resumen | `lib/services/guided-session.ts` |
| avisos consultan y envían por usuario | `lib/telegram/notify-linked.ts` |
| historial y PRs no paginan | `lib/services/stats.ts`, rutas relacionadas |
| faltan índices secundarios | `lib/db/schema.ts` |

**Acción:** medir, paginar, agrupar, indexar y procesar jobs por lotes. No
introducir microservicios antes de resolver estos patrones.

### P1.9 La suite E2E no es determinista

La ejecución final sobre DB aislada terminó con 42 tests aprobados, uno omitido
y uno flaky que pasó en retry. En `e2e/workouts.spec.ts:96-101`,
`waitForResponse` se registra después del click y puede perder la respuesta.

**Acción:** registrar espera y acción en paralelo, eliminar waits susceptibles
a carreras y exigir cero flakies en CI.

## P2 — fortalecimiento y mantenibilidad

### P2.1 Contratos API acoplados al schema

UI y hooks importan tipos Drizzle; fechas `Date` se convierten a strings JSON.

**Acción:** DTOs/versiones de contrato, mappers y cliente tipado.

### P2.2 Gemini por detrás del patrón actual

`lib/ai/gemini.ts` usa modelo `gemini-2.0-flash`, REST manual, API key en query
string y salida libre. Tampoco declara `server-only`, delimita nombres de
ejercicios como datos no confiables ni valida la longitud final del mensaje.

**Acción:** SDK oficial, modelo configurable vigente, header para credencial,
JSON Schema, `server-only`, delimitación de input, métricas, cuotas, versionado
de prompt y evaluación de calidad.

### P2.3 Sin observabilidad

No hay error tracking, métricas, tracing, IDs de correlación, dashboards ni
alertas de cron/proveedor.

**Acción:** logging estructurado con redacción, métricas de negocio/técnicas y
alertas mínimas antes de crecer.

### P2.4 Documentación desactualizada

- README dice “Phase 1 Scaffold”.
- ADR-003 sigue “Propuesto”.
- backlog no representa todo lo implementado.

**Acción:** convertir documentación en parte del Definition of Done.

### P2.5 Supply chain y configuración

- cuatro vulnerabilidades moderadas de tooling;
- build tools en dependencias productivas;
- sin Dependabot/CodeQL;
- sin security headers explícitos;
- sin `SECURITY.md`;
- Node/npm no fijados;
- build con warnings de workspace, Tailwind y artefactos.

**Acción:** corregir clasificación/actualización, automatizar escaneo, pin de
runtime y headers CSP/referrer/permissions/frame.

## Seguridad: resumen independiente

La revisión especializada de solo lectura verificó:

| Severidad | Cantidad | Hallazgos |
|---|---:|---|
| Critical | 0 | — |
| High | 2 | secret de sesión; webhook sin autenticación |
| Medium | 2 | sesión no expirable; recursos de usuario ajenos |
| Hardening / Info | 4 | tooling, headers y controles Gemini |

No se detectaron secretos versionados. No se realizó DAST ni se inspeccionó la
configuración efectiva desplegada, por lo que ausencia de hallazgos adicionales
no equivale a garantía.

La revisión específica de Gemini no confirmó SSRF, XSS ni prompt injection
explotable actualmente: la URL es fija, la UI escapa el texto y la decisión de
ejercicio usa una allowlist. Las observaciones de IA son de hardening y
privacidad preventiva.

## Estado del arte de referencia

- OWASP API Security Top 10 2023: autorización por objeto, autenticación,
  consumo de recursos, inventario y consumo de APIs.
  <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>
- NIST SSDF 1.1: seguridad integrada al SDLC, protección, producción segura y
  respuesta a vulnerabilidades.
  <https://csrc.nist.gov/Projects/ssdf>
- NIST AI RMF y perfil de IA generativa: gobernar, mapear, medir y gestionar
  riesgos de IA.
  <https://www.nist.gov/itl/ai-risk-management-framework>
- WCAG 2.2 AA para accesibilidad de la PWA.
  <https://www.w3.org/TR/WCAG22/>
- Next.js 16: DAL server-only, verificación de sesión cerca del dato y Server
  Components para carga inicial.
- Gemini API: SDK oficial y salidas estructuradas con JSON Schema.

## Orden recomendado de remediación

1. Aislar DB de tests y escribir regresiones RED.
2. Eliminar defaults inseguros de sesión/webhook.
3. Corregir sesión expirable/revocable.
4. Cerrar invariantes de workout y ownership.
5. Añadir rate limiting y límites de input.
6. Proteger branches y exigir reviews/checks.
7. Definir privacidad y manejo de datos wellness.
8. Hacer confiables Telegram, Gemini y crons.
9. Paginar, indexar y eliminar N+1.
10. Actualizar contratos, documentación y observabilidad.

## Áreas de alto churn o riesgo

- `lib/auth/session.ts`
- `lib/services/workouts.ts`
- `lib/services/workout-sets.ts`
- `lib/services/guided-session.ts`
- `lib/services/streaks.ts`
- `lib/telegram/process-update.ts`
- `lib/telegram/idempotency.ts`
- `lib/ai/gemini.ts`
- `lib/db/schema.ts`
- `hooks/useGuidedSession.ts`
- `app/dashboard/workout/[id]/page.tsx`

## [ASK USER] Questions

No quedan preguntas bloqueantes para esta auditoría. El escenario operativo fue
confirmado como beta pública wellness en Argentina, sin recomendaciones
médicas.

## Evidence

- `lib/auth/session.ts`
- `lib/telegram/webhook-secret.ts`
- `app/api/telegram/webhook/route.ts`
- `lib/telegram/process-update.ts`
- `app/api/exercises/route.ts`
- `lib/services/stats.ts`
- `lib/services/workout-sets.ts`
- `lib/services/workouts.ts`
- `lib/services/routines.ts`
- `lib/services/streaks.ts`
- `lib/services/guided-session.ts`
- `lib/services/day-summary.ts`
- `lib/telegram/notify-linked.ts`
- `lib/ai/gemini.ts`
- `lib/db/schema.ts`
- `lib/db/client.ts`
- `jest.config.ts`
- `playwright.config.ts`
- `.github/workflows/ci.yml`
- `AGENTS.md`
- `README.md`
