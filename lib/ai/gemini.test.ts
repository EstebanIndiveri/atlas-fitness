/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  fetchGeminiNextExercise,
  parseGeminiNextExercisePayload,
  readGeminiApiKey,
} from './gemini';

describe('readGeminiApiKey', () => {
  it('treats empty or whitespace as missing', () => {
    expect(readGeminiApiKey({ GEMINI_API_KEY: '' })).toBeNull();
    expect(readGeminiApiKey({ GEMINI_API_KEY: '   ' })).toBeNull();
    expect(readGeminiApiKey({})).toBeNull();
    expect(readGeminiApiKey({ GEMINI_API_KEY: 'abc' })).toBe('abc');
  });
});

describe('parseGeminiNextExercisePayload', () => {
  it('parses a JSON object and ignores fences', () => {
    const parsed = parseGeminiNextExercisePayload(
      '```json\n{"nextExerciseId": 12, "isLast": false, "message": "Ahora sentadilla."}\n```',
    );
    expect(parsed).toEqual({
      nextExerciseId: 12,
      isLast: false,
      message: 'Ahora sentadilla.',
    });
  });

  it('returns null for invalid payloads', () => {
    expect(parseGeminiNextExercisePayload('not json')).toBeNull();
    expect(parseGeminiNextExercisePayload('{"nextExerciseId":"x"}')).toBeNull();
  });
});

describe('fetchGeminiNextExercise', () => {
  const input = {
    completedExerciseName: 'Press Banca',
    remaining: [{ id: 2, name: 'Sentadilla' }],
  };

  it('returns null without calling fetch when the key is missing', async () => {
    let called = false;
    const result = await fetchGeminiNextExercise(input, {
      env: { GEMINI_API_KEY: '' },
      fetchImpl: async () => {
        called = true;
        return new Response('nope', { status: 500 });
      },
    });
    expect(result).toBeNull();
    expect(called).toBe(false);
  });

  it('returns null on HTTP failure so the service can fall back', async () => {
    const result = await fetchGeminiNextExercise(input, {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl: async () => new Response('error', { status: 503 }),
    });
    expect(result).toBeNull();
  });

  it('calls Gemini 3.5 Flash Lite and parses a successful response', async () => {
    let requestedUrl = '';
    const result = await fetchGeminiNextExercise(input, {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: '{"nextExerciseId":2,"isLast":true,"message":"Cerrá con sentadilla."}',
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });
    expect(requestedUrl).toContain(
      '/models/gemini-3.5-flash-lite:generateContent?key=test-key',
    );
    expect(result).toEqual({
      nextExerciseId: 2,
      isLast: true,
      message: 'Cerrá con sentadilla.',
    });
  });
});
