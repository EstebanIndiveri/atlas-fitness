import { describe, expect, it } from '@jest/globals';

import { buildDayReason } from '@/lib/services/day-reason';

describe('buildDayReason', () => {
  it('uses high energy and yesterday rest when both real signals are present', () => {
    const reason = buildDayReason({
      energy: 'high',
      mood: 5,
      restedYesterday: true,
      goal: 'Hipertrofia',
    });

    expect(reason).toBe('Marcaste energía alta y ayer descansaste: buen día para la sesión prevista sin recortes.');
    expect(reason.length).toBeLessThanOrEqual(180);
  });

  it('uses low energy without claiming rest or goal signals', () => {
    const reason = buildDayReason({
      energy: 'low',
      mood: 2,
      restedYesterday: false,
      goal: 'Fuerza',
    });

    expect(reason).toBe('Registraste energía baja: si querés, adaptá con Coach Atlas para bajar volumen.');
    expect(reason).not.toContain('Fuerza');
    expect(reason).not.toContain('descansaste');
    expect(reason.length).toBeLessThanOrEqual(180);
  });

  it('uses medium energy with the plan goal as neutral context', () => {
    const reason = buildDayReason({
      energy: 'medium',
      mood: 3,
      restedYesterday: false,
      goal: 'Hipertrofia',
    });

    expect(reason).toBe('Sesión de Hipertrofia prevista para hoy. Ajustá con Coach Atlas si tu día cambió.');
    expect(reason.length).toBeLessThanOrEqual(180);
  });

  it('asks for check-in when there is no check-in signal', () => {
    const reason = buildDayReason({
      energy: null,
      mood: null,
      restedYesterday: true,
      goal: 'Fuerza',
    });

    expect(reason).toBe('Registrá tu check-in para que Atlas ajuste la sesión de hoy.');
    expect(reason).not.toContain('Fuerza');
    expect(reason).not.toContain('descansaste');
    expect(reason.length).toBeLessThanOrEqual(180);
  });
});
