# Gemini Flash Migration Design

## Goal

Restore live AI suggestions in guided workout sessions by replacing the retired
`gemini-2.0-flash` model with `gemini-3.5-flash-lite`.

## Scope

- Keep the existing server-side `generateContent` integration.
- Keep `GEMINI_API_KEY`, typed JSON parsing, and the
  deterministic routine-order fallback unchanged.
- Do not add a configurable model environment variable or migrate to the
  Interactions API in this change.

## Implementation

Update the model constant in `lib/ai/gemini.ts`. Live probes selected
`gemini-3.5-flash-lite` because it responded successfully within the existing
four-second timeout while the other current Flash variants were unavailable or
timed out. Add a regression test that captures the requested URL and verifies
the adapter calls the `gemini-3.5-flash-lite:generateContent` endpoint.

## Verification

1. Observe the new regression test fail against the retired model.
2. Update the model constant and run the focused Gemini and guided-session tests.
3. Run typecheck and lint.
4. Call `fetchGeminiNextExercise` with the configured development key and verify
   it returns a valid typed suggestion rather than `null`.

## Failure Behavior

Missing keys, timeouts, provider errors, and malformed responses continue to
return `null`, allowing the existing deterministic fallback to keep workouts
operational.
