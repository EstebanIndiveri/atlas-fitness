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

const EXTERNAL_TAIL = 'mode=external basis=total side=bilateral purpose=working';

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

  it('writes a v1 set and is idempotent when /log is replayed with the same update_id', async () => {
    const { code } = await generateLinkCode(atlasUserId);
    await processTelegramUpdate(messageUpdate(nextId(), 9002, code));

    const logUpdate = messageUpdate(nextId(), 9002, `/log press banca 80.5 10 ${EXTERNAL_TAIL}`);
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
    expect(sets[0].semanticCaptureVersion).toBe(1);
    expect(sets[0].loadMode).toBe('external');
    expect(sets[0].side).toBe('bilateral');
    expect(sets[0].setPurpose).toBe('working');
    expect(sent.some((item) => item.text.includes('Press Banca'))).toBe(true);
  });

  it('does not write a set for the legacy three-argument syntax and replies with usage', async () => {
    const { code } = await generateLinkCode(atlasUserId);
    await processTelegramUpdate(messageUpdate(nextId(), 9010, code));

    sent.length = 0;
    await processTelegramUpdate(messageUpdate(nextId(), 9010, '/log press banca 80 10'));

    expect(sent[0].text).toBe(TELEGRAM_COPY.logUsage);
    const active = await workoutsService.getActiveWorkout(atlasUserId);
    expect(active).toBeNull();
  });

  it('records a bodyweight set with the zero sentinel and mode-aware wording', async () => {
    const { code } = await generateLinkCode(atlasUserId);
    await processTelegramUpdate(messageUpdate(nextId(), 9011, code));

    await processTelegramUpdate(
      messageUpdate(nextId(), 9011, '/log press banca 0 12 mode=bodyweight side=bilateral purpose=working'),
    );

    const active = await workoutsService.getActiveWorkout(atlasUserId);
    const sets = await workoutSetsService.listWorkoutSets(active!.id, atlasUserId);
    expect(sets[0].weightKg).toBe('0');
    expect(sets[0].loadMode).toBe('bodyweight');
    expect(sets[0].amountBasis).toBeNull();
    expect(sent.some((item) => item.text.includes('peso corporal'))).toBe(true);
  });

  it('records an assisted set with assistance wording, never "kg lifted"', async () => {
    const { code } = await generateLinkCode(atlasUserId);
    await processTelegramUpdate(messageUpdate(nextId(), 9012, code));

    await processTelegramUpdate(
      messageUpdate(
        nextId(),
        9012,
        '/log press banca 20 8 mode=assisted basis=total side=bilateral purpose=working',
      ),
    );

    expect(sent.some((item) => item.text.includes('asistencia 20 kg'))).toBe(true);
  });

  it('returns the day summary for today Córdoba after a short workout', async () => {
    const { code } = await generateLinkCode(atlasUserId);
    await processTelegramUpdate(messageUpdate(nextId(), 9003, code));
    await processTelegramUpdate(
      messageUpdate(nextId(), 9003, `/entreno press banca 100 5 ${EXTERNAL_TAIL}`),
    );

    sent.length = 0;
    await processTelegramUpdate(messageUpdate(nextId(), 9003, '/resumen'));

    expect(sent[0].text).toContain('Resumen de hoy');
    expect(sent[0].text).toContain('Press Banca');
    expect(sent[0].text).toContain('100');
  });

  it('summarizes mixed load modes honestly and never claims generic kg lifted', async () => {
    const { code } = await generateLinkCode(atlasUserId);
    await processTelegramUpdate(messageUpdate(nextId(), 9013, code));

    await processTelegramUpdate(
      messageUpdate(nextId(), 9013, '/log press banca 0 10 mode=bodyweight side=bilateral purpose=working'),
    );
    await processTelegramUpdate(
      messageUpdate(
        nextId(),
        9013,
        '/log press banca 20 8 mode=assisted basis=total side=bilateral purpose=working',
      ),
    );

    // A raw legacy row (all-null semantics) belongs to the same open workout.
    const active = await workoutsService.getActiveWorkout(atlasUserId);
    const existingSets = await workoutSetsService.listWorkoutSets(active!.id, atlasUserId);
    await db.insert(workoutSets).values({
      workoutId: active!.id,
      exerciseId: existingSets[0].exerciseId,
      setIndex: existingSets.length + 1,
      reps: 5,
      weightKg: '55',
      completed: true,
    });

    sent.length = 0;
    await processTelegramUpdate(messageUpdate(nextId(), 9013, '/resumen'));

    const text = sent[0].text;
    expect(text).toContain('peso corporal');
    expect(text).toContain('asistencia 20 kg');
    expect(text).toContain('carga registrada (sin contexto)');
    expect(text).not.toMatch(/kg levantados/);
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
    await processTelegramUpdate(messageUpdate(nextId(), 9006, `/log press banca 80 10 ${EXTERNAL_TAIL}`));

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
