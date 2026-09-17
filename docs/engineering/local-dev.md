# Desarrollo local y Box — Atlas Fitness

Dos caminos. El default **no** pide red ni cuentas externas.

| Camino | Cuándo | Red / secretos |
|--------|--------|----------------|
| **Smoke local (sin red)** | Laptop, Box de agente, CI | File SQLite `file:./local.db`. Telegram stub (curl). Sin Turso cloud, sin BotFather, sin túnel. |
| **Integraciones reales (opcionales)** | Cuando quieras pegar a Turso / un bot de verdad | `libsql://…` + token; BotFather + túnel HTTPS + `setWebhook`. IA **no está cableada** (tip system). |

Zona horaria canónica: `America/Argentina/Cordoba`. Copy de producto: `es-AR`.

---

## Smoke local (sin red)

Guía para correr la app **sin Turso cloud ni secretos reales**. La base por defecto es un archivo SQLite (`file:./local.db`). Sirve igual en **localhost** (laptop) y en una **Box** de agente.

### Requisitos

- Node.js 20+
- npm
- Git

No hace falta cuenta de Turso, token de Telegram, ni túnel público para el smoke Must.

### Arranque (localhost y Box)

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

#### Generar secretos locales (opcional)

Los placeholders de `.env.example` alcanzan para smoke. Si querés valores propios:

```bash
openssl rand -hex 32   # SESSION_SECRET
openssl rand -hex 32   # CRON_SECRET
```

Pegá el output en `.env`. **Nunca commitees `.env`** ni tokens reales.

### Variables (smoke)

| Variable | Local / Box | Notas |
|----------|-------------|--------|
| `TURSO_DATABASE_URL` | `file:./local.db` | Default. No uses `libsql://…` en este camino. |
| `TURSO_AUTH_TOKEN` | vacío | El file DB no lo necesita. |
| `SESSION_SECRET` | placeholder o `openssl rand -hex 32` | HMAC de la cookie de sesión. |
| `CRON_SECRET` | placeholder o `openssl rand -hex 32` | Bearer de `/api/cron/*`. Playwright CI inyecta `test-secret-for-e2e` en `webServer.env` — no lo saques del config. |
| `TELEGRAM_BOT_TOKEN` | vacío | Vacío = sin HTTP saliente a `api.telegram.org`. |
| `TELEGRAM_WEBHOOK_SECRET` | vacío | Vacío = el stub/curl no exige header. |

El file DB `local.db` está en `.gitignore`. `tsx` carga `.env` vía `lib/dev/load-local-env.ts` (Next.js ya carga `.env` para `npm run dev`).

### Localhost vs Box

Los comandos son los mismos. Diferencias prácticas:

| | Localhost (laptop) | Box (máquina de agente) |
|---|--------------------|-------------------------|
| Browser | Abrí [http://localhost:3000](http://localhost:3000) | Mismo origin en la Box, o la URL de preview/port-forward del entorno |
| DB | `./local.db` en el checkout | Igual; no hay que provisionar Turso |
| Auth smoke | Login en el browser | Igual, o curl a `/api/auth/login` si no hay GUI |
| Telegram | Stub `POST /api/telegram/webhook` a localhost | Igual; **no** hace falta red hacia `api.telegram.org` |
| Crons | curl con `Authorization: Bearer $CRON_SECRET` | Igual, contra el puerto 3000 de la Box |

En Box: no pegues tokens de producción. El seed y el webhook stub alcanzan para validar UI/API/DB.

### Usuario seed

| Campo | Valor |
|-------|--------|
| Email | `qa@atlas.test` |
| Password | `Test1234!` |
| Nombre | QA Test User |

Definido en `lib/db/seed.ts`. El seed es idempotente (re-hashea la password si el user ya existe).

### Checklist de smoke

Con el server arriba (`npm run dev` o `npm start` tras `npm run build`):

1. **Login** — `/login` → `qa@atlas.test` / `Test1234!` → dashboard.
2. **TipCard → mood** — en dashboard, card “Consejo del día”; tocá un mood (1–5). Recargá: el mood sigue marcado.
3. **Crear / finalizar workout** — “Empezar Entreno” → agregar un set (ejercicio seed, reps, peso decimal) → Finalizar.
4. **Telegram link-code + webhook stub** — Ajustes → generar código; **no** hace falta BotFather. POST al webhook (abajo). Segundo POST con el mismo `update_id` → `duplicate: true`.
5. **Streak chip** — en dashboard, chip de racha (`data-testid="streak-chip"`). Tras cerrar un workout hoy (TZ Córdoba) debería verse `1`.
6. **PWA iOS copy** — en Home (`/`) el bloque “Agregar a Inicio” / Home Screen (`data-testid="ios-install-hint"`). También en Ajustes.

#### curl: cron tip / nudge

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

#### curl: webhook stub, `update_id` duplicado

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

Si más adelante llenaste `TELEGRAM_WEBHOOK_SECRET` para el bot real, este curl de smoke **también** tiene que mandar el header `X-Telegram-Bot-Api-Secret-Token` (mismo valor). Para volver al stub sin header, vaciá el secret y reiniciá el server — ver [Volver al smoke](#volver-al-smoke-sin-red).

---

## Integraciones reales (opcionales)

No son el Must de Box/CI. El smoke de arriba sigue siendo el camino default. Acá se cablean servicios de verdad **en tu máquina**, con secretos solo en `.env` (nunca en el repo).

Después de editar `.env`, **reiniciá** `npm run dev`: Next carga env al arrancar.

### Turso cloud

El cliente libSQL (`lib/db/client.ts`, `lib/db/migrate.ts`) usa `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` opcional. Con `file:./local.db` el token va vacío. Con `libsql://…` el token es obligatorio.

1. Creá una base en [Turso](https://turso.tech) (dashboard o CLI). Ejemplo con CLI:

   ```bash
   # https://docs.turso.tech/cli/installation
   turso auth login
   turso db create atlas-fitness
   turso db show atlas-fitness --url          # → libsql://…
   turso db tokens create atlas-fitness       # → eyJ…
   ```

2. Pegá en `.env` (no commitees):

   ```bash
   TURSO_DATABASE_URL=libsql://tu-db.turso.io
   TURSO_AUTH_TOKEN=eyJ…          # el token que te dio Turso
   ```

3. Aplicá schema y seed **sobre esa base cloud** (es otra DB; no se copia `local.db` solo):

   ```bash
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

4. Login smoke igual: `qa@atlas.test` / `Test1234!` (el seed es el mismo, ahora en Turso).

#### Volver a `file:./local.db`

En `.env`:

```bash
TURSO_DATABASE_URL=file:./local.db
TURSO_AUTH_TOKEN=
```

Token **vacío** (no un placeholder). Reiniciá el server. Si `local.db` no existía o está vacío:

```bash
npm run db:migrate
npm run db:seed
```

Los datos de Turso cloud y del archivo son independientes. Cambiar la URL no migra filas de un lado al otro.

### Telegram real

El camino default sigue siendo el **stub** de smoke (token vacío, sin HTTP saliente). Esto es opt-in.

Atlas valida el webhook con el header `X-Telegram-Bot-Api-Secret-Token` si `TELEGRAM_WEBHOOK_SECRET` está seteado (`lib/telegram/webhook-secret.ts`). **No** lee un `?secret=` de query. Telegram manda ese header cuando registrás el webhook con `secret_token` (Bot API).

#### 1. Bot en BotFather

1. En Telegram, abrí [@BotFather](https://t.me/BotFather) → `/newbot`.
2. Nombre y username (tiene que terminar en `bot`).
3. Copiá el token (`123456:ABC…`) a `.env`:

   ```bash
   TELEGRAM_BOT_TOKEN=123456:ABC…
   ```

   Vacío = stub (sin `api.telegram.org`). Con token, `sendMessage` sale a Telegram (`lib/telegram/client.ts`).

#### 2. Secret del webhook

Elegí un valor (1–256 chars: `A-Z` `a-z` `0-9` `_` `-`). Hex de openssl sirve:

```bash
openssl rand -hex 32   # TELEGRAM_WEBHOOK_SECRET
```

En `.env`:

```bash
TELEGRAM_WEBHOOK_SECRET=el-valor-que-elegiste
```

Recomendado en bot real. Si queda vacío, Atlas no exige el header (útil solo para el curl de smoke).

#### 3. Túnel HTTPS al puerto 3000

Telegram **no** pega a `http://localhost`. Hace falta una URL `https://…` pública.

Con el server local arriba (`npm run dev` en `:3000`):

```bash
# ngrok
npx ngrok http 3000
# copiá https://xxxx.ngrok-free.app

# o Cloudflare quick tunnel
cloudflared tunnel --url http://localhost:3000
# copiá https://xxxx.trycloudflare.com
```

La URL cambia si reiniciás el túnel gratis: volvé a correr `setWebhook`.

Si ngrok muestra interstitial HTML, el POST de Telegram puede fallar; Cloudflare tunnel suele ser más limpio para bots.

#### 4. `setWebhook`

Webhook de Atlas: `POST /api/telegram/webhook` (route thin en `app/api/telegram/webhook/route.ts`).

```bash
set -a && source .env && set +a
# reemplazá TU-TUNEL por el https del paso 3 (sin slash final)

curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://TU-TUNEL/api/telegram/webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

Respuesta esperada: `"Webhook was set"`. Telegram va a mandar cada update a esa URL con header `X-Telegram-Bot-Api-Secret-Token: <secret_token>`. Atlas compara ese header con `TELEGRAM_WEBHOOK_SECRET`.

Chequeo:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

`url` tiene que ser `https://…/api/telegram/webhook`. Si `last_error_message` no está vacío, el túnel o el secret no calzan.

Para sacar el webhook (volver a no recibir updates reales):

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"
```

#### 5. Vincular cuenta (Ajustes → código)

1. En la web: login `qa@atlas.test` / `Test1234!` (u otro user).
2. **Ajustes** → **Generar código de vinculación** (8 caracteres, 10 minutos).
3. En el chat del bot, enviá el código (texto plano) o `/start CODIGO`.
4. El bot debería responder: `Listo, {nombre}. Tu Telegram quedó vinculado a Atlas Fitness.`
5. En Ajustes, el estado pasa a “Telegram ya está vinculado”.

Handlers: `lib/telegram/README.md`. Copy es-AR.

#### 6. Probar un comando

Con la cuenta vinculada, en el chat del bot:

```text
/ayuda
/log press banca 80 10
/resumen
```

`/log` registra una serie en el workout activo (lo crea si no hay). Deberías ver la respuesta en Telegram y el set en el dashboard. `/entreno press banca 80 10` registra y cierra. `/fin` cierra el activo.

Si el bot no contesta: `getWebhookInfo`, que `npm run dev` y el túnel sigan vivos, y que el secret de `setWebhook` sea el mismo que en `.env` (y que hayas reiniciado Next).

### IA / tips (no cableada)

Comportamiento **actual** (Must):

- `GET /api/cron/daily-tip` (Bearer `CRON_SECRET`) llama `ensureTodayTip(hoy, null)`.
- No hay cliente Gemini, Groq ni otra API en `lib/ai/` (solo un README placeholder).
- El cron deja `aiContent = null` a propósito (`app/api/cron/daily-tip/route.ts`).
- `lib/services/tips.ts` toma un tip al azar del pool es-AR y persiste `source = 'system'`.
- La TipCard del dashboard y `/recordatorio` leen ese tip. Si el cron no corrió, `getOrCreateTodayTip` también cae al pool system.

Cablear un proveedor es **Won't de este PR**. En `.env.example` hay un stub **comentado** (`# GEMINI_API_KEY=`) para no olvidar el nombre el día que exista código. Hoy esa variable **no se lee**.

El curl de smoke del cron alcanza para ver un tip `source: "system"` sin red de IA.

### Volver al smoke (sin red)

En `.env`:

```bash
TURSO_DATABASE_URL=file:./local.db
TURSO_AUTH_TOKEN=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

Reiniciá `npm run dev`. Opcional: `deleteWebhook` si habías registrado uno. El curl de stub otra vez **no** pide header de secret.

---

## Tests

```bash
npm run lint
npm run typecheck
npm test                 # Jest (incluye loader de .env y setup:local)
npm run test:e2e         # Playwright — primero migrate + seed + build
```

Playwright levanta `npm start` con `CRON_SECRET` en `webServer.env` (default `test-secret-for-e2e` si no hay env). No hace falta Telegram real ni Turso cloud.

## Fuera de este doc

- Mini App Telegram (`initData`) — Should, no Must.
- Crons de producción en Vercel (`vercel.json`) — PR aparte.
- Sesión viva / notas como features nuevas — ya shipped; no se re-documentan acá.
- Secretos reales en el repo — prohibido.
- Implementar Gemini/Groq — Won't de este PR.
