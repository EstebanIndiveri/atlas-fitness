# Weekly Plan Strategy Composer — Phase 7

**Status:** Approved to proceed autonomously from the supplied Phase 7 brief  
**Scope:** Atlas Fitness v0.8.0 Workstream E, weekly plan generation only

## Goal

Make Plan Coach generate a coherent weekly plan rather than independently generated routines presented as a week. A proposal must contain exactly the requested number of unique training weekdays, a goal- and focus-aware distribution, explicit rest/recovery between training sessions where the schedule permits, and a complete routine for each training day.

## Boundaries

- Keep the existing generation endpoint and response contract. Generation remains a preview: it does not create or persist training plans, routines, or scheduled assignments.
- Keep Coach Context semantics: goal, frequency, experience, session length, equipment, and focus areas are explicit brief inputs. Do not infer or synchronize preferences, alter saved context, or mutate an active plan.
- Add a Phase 7 composer for guided Plan Coach generation. Keep the existing generator used by plan improvement unchanged so Workstream G behavior is not modified.
- For every training day, call the shared Routine Engine V2 `buildRoutineDraft`. Do not reimplement its eligibility filtering, Gemini request/normalization, validation, fallback, or exercise selection.
- The weekly strategy layer owns day placement, per-day focus, recovery, and whole-week coherence. It validates complete Routine Engine outputs against weekly constraints and visible catalog IDs.
- Do not touch Manual Plan/Routine UI, E2E test files, lifecycle/routine-scope behavior from A/D, or Routine Engine V2 semantics.

## Design

1. **Weekly strategy:** Generate a structured strategy from the brief using Gemini when available. Require exact requested training-day count, unique weekdays, day-specific focus, and a weekly recovery distribution. If strategy generation fails or is incoherent, select a deterministic strategy based on the goal and requested focus; distribute training days algorithmically rather than hardcoding one split.
2. **Routine composition:** For each strategy training day, invoke `buildRoutineDraft` with that day's focus plus the user's goal, level, duration, available equipment, location derived from the brief, and authenticated visible catalog. Preserve each routine engine result and its resolved catalog metadata.
3. **Whole-week validation:** Reject incomplete or incoherent proposals: wrong training-day count, duplicate weekdays, missing rest/recovery, insufficient goal/focus coverage, unrelated muscle groups without a justified broad focus, repeated exercise work that is unreasonable across the week, excessive overall volume, or IDs absent from the visible catalog. On weekly validation failure, compose again with the deterministic weekly strategy; never return a partial proposal. If the shared routine engine cannot produce a valid day, return its explicit domain validation error rather than fabricating a routine.
4. **Provenance:** Keep the existing top-level `gemini`/`fallback` source shape and make attribution conservative: label the composed result as Gemini-assisted only when a Gemini-produced strategy or day routine contributed; otherwise label it fallback. Keep stored Coach Context separate from generated-proposal provenance.

## Errors and persistence

Input validation, authentication, catalog visibility, and rate limiting continue to follow the current endpoint contracts. Routine Engine validation errors remain visible through the existing API error handler; Gemini outages remain recoverable through the shared engine's fallback. The composer does not call plan/routine/assignment persistence services. Rate-limit accounting is existing endpoint behavior and is not plan persistence.

## Tests and acceptance

- Add strongly typed tests before implementation and observe the intended regression in red.
- Cover strategy and composition happy paths, invalid/edge briefs and schedules, exact training-day counts, unique days, rest/recovery, deterministic repeatability, and failures without partial output.
- Add the mandatory regression: goal `hipertrofia de piernas`, two days, `focusAreas: ['Piernas']` must not yield an upper-body day or unrelated muscle groups. Do not hardcode a single split.
- Verify every exercise ID resolves to the caller-visible catalog and that per-day composition delegates to Routine Engine V2.
- At the API boundary, prove user-supplied catalog/context is not trusted over the authenticated catalog and generation does not persist plans, routines, or assignments.
- Run focused tests, relevant Jest coverage, typecheck, lint, production build, and existing relevant E2E coverage. Obtain a fresh independent review of the complete diff, address relevant findings with tests, then rerun verification.
- Open (do not merge) an app-native pull request targeting `develop` only after verification and review.

## Considered alternatives

- Refactor the shared weekly generator used by guided generation and plan improvement. Rejected because it crosses the explicit Workstream G exclusion.
- Use a deterministic-only weekly strategy. Rejected because it would unnecessarily remove Gemini-generated weekly strategy from Plan Coach.
