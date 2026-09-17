# AI Integration

Hoy **no hay** cliente Gemini, Groq ni otra API de IA cableada. `lib/ai/` es un placeholder.

El cron `GET /api/cron/daily-tip` pasa `aiContent = null`. `ensureTodayTip` en `lib/services/tips.ts` guarda un tip del pool es-AR con `source = 'system'`. Eso es el Must (fallback obligatorio, ADR-001).

Cablear un proveedor es **Won't** del PR de docs de integraciones reales. Stub comentado: `# GEMINI_API_KEY=` en `.env.example` (la variable no se lee). Guía: `docs/engineering/local-dev.md` (sección IA / tips).
