import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('docs/engineering/local-dev.md (HU-D integraciones reales)', () => {
  const md = readFileSync(join(process.cwd(), 'docs/engineering/local-dev.md'), 'utf8');

  it('separates Smoke local from Integraciones reales', () => {
    expect(md).toMatch(/^## Smoke local/m);
    expect(md).toMatch(/^## Integraciones reales/m);

    const smokeAt = md.indexOf('## Smoke local');
    const realAt = md.indexOf('## Integraciones reales');
    expect(smokeAt).toBeGreaterThan(-1);
    expect(realAt).toBeGreaterThan(smokeAt);
  });

  it('documents Turso cloud: create DB, env, migrate/seed, then switch back to file', () => {
    expect(md).toMatch(/turso db create/i);
    expect(md).toMatch(/TURSO_DATABASE_URL/);
    expect(md).toMatch(/TURSO_AUTH_TOKEN/);
    expect(md).toMatch(/npm run db:migrate/);
    expect(md).toMatch(/npm run db:seed/);
    expect(md).toMatch(/file:\.\/local\.db/);
    expect(md).toMatch(/libsql:\/\//);
    expect(md).toMatch(/volver/i);
  });

  it('documents real Telegram: BotFather → token → secret → tunnel → setWebhook → link-code → comando', () => {
    expect(md).toMatch(/BotFather/);
    expect(md).toMatch(/TELEGRAM_BOT_TOKEN/);
    expect(md).toMatch(/TELEGRAM_WEBHOOK_SECRET/);
    expect(md).toMatch(/ngrok|cloudflared|túnel/i);
    expect(md).toMatch(/setWebhook/);
    expect(md).toMatch(/link-code|código de vinculación/i);
    expect(md).toMatch(/\/ayuda|\/log|\/start/);
  });

  it('documents system tip fallback and GEMINI_API_KEY stub without implementing AI', () => {
    expect(md).toMatch(/fallback/i);
    expect(md).toMatch(/source\s*=\s*'system'|source=system/i);
    expect(md).toMatch(/GEMINI_API_KEY/);
    expect(md).toMatch(/no implement|no está cableada|not wired|Won't de este PR/i);
  });

  it("lists Won't: Mini App, Vercel crons, secrets in repo, implementing AI", () => {
    expect(md).toMatch(/Mini App/);
    expect(md).toMatch(/Vercel/);
    expect(md).toMatch(/secretos reales|nunca commitees/i);
    expect(md).toMatch(/Gemini|IA/);
  });
});
