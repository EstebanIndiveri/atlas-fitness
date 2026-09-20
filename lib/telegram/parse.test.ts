import { describe, it, expect } from '@jest/globals';
import { parseCallbackData, parseLogArgs, parseMessageText } from './parse';
import { CALLBACK_END_WORKOUT } from '@/types/telegram';

describe('parseMessageText', () => {
  it('parses /log with exercise, decimal weight string and reps', () => {
    const command = parseMessageText('/log press banca 80.5 10');
    expect(command).toEqual({
      type: 'log',
      raw: '/log press banca 80.5 10',
      endAfter: false,
    });
  });

  it('parses /entreno as a short workout (log + end)', () => {
    const command = parseMessageText('/entreno sentadilla 100 8');
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
  it('parses trailing weight and reps as decimal string + integer', () => {
    expect(parseLogArgs('/log press banca 80.5 10')).toEqual({
      exerciseQuery: 'press banca',
      weightKg: '80.5',
      reps: 10,
    });
  });

  it('parses 80x10 shorthand', () => {
    expect(parseLogArgs('/entreno sentadilla 100x8')).toEqual({
      exerciseQuery: 'sentadilla',
      weightKg: '100',
      reps: 8,
    });
  });

  it('returns null for missing args or invalid weight', () => {
    expect(parseLogArgs('/log')).toBeNull();
    expect(parseLogArgs('/log press banca')).toBeNull();
    expect(parseLogArgs('/log press banca 0 10')).toBeNull();
  });
});

describe('parseCallbackData', () => {
  it('maps workout:end to the end command', () => {
    expect(parseCallbackData(CALLBACK_END_WORKOUT)).toEqual({ type: 'end' });
  });
});
