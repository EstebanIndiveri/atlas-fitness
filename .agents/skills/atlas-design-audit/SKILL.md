---
name: atlas-design-audit
description: >
  Audit the current Atlas Fitness product UI against the product's real visual
  system, UX principles, accessibility requirements, responsive behavior,
  motion grammar, and implementation constraints. Use for visual audits,
  cross-page consistency reviews, UX/design-system drift detection, or before
  planning a visual improvement wave. Audit mode is read-only by default and
  always begins with a mandatory safety and capability preflight.
---

# Atlas Design Audit

Atlas-specific design and UX audit orchestrator.

This skill evaluates the EXISTING Atlas product.

It does not redesign Atlas from personal taste.

It does not treat third-party design skills as sources of truth.

Atlas itself is the source of truth.

Version: v0.2 — adds Phase 0 preflight, data-source safety gate, evidence
tiers, and conditional specialist routing.

# 0. Default mode

Default mode is:

AUDIT_ONLY

Unless the user explicitly asks for implementation:

- do not edit files
- do not create files outside the requested audit artifact
- do not install dependencies
- do not change tokens
- do not change components
- do not modify routes
- do not commit
- do not push
- do not create branches
- do not open PRs
- do not modify databases
- do not modify production

Never silently transition from audit into implementation.

## 0.1 Hard safety invariant

In AUDIT_ONLY, the auditor MUST NOT authenticate against, mutate, or probe an
unverified remote or production data source — not even to obtain screenshots.

This invariant outranks the preference for rendered evidence.

Phase 0 exists to enforce it.

# 1. Phase 0 — Audit safety and capability preflight

Phase 0 is mandatory and runs BEFORE any evaluation or rendered work.

It resolves, and the audit must report:

- GIT_BRANCH
- GIT_SHA
- WORKTREE_CLEAN
- PACKAGE_VERSION
- REQUESTED_ROUTES
- ROUTE_RESOLUTION
- RENDER_TARGET
- DATA_SOURCE
- DATA_SOURCE_CLASSIFICATION
- AUTH_METHOD
- SKILLS_AVAILABLE
- RUNTIME_CAPABILITIES
- ACHIEVABLE_EVIDENCE_TIER

If the expected baseline SHA does not match the working SHA, report the
mismatch and either stop or continue explicitly against the actual SHA. Never
silently audit a different commit than the one requested.

# 2. Data source safety

This is a hard invariant, not a preference.

Classify the data source as exactly one of:

## LOCAL_TEST

A local/test database known to be disposable and safe.

Allowed for a rendered audit.

## LOCAL_UNKNOWN

A local data source whose contents/origin are not verified.

Do not authenticate until verified.

## REMOTE_TEST

A remote data source explicitly documented as disposable and safe.

Only use if it is explicitly documented as such AND the audit requires it.

## REMOTE_UNKNOWN

DO NOT authenticate or mutate.

## PRODUCTION

DO NOT authenticate or mutate.

If a running application points to REMOTE_UNKNOWN or PRODUCTION, it is NOT an
acceptable automatic audit target, regardless of how convenient it is.

Do not guess the classification from the hostname alone when configuration
evidence can establish the source. Read the actual configuration.

# 3. Render target policy

Rendered evidence is preferred but must be safe. Preferred order:

1. an existing repo-owned verification harness on the correct SHA
2. a safe already-running local test target on the correct SHA and data source
3. a safe local target using already-available dependencies and a local test DB
4. SOURCE_ONLY degradation

AUDIT_ONLY must NOT install dependencies merely to obtain rendered evidence.

AUDIT_ONLY must NOT change database or configuration merely to obtain
screenshots.

Starting a local dev server is allowed only when ALL hold:

- dependencies are already available
- the target SHA is correct
- the data source is verified LOCAL_TEST
- authentication is verified test/local
- no product file is modified

If rendered verification is explicitly REQUIRED by the user's request and no
safe target exists, STOP and report:

RENDER_TARGET_UNAVAILABLE

Otherwise continue honestly at SOURCE_ONLY.

# 4. Evidence tiers

Every audit declares exactly one tier:

RENDERED
MIXED
SOURCE_ONLY

## RENDERED

Important visual findings have rendered evidence.

## MIXED

Some findings rendered, some source-only. Tag each finding accordingly.

## SOURCE_ONLY

No safe rendered target could be established.

A SOURCE_ONLY audit MAY complete as COMPLETE_SOURCE_ONLY.

But it MUST NOT make factual claims about:

- actual clipping
- actual overflow
- visual hierarchy as rendered
- computed hit target size
- computed contrast
- actual motion behavior
- actual zoom breakage

Those remain LIKELY or UNKNOWN until rendered.

# 5. Required project context

Before evaluating design, read:

1. `AGENTS.md`
2. `docs/engineering/conventions-fe.md`
3. current relevant architecture ADRs
4. current approved visual/product brief when available
5. `app/globals.css`
6. `lib/ui/tokens.ts`
7. `lib/ui/roles.ts`
8. `lib/ui/motion.ts`
9. `lib/ui/contrast.ts`

For the current Atlas visual system also inspect:

`docs/superpowers/specs/2026-09-30-v0.13.0-visual-motion-engagement-brief.md`

If a newer approved visual/design brief exists, prefer it and report that it
supersedes this baseline.

Do not assume documentation is newer than code. Do not assume documentation
is current without comparing it against the implementation.

# 6. Sources of truth

Authority order:

1. Product semantics and real domain data
2. Approved Atlas architecture/product decisions
3. Current rendered behavior
4. Atlas design system
5. Existing reusable Atlas components
6. Current implementation
7. External design guidelines
8. General aesthetic preference

External skills MAY identify problems.

External skills MUST NOT redefine Atlas.

# 7. Atlas visual invariants

Read `references/atlas-visual-contract.md`.

At minimum preserve these invariants:

- Atlas visual thesis: calm athleticism ("calma atlética")
- warm, human base
- precise presentation of data
- brief energy only around real verified events
- one dominant hierarchy per screen
- fact before decoration
- mobile-first, starting at 390px
- no generic SaaS card proliferation
- no neon/gaming visual language
- no infantilized gamification
- no invented fitness claims
- no visual treatment implying progress when data is unknown
- motion must communicate state, orientation, continuity, confirmation,
  verified progress, or celebration
- no perpetual attention animation
- reduced motion must preserve all information

# 8. Design-system invariants

The CSS token source of truth is:

`app/globals.css` → `@theme`

The typed mirror is:

`lib/ui/tokens.ts`

Reusable semantic visual composition is:

`lib/ui/roles.ts`

Motion primitives are declared in:

`lib/ui/motion.ts` (mirroring `app/globals.css`)

Contrast helpers live in:

`lib/ui/contrast.ts`

Do NOT create or recommend a parallel token system without demonstrating a
concrete deficiency in the existing one.

Semantic colors are not interchangeable.

In particular:

- action != verified progress
- verified != generic success
- unknown != zero
- warning != decoration
- danger != emphasis

Surface hierarchy:

L0 = canvas
L1 = panel
L2 = overlay / focused hero

Shape roles:

- control
- panel
- hero
- pill only for actual pills/circles

Typography roles:

- display
- heading
- body
- caption
- numeric

Role existence is not role adoption. A declared role that no reviewed surface
consumes is a finding, and must be reported as drift rather than credited as a
strength.

# 9. Specialist routing v0.2

Do NOT invoke every specialist on every route.

An installed skill does NOT imply its underlying runtime/tooling is usable.

For every specialist the audit must distinguish:

- SKILL_AVAILABLE: YES | NO
- RUNTIME_CAPABILITY_AVAILABLE: YES | NO | NOT_APPLICABLE
- USED_IN_THIS_AUDIT: YES | NO

## PRIMARY VISUAL CRITIC

Use: `impeccable`

Purpose:

- composition
- hierarchy
- density
- visual coherence
- polish
- product personality

It identifies candidate visual findings. The Atlas contract remains
authoritative.

## WEB STANDARDS CHECK

Use: `web-design-guidelines`

Purpose:

- standards-oriented UI review
- interaction conventions
- responsive/web implementation concerns

It is NOT a second aesthetic critic. Do not duplicate Impeccable findings
unless it adds standards evidence.

## UI-DESIGN

Use: `ui-design`

Do NOT run `ui-design` by default in AUDIT_ONLY.

Use only when:

- a finding requires exploring a concrete design alternative
- the user explicitly requests redesign/improvement exploration
- implementation planning begins

Initial diagnosis belongs to Impeccable.

## DESIGN-SYSTEM DRIFT

Use: `muse`

ONLY when source discovery detects signal such as:

- arbitrary colors
- arbitrary radii
- arbitrary spacing
- token bypass
- duplicate primitives
- semantic-role misuse
- parallel systems

Do not run it on every route automatically.

## TYPOGRAPHY

Use: `typography-audit`

ONLY when typography or data-density signal exists.

Load only the relevant rule families.

Do NOT run its entire rule corpus by default.

## ACCESSIBILITY

Use: `web-accessibility`

When reviewed surfaces contain meaningful interaction, or when these need
specialist adjudication:

- keyboard behavior
- focus
- semantics
- accessible names
- touch targets
- zoom/reflow
- color-independent meaning

Rendered verification still owns actual computed/rendered facts.

## MOTION

Use: `ui-animation`

ONLY when actual motion/transition is present, or motion is part of the
finding.

The Atlas motion grammar remains authoritative.

Do not recommend animation merely to make a screen feel richer.

## RENDER VERIFICATION

Use: `ui-verification`

when its runtime capability is actually available.

An installed skill whose browser tooling is disconnected must be reported
explicitly:

SKILL_AVAILABLE: YES
RUNTIME_CAPABILITY_AVAILABLE: NO

Do not pretend it ran.

## APP VERIFICATION

Use: `app-verification`

only when:

- an Atlas repo-owned verification harness exists, or
- the task explicitly asks to design/maintain that harness

The `app-verification` SKILL is AVAILABLE. That is separate from the question
of whether Atlas currently owns a verification harness. Report the two
separately:

- app-verification skill: AVAILABLE
- Atlas app verification harness: NOT PRESENT (until one exists)

The installed skill is NOT evidence that Atlas already has a harness.

## REACT / NEXT ARCHITECTURE

Use `vercel-composition-patterns` and/or `vercel-react-best-practices`

ONLY if a finding materially concerns:

- component architecture
- rendering behavior
- composition
- Next.js performance/runtime

Do not invoke for visual taste.

## OUT OF ROUTINE AUDIT

`brandkit` and `img2threejs` are not part of a normal Atlas audit.

Body Map / 3D remains outside current production scope.

Do not reference skills that are not installed.

# 10. Specialist accounting

For every specialist considered, record:

SKILL
SKILL_AVAILABLE: YES | NO
RUNTIME_CAPABILITY_AVAILABLE: YES | NO | NOT_APPLICABLE
ROUTING_TRIGGER
USED: YES | NO
IF NOT USED: why
IF USED:
- UNIQUE_FINDINGS
- DUPLICATE_FINDINGS
- LOW_VALUE_FINDINGS
- CONTEXT_COST: LOW | MEDIUM | HIGH

This accounting is required during skill-validation runs.

# 11. Audit phases

After Phase 0, always follow this sequence.

## Phase 1 — Discovery

Determine:

- branch / SHA
- current product version
- relevant routes
- design-system files
- relevant product/visual briefs
- reusable components
- responsive/navigation shell
- whether rendered verification is available

Output a short discovery summary.

Do not make design recommendations yet.

## Phase 2 — Product truth

Understand what each reviewed screen is trying to communicate.

For metrics and fitness claims identify:

- source
- semantic state
- whether the value is verified
- whether it is historical
- whether evidence is insufficient

Never recommend UI that invents stronger product semantics.

Example:

If Atlas only knows that a session was completed, do not recommend saying
"You're stronger today" unless the progression contract actually supports it.

## Phase 3 — Cross-page visual audit

Evaluate:

1. information architecture
2. primary hierarchy
3. visual hierarchy
4. density
5. surface hierarchy
6. card proliferation
7. typography
8. spacing
9. color semantics
10. iconography
11. states
12. navigation
13. responsive behavior
14. accessibility
15. motion
16. product personality
17. consistency across routes

Do not evaluate screens in isolation only. Look for system-level drift.

## Phase 4 — Implementation-system audit

Evaluate:

- token usage
- visual hardcoding
- primitive reuse
- component duplication
- prop/API complexity
- reusable component boundaries
- React rendering implications
- unnecessary client-side complexity

For implementation architecture, use when useful:

- `vercel-composition-patterns`
- `vercel-react-best-practices`

These may influence implementation recommendations but must not redefine the
visual product direction.

## Phase 5 — Evidence verification

For every important finding determine whether it is:

VERIFIED_RENDERED
VERIFIED_SOURCE
LIKELY
UNKNOWN

Never present a source-only visual hypothesis as a rendered fact.

Capture screenshots when the available harness supports it.

Check relevant responsive sizes, including mobile around 390px.

## Phase 6 — Synthesis

Merge duplicate findings.

Resolve conflicts between specialist skills.

Atlas rules win conflicts.

Do not return seven independent audit reports.

Return one coherent Atlas audit.

# 12. Route resolution

For every requested route, determine its type:

SCREEN
REDIRECT
LAYOUT_ONLY
NOT_FOUND
DYNAMIC_ROUTE_REQUIRING_FIXTURE

Record, per route:

REQUESTED_ROUTE
ROUTE_TYPE
EFFECTIVE_ROUTE
AUDITED: YES | NO

Example:

/dashboard

ROUTE_TYPE: REDIRECT
EFFECTIVE_ROUTE: /dashboard/today

Do not score a redirect file as a screen. Audit the effective route instead,
and record the redirect as a resolved fact.

# 13. Finding schema

Every actionable finding must contain:

ID
Severity
Confidence
Evidence
Route(s)
Component(s)
Category
Problem
Why it matters
Atlas principle affected
Recommendation
Implementation impact
Verification method

Severity: P0–P3 (see §14).

Confidence: HIGH | MEDIUM | LOW

Evidence: RENDER | SOURCE | BOTH

# 14. Severity anchors

P0:

- core/safe use impossible
- destructive or severe product-truth failure
- critical accessibility barrier preventing required use

P1:

- real content loss
- essential interaction inaccessible
- major systemic inconsistency with approved Atlas architecture
- major hierarchy/usability problem verified across meaningful surfaces

P2:

- meaningful non-blocking usability/accessibility issue
- substantial design-system drift
- route-specific interaction inconsistency
- refinement with measurable user impact

P3:

- polish
- cosmetic inconsistency
- optional refinement without material usability/product-truth impact

Rules for ambiguous cases:

200% text zoom:

- content LOSS / inaccessible essential content: P1 candidate
- horizontal scrolling alone: do NOT automatically label P1
- intentional ellipsis: not a failure until adjudicated

Touch targets:

- below 24 CSS px: standards failure; severity depends on task importance
- 24–43 px: may pass minimum web requirements but violate the Atlas/mobile
  comfort target; normally P2 unless the interaction is essential and
  demonstrably difficult
- 44+ px: preferred Atlas mobile target for primary interactive controls

Missing expected keyboard interaction in a composite widget:

- severity depends on whether an equivalent operable path exists
- do not automatically inflate to P1

Do not inflate severity for visual preference.

# 15. Reduced motion

Distinguish carefully:

- a CSS motion primitive that correctly supports reduce
  (for example `.motion-orient` neutralized inside the
  `prefers-reduced-motion: reduce` block)

from:

- arbitrary `transition` utilities that the grammar does not cover

Do NOT report "reduced motion passes" merely because the governed primitives
pass, if raw transitions remain active on the same surface.

Report which motion mechanisms were exercised and which remain uncovered.

# 16. Recommendation constraints

Recommendations should prefer, in order:

1. reuse existing Atlas primitive
2. reuse existing semantic role
3. extend existing component
4. extend an existing token/role
5. introduce a new primitive only when the system cannot express the need

Avoid:

- redesign for novelty
- arbitrary new colors
- arbitrary radius values
- arbitrary shadows
- new animation libraries without demonstrated need
- icon libraries without governance
- replacing functioning UI solely because another aesthetic is fashionable
- mass migrations unrelated to the finding

# 17. Audit output

Read:

`references/output-format.md`

The final audit must include:

1. preflight
2. capability matrix
3. baseline
4. strengths worth preserving
5. system-level findings
6. route-level findings
7. design-system drift
8. responsive/a11y findings
9. motion findings
10. contradictions / unknowns
11. prioritized candidate improvements
12. suggested next wave

Do NOT implement the suggested wave unless explicitly requested.

# 18. Completion gate

A RENDERED or MIXED audit is complete when:

- preflight passed
- target/data/auth safety was established
- project truth was read
- visual system was read
- relevant screens were inspected
- relevant rendered claims were verified
- specialist routing was executed
- outputs were synthesized
- duplicates were removed
- recommendations use Atlas language
- source-only hypotheses are identified as such
- no mutation occurred

A SOURCE_ONLY audit may complete as:

COMPLETE_SOURCE_ONLY

when:

- preflight completed
- no safe render path was available
- no rendered facts were invented
- all visual hypotheses are marked LIKELY or UNKNOWN

If rendered verification was explicitly required by the user and no safe
target exists, the correct result is:

RENDER_TARGET_UNAVAILABLE

End with:

AUDIT_STATUS:
EVIDENCE_TIER:
SAFE_RENDER_TARGET:
BASE_SHA:
ROUTES_REVIEWED:
RENDER_VERIFIED:
P0:
P1:
P2:
P3:
UNKNOWN:
SPECIALISTS_AVAILABLE:
SPECIALISTS_USED:
SPECIALISTS_SKIPPED_BY_ROUTER:
RUNTIME_CAPABILITY_GAPS:
RECOMMENDED_NEXT_STEP:
