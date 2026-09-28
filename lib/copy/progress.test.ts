import { describe, expect, it } from '@jest/globals';

import { PROGRESS_COPY } from './progress';

const FORBIDDEN_VOCABULARY =
  /adherencia|cumplimiento|meta|objetivo|porcentaje|%|racha|logro|nivel|puntos|puntaje|score|fallad[oa]|incumplid[oa]|perdid[oa]|omitid[oa]/i;

function collectStrings(value: unknown, collected: string[] = []): string[] {
  if (typeof value === 'string') {
    collected.push(value);
    return collected;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, collected));
    return collected;
  }
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach((entry) => collectStrings(entry, collected));
  }
  return collected;
}

describe('PROGRESS_COPY habit activity', () => {
  it('rewrites the today-only sentence so it stops promising a hidden historical percentage', () => {
    expect(PROGRESS_COPY.habits.todayOnly).toBeInstanceOf(Function);
    expect(PROGRESS_COPY.habits.todayOnly(2, 4)).toBe(
      'Hoy registraste 2 de 4 hábitos. Abajo está el detalle día por día del período elegido.',
    );
  });

  it('describes recorded days without a goal, target or consistency claim', () => {
    expect(PROGRESS_COPY.habitActivity.title).toBe('Actividad de hábitos registrada');
    expect(PROGRESS_COPY.habitActivity.activeDaysLabel).toBe('Días con hábitos registrados');
    expect(PROGRESS_COPY.habitActivity.elapsedDaysLabel).toBe('Días transcurridos del período');
    expect(PROGRESS_COPY.habitActivity.summary(5, 9)).toBe(
      'Registraste hábitos en 5 de los 9 días transcurridos.',
    );
    expect(PROGRESS_COPY.habitActivity.recordedDaysLabel('Hidratación', 3, 9)).toBe(
      'Hidratación: 3 de 9 días con registro',
    );
    expect(PROGRESS_COPY.habitActivity.title).not.toMatch(/consistencia/i);
  });

  it('names the missing-history threshold and the missing-activity reason separately', () => {
    expect(PROGRESS_COPY.habitActivity.insufficientElapsed(2, 7)).toBe(
      'Pasaron 2 de los 7 días que Atlas necesita para resumir este período.',
    );
    expect(PROGRESS_COPY.habitActivity.insufficientNoActivity).toBe(
      'Todavía no registraste ningún hábito en este período.',
    );
    expect(PROGRESS_COPY.habitActivity.insufficientElapsed(2, 7)).not.toBe(
      PROGRESS_COPY.habitActivity.insufficientNoActivity,
    );
  });

  it('labels a calendar day as recorded, unrecorded or not yet reached', () => {
    expect(PROGRESS_COPY.habitActivity.dayRecorded('2026-09-24')).toBe('2026-09-24: registrado');
    expect(PROGRESS_COPY.habitActivity.dayMissing('2026-09-25')).toBe('2026-09-25: sin registro');
    expect(PROGRESS_COPY.habitActivity.dayFuture('2026-09-26')).toBe('2026-09-26: todavía no llegó');
    expect(PROGRESS_COPY.habitActivity.legendMissing).toBe('Sin registro');
  });

  it('uses activity vocabulary and no forbidden §13 token in any habit-activity string', () => {
    const strings = [
      ...collectStrings(PROGRESS_COPY.habitActivity),
      ...collectStrings(PROGRESS_COPY.habits),
      PROGRESS_COPY.habitActivity.summary(5, 9),
      PROGRESS_COPY.habitActivity.recordedDaysLabel('Hidratación', 3, 9),
      PROGRESS_COPY.habitActivity.insufficientElapsed(2, 7),
      PROGRESS_COPY.habitActivity.dayRecorded('2026-09-24'),
      PROGRESS_COPY.habitActivity.dayMissing('2026-09-25'),
      PROGRESS_COPY.habitActivity.dayFuture('2026-09-26'),
      PROGRESS_COPY.habitActivity.windowLabel('24 de septiembre', '30 de septiembre'),
      PROGRESS_COPY.habitActivity.todayIsLabel('30 de septiembre'),
      PROGRESS_COPY.habitActivity.dayStripAria('Hidratación'),
      PROGRESS_COPY.habits.todayOnly(2, 4),
    ];

    expect(strings.length).toBeGreaterThan(20);
    for (const entry of strings) {
      expect(entry).not.toMatch(FORBIDDEN_VOCABULARY);
    }
  });
});
