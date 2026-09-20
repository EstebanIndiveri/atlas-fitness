import { describe, expect, it, jest } from '@jest/globals';
import {
  parseGeminiVideoPayload,
  suggestGeminiExerciseVideo,
} from './gemini-exercise-video';

describe('parseGeminiVideoPayload', () => {
  it('extracts a youtube url from fenced or raw JSON', () => {
    expect(parseGeminiVideoPayload('```json\n{"youtubeUrl":"https://youtu.be/abc"}\n```')).toBe(
      'https://youtu.be/abc',
    );
    expect(parseGeminiVideoPayload('{"youtubeUrl": null}')).toBeNull();
    expect(parseGeminiVideoPayload('not json')).toBeNull();
  });
});

describe('suggestGeminiExerciseVideo', () => {
  it('returns null without an API key and never calls the network', async () => {
    const fetchImpl = jest.fn();
    const result = await suggestGeminiExerciseVideo(
      { name: 'Sentadilla' },
      { env: {}, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns the suggested url from a successful Gemini response', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: '{"youtubeUrl":"https://www.youtube.com/watch?v=abc"}' }] } },
        ],
      }),
    }));
    const result = await suggestGeminiExerciseVideo(
      { name: 'Sentadilla', muscleGroup: 'Piernas' },
      { env: { GEMINI_API_KEY: 'k' }, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result).toBe('https://www.youtube.com/watch?v=abc');
  });

  it('returns null on HTTP error', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false, json: async () => ({}) }));
    const result = await suggestGeminiExerciseVideo(
      { name: 'Sentadilla' },
      { env: { GEMINI_API_KEY: 'k' }, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result).toBeNull();
  });
});
