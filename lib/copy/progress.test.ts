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

  it('names the unavailable state with period-scoped copy instead of today-scoped copy', () => {
    expect(PROGRESS_COPY.habitActivity.unavailable).toBe(
      'No pudimos cargar tu actividad de hábitos. Probá de nuevo en unos minutos.',
    );
    expect(PROGRESS_COPY.habitActivity.unavailable).not.toMatch(/de hoy/i);
  });

  it('labels a calendar day as recorded, unrecorded or not yet reached', () => {
    expect(PROGRESS_COPY.habitActivity.dayRecorded('2026-09-24')).toBe('2026-09-24: registrado');
    expect(PROGRESS_COPY.habitActivity.dayMissing('2026-09-25')).toBe('2026-09-25: sin registro');
    expect(PROGRESS_COPY.habitActivity.dayFuture('2026-09-26')).toBe('2026-09-26: todavía no llegó');
    expect(PROGRESS_COPY.habitActivity.legendMissing).toBe('Sin registro');
  });

  it('drops the copy of the removed habit consistency card', () => {
    expect(Object.keys(PROGRESS_COPY.habits)).toEqual(['todayOnly']);
  });

  it('names the wellbeing window so the card is not read as period-aggregated', () => {
    expect(PROGRESS_COPY.wellbeing.windowLabel).toBe(
      'Refleja solo tu check-in de hoy. No se acumula con el período elegido.',
    );
    expect(PROGRESS_COPY.wellbeing.windowLabel).toMatch(/hoy/i);
  });

  it('names the read-only activity record without calling it a history of goals', () => {
    expect(PROGRESS_COPY.habitActivity.historyTitle).toBe('Registro de actividad de hábitos');
    expect(PROGRESS_COPY.habitActivity.historyWeekdayLegend).toBe(
      'Cada marca es un día, de lunes a domingo, en hora de Córdoba.',
    );
    expect(PROGRESS_COPY.habitActivity.historyTitle).not.toMatch(/historial/i);
  });

  it('keeps the target-adherence vocabulary in its own namespace, apart from activity', () => {
    expect(PROGRESS_COPY.habitActivity).not.toHaveProperty('resultLabel');
    expect(PROGRESS_COPY.habitTarget).toHaveProperty('resultLabel');
    expect(PROGRESS_COPY.habitTarget.title).toBe('Días objetivo cumplidos');
  });

  it('always renders the N de M counts for a result, with the percentage as a separate label', () => {
    expect(PROGRESS_COPY.habitTarget.resultLabel(3, 5)).toBe('3 de 5 días objetivo');
    expect(PROGRESS_COPY.habitTarget.resultLabel(0, 4)).toBe('0 de 4 días objetivo');
    expect(PROGRESS_COPY.habitTarget.percentLabel(60)).toBe('60%');
    expect(PROGRESS_COPY.habitTarget.resultValueLabel).not.toBe(
      PROGRESS_COPY.habitTarget.percentValueLabel,
    );
  });

  it('names the not-configured and no-elapsed-objective-day states separately', () => {
    expect(PROGRESS_COPY.habitTarget.notConfiguredTitle).toBe('Sin días objetivo configurados');
    expect(PROGRESS_COPY.habitTarget.notConfiguredBody).toBe(
      'Configurá los días que querés proponerte; tu actividad anterior sigue visible.',
    );
    expect(PROGRESS_COPY.habitTarget.noExpectedBody).toBe(
      'Todavía no transcurrió un día objetivo en este período.',
    );
    expect(PROGRESS_COPY.habitTarget.notConfiguredBody).not.toBe(
      PROGRESS_COPY.habitTarget.noExpectedBody,
    );
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
