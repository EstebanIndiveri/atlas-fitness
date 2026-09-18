import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('docs/engineering/local-dev.md (HU-D integraciones reales)', () => {
  const md = readFileSync(join(process.cwd(), 'docs/engineering/local-dev.md'), 'utf8');

  function getSection(heading: string): string {
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = md.match(new RegExp(`^${escapedHeading}\\n([\\s\\S]*?)(?=^#{2,4} |\\Z)`, 'm'));
    expect(match?.[1]).toBeDefined();
    return match?.[1] ?? '';
  }

  it('separates Smoke local from Integraciones reales', () => {
    expect(md).toMatch(/^## Smoke local/m);
    expect(md).toMatch(/^## Integraciones reales/m);

    const smokeAt = md.indexOf('## Smoke local');
    const realAt = md.indexOf('## Integraciones reales');
    expect(smokeAt).toBeGreaterThan(-1);
    expect(realAt).toBeGreaterThan(smokeAt);
  });

  it('documents the exact remote development bootstrap sequence in its own section', () => {
    const section = getSection('#### Base remota de desarrollo');

    expect(section).toMatch(
      /```bash\s+CONFIRM_REMOTE_DB_BOOTSTRAP=1 npm run db:bootstrap:remote\s+npm run db:seed:qa\s+npm run db:verify\s+```/,
    );
    expect(section).toMatch(/file:\.\/local\.db/);
  });

  it('documents the exact public beta production bootstrap sequence without QA seed', () => {
    const section = getSection('#### Base pública beta / producción');

    expect(section).toMatch(
      /```bash\s+NODE_ENV=production CONFIRM_REMOTE_DB_BOOTSTRAP=1 npm run db:bootstrap:remote\s+npm run db:verify\s+```/,
    );
    expect(section).toMatch(/no uses la cuenta QA en producción/i);
    expect(section).not.toMatch(/npm run db:seed:qa/);
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

  it('documents system tip fallback and optional GEMINI_API_KEY with next-exercise fallback', () => {
    expect(md).toMatch(/fallback/i);
    expect(md).toMatch(/source\s*=\s*'system'|source=system/i);
    expect(md).toMatch(/GEMINI_API_KEY/);
    expect(md).toMatch(/next-exercise|siguiente ejercicio/i);
  });

  it("lists Won't: Mini App, Vercel crons, secrets in repo, implementing AI", () => {
    expect(md).toMatch(/Mini App/);
    expect(md).toMatch(/Vercel/);
    expect(md).toMatch(/secretos reales|nunca commitees/i);
    expect(md).toMatch(/Gemini|IA/);
  });
});
