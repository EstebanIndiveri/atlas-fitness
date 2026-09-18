# Gemini 3.6 Flash Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore live Gemini suggestions in guided workouts by replacing the retired model with `gemini-3.6-flash`.

**Architecture:** Keep the existing server-side `generateContent` adapter and its typed JSON contract. Change only the model identifier, preserve every fallback path, and verify both the adapter URL and a real provider response.

**Tech Stack:** TypeScript 6, Jest 30, Gemini Generative Language API, Next.js 16 server-side services.

---

## File structure

| File | Responsibility |
|---|---|
| `lib/ai/gemini.test.ts` | Lock the production adapter to the supported Gemini model endpoint |
| `lib/ai/gemini.ts` | Define the model and perform the existing `generateContent` request |

### Task 1: Migrate the Gemini model with TDD

**Files:**
- Modify: `lib/ai/gemini.test.ts:65-91`
- Modify: `lib/ai/gemini.ts:3-4`

- [ ] **Step 1: Make the successful adapter test capture the requested URL**

Update the existing `parses a successful generateContent response` test:

```ts
it('calls Gemini 3.6 Flash and parses a successful response', async () => {
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
    '/models/gemini-3.6-flash:generateContent?key=test-key',
  );
  expect(result).toEqual({
    nextExerciseId: 2,
    isLast: true,
    message: 'Cerrá con sentadilla.',
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- lib/ai/gemini.test.ts
```

Expected: FAIL because the requested URL still contains
`gemini-2.0-flash:generateContent`.

- [ ] **Step 3: Update the model identifier**

Change `lib/ai/gemini.ts`:

```ts
export const GEMINI_MODEL = 'gemini-3.6-flash';
```

Keep `GEMINI_GENERATE_URL`, the request body, timeout, parsing, and fallback
behavior unchanged.

- [ ] **Step 4: Run focused regression tests**

Run:

```bash
npm test -- lib/ai/gemini.test.ts lib/services/guided-session.test.ts lib/session/resolve-next.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run static checks**

Run:

```bash
npm run typecheck
npx eslint lib/ai/gemini.ts lib/ai/gemini.test.ts
```

Expected: both commands exit 0.

- [ ] **Step 6: Verify the real application adapter**

With the configured development `.env`, run:

```bash
./node_modules/.bin/tsx -e "import { loadLocalEnv } from './lib/dev/load-local-env'; import { fetchGeminiNextExercise } from './lib/ai/gemini'; (async () => { loadLocalEnv(); const result = await fetchGeminiNextExercise({ completedExerciseName: 'Press Banca', remaining: [{ id: 2, name: 'Sentadilla' }, { id: 3, name: 'Peso Muerto' }] }); console.log(JSON.stringify({ responded: result !== null, result }, null, 2)); })();"
```

Expected: `responded` is `true` and `result.nextExerciseId` is either `2` or
`3`.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/gemini.ts lib/ai/gemini.test.ts
git commit -m "fix: migrate guided sessions to Gemini 3.6 Flash"
```

