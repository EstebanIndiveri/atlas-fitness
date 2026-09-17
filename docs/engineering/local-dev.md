# Desarrollo local y Box — Atlas Fitness

Guía para correr la app **sin Turso cloud ni secretos reales**. La base por defecto es un archivo SQLite (`file:./local.db`). Sirve igual en **localhost** (laptop) y en una **Box** de agente.

Zona horaria canónica: `America/Argentina/Cordoba`. Copy de producto: `es-AR`.

## Requisitos

- Node.js 20+
- npm
- Git

No hace falta cuenta de Turso, token de Telegram, ni túnel público para el smoke Must.

## Arranque (localhost y Box)

Desde la raíz del repo:

```bash
npm i
cp .env.example .env          # si todavía no existe .env
npm run db:migrate            # aplica migraciones al file DB
npm run db:seed               # usuario QA + ejercicios + tips de ejemplo
npm run dev                   # http://localhost:3000
```

Atajo one-shot (copia `.env` solo si falta, luego migrate + seed):

```bash
npm i
npm run setup:local
npm run dev
```

`setup:local` **no pisa** un `.env` existente.

### Generar secretos locales (opcional)

Los placeholders de `.env.example` alcanzan para smoke. Si querés valores propios:

```bash
openssl rand -hex 32   # SESSION_SECRET
openssl rand -hex 32   # CRON_SECRET
```

Pegá el output en `.env`. **Nunca commitees `.env`** ni tokens reales.

### Variables

| Variable | Local / Box | Notas |
|----------|-------------|--------|
| `TURSO_DATABASE_URL` | `file:./local.db` | Default. No uses `libsql://…` salvo que hayas elegido Turso cloud. |
| `TURSO_AUTH_TOKEN` | vacío | Solo Turso cloud. El file DB no lo necesita. |
| `SESSION_SECRET` | placeholder o `openssl rand -hex 32` | HMAC de la cookie de sesión. |
| `CRON_SECRET` | placeholder o `openssl rand -hex 32` | Bearer de `/api/cron/*`. Playwright CI inyecta `test-secret-for-e2e` en `webServer.env` — no lo saques del config. |
| `TELEGRAM_BOT_TOKEN` | vacío | Vacío = sin HTTP saliente a Telegram. |
| `TELEGRAM_WEBHOOK_SECRET` | vacío | Vacío = el stub/curl no exige header. |

El file DB `local.db` está en `.gitignore`. `tsx` carga `.env` vía `lib/dev/load-local-env.ts` (Next.js ya carga `.env` para `npm run dev`).

## Localhost vs Box

Los comandos son los mismos. Diferencias prácticas:

| | Localhost (laptop) | Box (máquina de agente) |
|---|--------------------|-------------------------|
| Browser | Abrí [http://localhost:3000](http://localhost:3000) | Mismo origin en la Box, o la URL de preview/port-forward del entorno |
| DB | `./local.db` en el checkout | Igual; no hay que provisionar Turso |
| Auth smoke | Login en el browser | Igual, o curl a `/api/auth/login` si no hay GUI |
| Telegram | Stub `POST /api/telegram/webhook` a localhost | Igual; **no** hace falta red hacia `api.telegram.org` |
| Crons | curl con `Authorization: Bearer $CRON_SECRET` | Igual, contra el puerto 3000 de la Box |

En Box: no pegues tokens de producción. El seed y el webhook stub alcanzan para validar UI/API/DB.

## Usuario seed

| Campo | Valor |
|-------|--------|
| Email | `qa@atlas.test` |
| Password | `Test1234!` |
| Nombre | QA Test User |

Definido en `lib/db/seed.ts`. El seed es idempotente (re-hashea la password si el user ya existe).

## Checklist de smoke

Con el server arriba (`npm run dev` o `npm start` tras `npm run build`):

1. **Login** — `/login` → `qa@atlas.test` / `Test1234!` → dashboard.
2. **TipCard → mood** — en dashboard, card “Consejo del día”; tocá un mood (1–5). Recargá: el mood sigue marcado.
3. **Crear / finalizar workout** — “Empezar Entreno” → agregar un set (ejercicio seed, reps, peso decimal) → Finalizar.
4. **Telegram link-code + webhook stub** — Ajustes → generar código; **no** hace falta BotFather. POST al webhook (abajo). Segundo POST con el mismo `update_id` → `duplicate: true`.
5. **Streak chip** — en dashboard, chip de racha (`data-testid="streak-chip"`). Tras cerrar un workout hoy (TZ Córdoba) debería verse `1`.
6. **PWA iOS copy** — en Home (`/`) el bloque “Agregar a Inicio” / Home Screen (`data-testid="ios-install-hint"`). También en Ajustes.

### curl: cron tip / nudge

Cargá `CRON_SECRET` desde `.env` (placeholders de example o el valor que hayas puesto):

```bash
set -a && source .env && set +a

# Tip diario (idempotente; fallback system si no hay IA)
curl -sS http://localhost:3000/api/cron/daily-tip \
  -H "Authorization: Bearer $CRON_SECRET"

# Nudge de racha (usuarios activos ayer y no hoy, TZ Córdoba)
curl -sS http://localhost:3000/api/cron/streak-nudge \
  -H "Authorization: Bearer $CRON_SECRET"
```

Sin header o con Bearer incorrecto → `401` `{ "code": "UNAUTHORIZED" }`.

### curl: webhook stub, `update_id` duplicado

Sin `TELEGRAM_WEBHOOK_SECRET` (default local) no hace falta header extra. No hay llamadas de red a Telegram si `TELEGRAM_BOT_TOKEN` está vacío.

```bash
# 1) Login seed + link-code (cookie de sesión)
curl -sS -c /tmp/atlas-cookies -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"qa@atlas.test","password":"Test1234!"}'

CODE=$(curl -sS -b /tmp/atlas-cookies -X POST http://localhost:3000/api/auth/telegram/link-code \
  | sed -n 's/.*"code":"\([^"]*\)".*/\1/p')

# 2) Primer update → duplicate: false
curl -sS -X POST http://localhost:3000/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d "{\"update_id\": 9001, \"message\": {\"message_id\": 1, \"date\": 1710000000, \"text\": \"$CODE\", \"from\": {\"id\": 4242, \"is_bot\": false, \"first_name\": \"Stub\"}, \"chat\": {\"id\": 4242, \"type\": \"private\"}}}"

# 3) Mismo update_id → {"ok":true,"duplicate":true}  (sin segundo side effect)
curl -sS -X POST http://localhost:3000/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d "{\"update_id\": 9001, \"message\": {\"message_id\": 1, \"date\": 1710000000, \"text\": \"$CODE\", \"from\": {\"id\": 4242, \"is_bot\": false, \"first_name\": \"Stub\"}, \"chat\": {\"id\": 4242, \"type\": \"private\"}}}"
```

Si no te interesa el link y solo la idempotencia, cualquier JSON con `update_id` numérico sirve: el segundo POST con el mismo id debe devolver `duplicate: true`.

## Túnel Telegram (opcional — no requerido)

El smoke de Box/localhost usa el stub HTTP de arriba. **No hace falta** ngrok, Cloudflare Tunnel, ni un bot real.

Si más adelante querés que @BotFather pegue a esta máquina:

1. Exponé el puerto 3000 (`npx ngrok http 3000` o `cloudflared tunnel --url http://localhost:3000`).
2. Poné `TELEGRAM_BOT_TOKEN` y, recomendado, `TELEGRAM_WEBHOOK_SECRET` en `.env`.
3. Registrá el webhook en Telegram apuntando a `https://<túnel>/api/telegram/webhook`.

Eso es Should de integración, no parte del smoke Must.

## Tests

```bash
npm run lint
npm run typecheck
npm test                 # Jest (incluye loader de .env y setup:local)
npm run test:e2e         # Playwright — primero migrate + seed + build
```

Playwright levanta `npm start` con `CRON_SECRET` en `webServer.env` (default `test-secret-for-e2e` si no hay env). No hace falta Telegram real.

## Fuera de este doc

- Crons de producción en Vercel (`vercel.json`) — PR aparte.
- Mini App / offline sync — no Must.
- Secretos reales en el repo — prohibido.
