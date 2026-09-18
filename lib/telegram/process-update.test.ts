import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { db } from '@/lib/db/client';
import {
  sessions,
  botMessages,
  dailyCheckins,
  exercises,
  routineExercises,
  routines,
  streakNudges,
  telegramLinkCodes,
  users,
  userStreaks,
  workouts,
  workoutSets,
} from '@/lib/db/schema';
import { generateLinkCode, register } from '@/lib/services/auth';
import * as workoutSetsService from '@/lib/services/workout-sets';
import * as workoutsService from '@/lib/services/workouts';
import { setTelegramSender } from '@/lib/telegram/client';
import { TELEGRAM_COPY } from '@/lib/telegram/copy';
import { processTelegramUpdate } from '@/lib/telegram/process-update';
import { CALLBACK_END_WORKOUT, type TelegramUpdate } from '@/types/telegram';

interface SentMessage {
  chatId: number | string;
  text: string;
}

function messageUpdate(
  updateId: number,
  telegramUserId: number,
  text: string
): TelegramUpdate {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      text,
      from: {
        id: telegramUserId,
        is_bot: false,
        first_name: 'Tito',
      },
      chat: { id: telegramUserId, type: 'private' },
    },
  };
}

describe('processTelegramUpdate', () => {
  const sent: SentMessage[] = [];
  let atlasUserId: number;
  let updateSeq = 1;

  beforeEach(async () => {
    sent.length = 0;
    setTelegramSender(async (chatId, text) => {
      sent.push({ chatId, text });
    });

    await db.delete(botMessages);
    await db.delete(streakNudges);
    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(routineExercises);
    await db.delete(routines);
    await db.delete(exercises);
    await db.delete(telegramLinkCodes);
    await db.delete(userStreaks);
    await db.delete(sessions);
    await db.delete(users);

    const user = await register({
      name: 'Tito',
      email: `tg-${Date.now()}@test.com`,
      password: 'Test1234!',
    });
    atlasUserId = user.id;

    await db.insert(exercises).values({
      slug: 'bench-press',
      name: 'Press Banca',
      muscleGroup: 'Pecho',
      instructions: 'x',
      isSystem: true,
    });
  });

  afterEach(() => {
    setTelegramSender(null);
  });

  function nextId(): number {
    updateSeq += 1;
    return Date.now() + updateSeq;
  }

  it('consumes a link code and is idempotent on the same update_id', async () => {
    const { code } = await generateLinkCode(atlasUserId);
    const update = messageUpdate(nextId(), 9001, code);

    const first = await processTelegramUpdate(update);
    const second = await processTelegramUpdate(update);

    expect(first).toEqual({ ok: true, duplicate: false });
    expect(second).toEqual({ ok: true, duplicate: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('quedó vinculado');

    const rows = await db.select().from(botMessages);
    expect(rows).toHaveLength(1);
  });

  it('does not create a second set when /log is replayed with the same update_id', async () => {
    const { code } = await generateLinkCode(atlasUserId);
    await processTelegramUpdate(messageUpdate(nextId(), 9002, code));

    const logUpdate = messageUpdate(nextId(), 9002, '/log press banca 80.5 10');
    const first = await processTelegramUpdate(logUpdate);
    const second = await processTelegramUpdate(logUpdate);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);

    const active = await workoutsService.getActiveWorkout(atlasUserId);
    expect(active).not.toBeNull();
    const sets = await workoutSetsService.listWorkoutSets(active!.id, atlasUserId);
    expect(sets).toHaveLength(1);
    expect(sets[0].weightKg).toBe('80.5');
    expect(sets[0].reps).toBe(10);
    expect(sent.some((item) => item.text.includes('Press Banca'))).toBe(true);
  });

  it('returns the day summary for today Córdoba after a short workout', async () => {
    const { code } = await generateLinkCode(atlasUserId);
    await processTelegramUpdate(messageUpdate(nextId(), 9003, code));
    await processTelegramUpdate(messageUpdate(nextId(), 9003, '/entreno press banca 100 5'));

    sent.length = 0;
    await processTelegramUpdate(messageUpdate(nextId(), 9003, '/resumen'));

    expect(sent[0].text).toContain('Resumen de hoy');
    expect(sent[0].text).toContain('Press Banca');
    expect(sent[0].text).toContain('100');
  });

  it('explains the streak-nudge reminder rule', async () => {
    const { code } = await generateLinkCode(atlasUserId);
    await processTelegramUpdate(messageUpdate(nextId(), 9004, code));

    sent.length = 0;
    await processTelegramUpdate(messageUpdate(nextId(), 9004, '/recordatorio'));

    expect(sent[0].text).toContain('active_yesterday_not_today');
    expect(sent[0].text).toContain('America/Argentina/Cordoba');
  });

  it('asks unlinked users to send a code before /log', async () => {
    await processTelegramUpdate(messageUpdate(nextId(), 9005, '/log press banca 80 10'));
    expect(sent[0].text).toBe(TELEGRAM_COPY.unlinked);
  });

  it('ends an open workout from the inline callback without a second side effect', async () => {
    const { code } = await generateLinkCode(atlasUserId);
    await processTelegramUpdate(messageUpdate(nextId(), 9006, code));
    await processTelegramUpdate(messageUpdate(nextId(), 9006, '/log press banca 80 10'));

    const callbackId = nextId();
    const callback: TelegramUpdate = {
      update_id: callbackId,
      callback_query: {
        id: 'cb-1',
        from: { id: 9006, is_bot: false, first_name: 'Tito' },
        data: CALLBACK_END_WORKOUT,
        message: {
          message_id: 1,
          date: 1,
          chat: { id: 9006, type: 'private' },
        },
      },
    };

    const first = await processTelegramUpdate(callback);
    const second = await processTelegramUpdate(callback);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);

    const active = await workoutsService.getActiveWorkout(atlasUserId);
    expect(active).toBeNull();
  });
});
