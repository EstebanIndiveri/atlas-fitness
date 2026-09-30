import { describe, it, expect } from '@jest/globals';
import { parseCallbackData, parseLogArgs, parseMessageText } from './parse';
import { CALLBACK_END_WORKOUT } from '@/types/telegram';

describe('parseMessageText', () => {
  it('parses /log with exercise, decimal weight string and reps', () => {
    const command = parseMessageText('/log press banca 80.5 10 mode=external basis=total side=bilateral purpose=working');
    expect(command).toEqual({
      type: 'log',
      raw: '/log press banca 80.5 10 mode=external basis=total side=bilateral purpose=working',
      endAfter: false,
    });
  });

  it('parses /entreno as a short workout (log + end)', () => {
    const command = parseMessageText('/entreno sentadilla 100 8 mode=external basis=total side=bilateral purpose=working');
    expect(command.type).toBe('log');
    if (command.type === 'log') {
      expect(command.endAfter).toBe(true);
    }
  });

  it('strips bot mention from commands', () => {
    const command = parseMessageText('/resumen@AtlasBot');
    expect(command).toEqual({ type: 'summary' });
  });

  it('parses /start with a link code payload', () => {
    const command = parseMessageText('/start ABCD2345');
    expect(command).toEqual({ type: 'start', payload: 'ABCD2345' });
  });

  it('treats a bare 8-char link code as link_code', () => {
    const command = parseMessageText('ab2d3f4h');
    expect(command).toEqual({ type: 'link_code', code: 'AB2D3F4H' });
  });

  it('parses reminder, help, end and unknown', () => {
    expect(parseMessageText('/recordatorio')).toEqual({ type: 'reminder' });
    expect(parseMessageText('/ayuda')).toEqual({ type: 'help' });
    expect(parseMessageText('/fin')).toEqual({ type: 'end' });
    expect(parseMessageText('hola')).toEqual({ type: 'unknown', raw: 'hola' });
  });
});

describe('parseLogArgs', () => {
  it('parses a complete v1 external command', () => {
    expect(
      parseLogArgs('/log press banca 80.5 10 mode=external basis=total side=bilateral purpose=working'),
    ).toEqual({
      exerciseQuery: 'press banca',
      weightKg: '80.5',
      reps: 10,
      semantics: {
        loadMode: 'external',
        amountBasis: 'total',
        side: 'bilateral',
        setPurpose: 'working',
        repCountBasis: null,
      },
    });
  });

  it('parses the 80x10 shorthand with semantics appended', () => {
    expect(
      parseLogArgs('/entreno sentadilla 100x8 mode=external basis=total side=bilateral purpose=working'),
    ).toEqual({
      exerciseQuery: 'sentadilla',
      weightKg: '100',
      reps: 8,
      semantics: {
        loadMode: 'external',
        amountBasis: 'total',
        side: 'bilateral',
        setPurpose: 'working',
        repCountBasis: null,
      },
    });
  });

  it('parses bodyweight with the zero sentinel and no basis', () => {
    expect(
      parseLogArgs('/log dominadas 0 8 mode=bodyweight side=bilateral purpose=working'),
    ).toEqual({
      exerciseQuery: 'dominadas',
      weightKg: '0',
      reps: 8,
      semantics: {
        loadMode: 'bodyweight',
        amountBasis: null,
        side: 'bilateral',
        setPurpose: 'working',
        repCountBasis: null,
      },
    });
  });

  it('parses alternating with an explicit rep basis', () => {
    expect(
      parseLogArgs('/log zancadas 40 10 mode=external basis=total side=alternating purpose=working repbasis=per_side'),
    ).toMatchObject({
      semantics: { side: 'alternating', repCountBasis: 'per_side' },
    });
  });

  it('is case-insensitive for keys and values', () => {
    expect(
      parseLogArgs('/log press banca 80 10 MODE=External Basis=Total Side=Bilateral Purpose=Working'),
    ).toMatchObject({
      semantics: { loadMode: 'external', amountBasis: 'total', side: 'bilateral', setPurpose: 'working' },
    });
  });

  it('returns null for the legacy three-argument syntax (no write)', () => {
    expect(parseLogArgs('/log press banca 80.5 10')).toBeNull();
    expect(parseLogArgs('/entreno sentadilla 100x8')).toBeNull();
  });

  it('returns null when required semantic tokens are missing', () => {
    expect(parseLogArgs('/log press banca 80 10 mode=external')).toBeNull();
    expect(parseLogArgs('/log press banca 80 10 mode=external side=bilateral')).toBeNull();
  });

  it('returns null for missing positional args', () => {
    expect(parseLogArgs('/log')).toBeNull();
    expect(parseLogArgs('/log press banca mode=external side=bilateral purpose=working')).toBeNull();
  });
});

describe('parseCallbackData', () => {
  it('maps workout:end to the end command', () => {
    expect(parseCallbackData(CALLBACK_END_WORKOUT)).toEqual({ type: 'end' });
  });
});
