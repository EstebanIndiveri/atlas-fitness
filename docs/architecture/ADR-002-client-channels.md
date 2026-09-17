# ADR-002 — Canales cliente (PWA → Expo)

**Estado:** Aprobado (Squad Scrum, 2026-09-16)  
**Nombre producto:** Atlas Fitness (locked)

## Decisión

| Fase | Cliente |
|------|---------|
| **MVP** | Next.js **PWA** instalable + bot Telegram. App Store **no** Must. Offline gym **no** Must. HealthKit/Watch **no**. |
| **v1.5 / post-PMF** | Expo React Native consumiendo los **mismos** `/api/*`. Sin BFF. Web/PWA sigue. |
| **Rechazado MVP** | Swift-only (sin Android, no reusa skills, overkill sin wearables Must). |

## Trade-offs

- PWA acelera log/historial/tips/IA+Telegram con un equipo JS.
- iOS Web Push solo si la PWA está en Home Screen (copy claro en settings).
- Offline real = fase aparte (`client_mutation_id` + cola idempotente).
- Geofence / GPS = Won't MVP (privacidad + límites PWA).

## Impacto

- Contratos BE: sin cambio por canal.
- UX outline FE: mobile-first; sin cambio de pantallas Must.
- QA: Playwright Must (web/PWA); Detox/Maestro solo con Expo.
