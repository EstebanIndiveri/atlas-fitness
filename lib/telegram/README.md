# Telegram Bot

Handlers modulares del bot de Telegram. Misma fuente de verdad que la web (`lib/services/*`).

## Layout

```
app/api/telegram/webhook/route.ts   # thin: secret opcional + processTelegramUpdate
lib/telegram/
  process-update.ts                 # idempotencia primero, después dispatch
  idempotency.ts                    # INSERT bot_messages por telegram_update_id
  webhook-secret.ts                 # X-Telegram-Bot-Api-Secret-Token
  client.ts                         # sendMessage (no-op sin TELEGRAM_BOT_TOKEN)
  parse.ts                          # comandos / callbacks
  match-exercise.ts                 # match de catálogo
  copy.ts                           # copy es-AR
  notify-linked.ts                  # avisos a users con telegram_user_id
  handlers/                         # un archivo por comando
    start + link → handlers/link.ts
    help / unknown → handlers/help.ts
    log / entreno → handlers/log.ts
    resumen → handlers/summary.ts
    recordatorio → handlers/reminder.ts
    /fin + callback workout:end → handlers/end.ts
    index.ts                        # router fino (sin lógica de negocio)
```

## Idempotency rule

1. Extraer `update_id`.
2. `INSERT bot_messages.telegram_update_id` **antes** de cualquier side effect.
3. Si UNIQUE → `{ ok: true, duplicate: true }`, HTTP 200, **sin** segundo side effect.
4. Recién ahí se despacha al handler y se responde al chat.

Replays de Telegram (timeout/retry) no duplican link, series ni cierre de workout.

## Commands (es-AR)

| Entrada | Efecto |
|---------|--------|
| Código de 8 caracteres o `/start CODE` | Consume `telegram_link_codes`, setea `users.telegram_user_id` |
| `/log <ejercicio> <peso_kg> <reps>` | Serie en el workout activo (lo crea si no hay). Reusa workouts + workout-sets |
| `/entreno <ejercicio> <peso_kg> <reps>` | Entreno corto: serie + cierra el workout |
| `/fin` o botón «Finalizar entreno» | Cierra el workout activo |
| `/resumen` | Resumen de **hoy** (`America/Argentina/Cordoba`) |
| `/recordatorio` | Racha, tip del día y regla de aviso |
| `/ayuda` | Lista de comandos |

## Reminder rule

Igual que el cron `GET /api/cron/streak-nudge`:

- Día activo = workout con `ended_at` ese día Córdoba **o** `daily_checkins` de ese día.
- Si **ayer** fue activo y **hoy** todavía no, se inserta `streak_nudges` (`kind = streak_at_risk`, UNIQUE user+date+kind).
- Solo las filas **nuevas** se envían por Telegram, y solo si el usuario tiene `telegram_user_id`.
- El mismo día Córdoba no reenvía (idempotente). `/recordatorio` explica esta regla on-demand.

Outbound HTTP a `api.telegram.org` se saltea si no hay `TELEGRAM_BOT_TOKEN` (CI). En tests unitarios se inyecta `setTelegramSender`.

Bot real (BotFather + túnel + `setWebhook`): `docs/engineering/local-dev.md` → Integraciones reales. El default sigue siendo stub local sin red.
