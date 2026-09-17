import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { dailyTips } from '@/lib/db/schema';
import { AppError } from '@/types/errors';
import type { DailyTip } from '@/lib/db/schema';

/**
 * System fallback tips pool (es-AR)
 */
const SYSTEM_TIPS = [
  'La constancia es la clave. Cada entrenamiento cuenta, no importa cuán pequeño sea.',
  'Recordá: el dolor que sentís hoy será la fuerza que sentirás mañana.',
  'No se trata de ser el mejor, se trata de ser mejor que ayer.',
  'Tu cuerpo puede aguantar casi cualquier cosa. Es tu mente la que tenés que convencer.',
  'El éxito es la suma de pequeños esfuerzos repetidos día tras día.',
  'No cuentes los días, hacé que los días cuenten.',
  'La única forma de fallar es dejar de intentarlo.',
  'Cada repetición te acerca más a tu objetivo. No te rindas.',
  'El progreso puede ser lento, pero renunciar no lo acelera.',
  'Entrená por salud, no solo por estética. Tu cuerpo es tu hogar para toda la vida.',
];

/**
 * Selects a random system tip from the pool
 */
function getRandomSystemTip(): string {
  const index = Math.floor(Math.random() * SYSTEM_TIPS.length);
  return SYSTEM_TIPS[index];
}

/**
 * Creates a new daily tip
 */
export async function createTip(
  date: string,
  body: string,
  source: 'system' | 'ai'
): Promise<DailyTip> {
  try {
    const [tip] = await db
      .insert(dailyTips)
      .values({
        date,
        body,
        source,
      })
      .returning();

    return tip;
  } catch (error) {
    // Handle unique constraint violation
    if (error instanceof Error) {
      const message = error.message;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const causeMessage = (error as any).cause?.message || '';

      // Check for UNIQUE constraint failure on date
      if (
        message.includes('UNIQUE') ||
        message.includes('unique') ||
        causeMessage.includes('UNIQUE') ||
        causeMessage.includes('unique')
      ) {
        throw new AppError('CONFLICT', 'Ya existe un tip para esta fecha');
      }
    }
    throw error;
  }
}

/**
 * Gets the tip for a specific date (YYYY-MM-DD)
 */
export async function getTodayTip(date: string): Promise<DailyTip | null> {
  const tip = await db.query.dailyTips.findFirst({
    where: eq(dailyTips.date, date),
  });

  return tip || null;
}

/**
 * Ensures a tip exists for today. Creates one if missing.
 * If aiContent is provided and non-empty, uses it. Otherwise falls back to system tip.
 * Idempotent: returns existing tip if already created.
 */
export async function ensureTodayTip(
  date: string,
  aiContent: string | null
): Promise<DailyTip> {
  const existing = await getTodayTip(date);
  if (existing) {
    return existing;
  }

  const body = aiContent && aiContent.trim().length > 0 ? aiContent : getRandomSystemTip();
  const source = aiContent && aiContent.trim().length > 0 ? 'ai' : 'system';

  return createTip(date, body, source);
}

/**
 * Gets today's tip or creates one with fallback
 */
export async function getOrCreateTodayTip(date: string): Promise<DailyTip> {
  return ensureTodayTip(date, null);
}
