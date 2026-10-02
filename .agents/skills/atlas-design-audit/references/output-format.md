# Audit Output Format

# Atlas Design Audit

## Preflight

Branch:
SHA:
Working tree:
Version:

Requested routes:
Resolved routes:

Render target:
Data source:
Data source classification:
Auth:

Evidence tier:

## Capability Matrix

For each relevant specialist:

| Skill | Installed | Runtime available | Routing trigger | Used | Reason |
|-------|-----------|-------------------|-----------------|------|--------|
|       |           |                   |                 |      |        |

Use `NOT_APPLICABLE` for runtime availability where the skill is not
implementation-tooling bound.

Distinguish installed from runnable. An installed skill with unavailable
runtime must appear here as installed but not runtime-available.

## Baseline

Branch:
SHA:
Version:
Date:
Routes:
Rendered verification:
Relevant brief:

## Preserve

Only list strengths that should explicitly survive redesign.

Do not credit a declared role that no reviewed surface consumes; report role
non-adoption as drift instead.

## System Findings

### A-001 — <title>

Severity: P1
Confidence: HIGH
Evidence: BOTH

Routes:
Components:

Problem:

Evidence:

Why it matters:

Atlas principle:

Recommendation:

Implementation impact:

Verification:

---

## Route Findings

Group by route.

For each requested route record:

Requested route:
Route type: SCREEN | REDIRECT | LAYOUT_ONLY | NOT_FOUND | DYNAMIC_ROUTE_REQUIRING_FIXTURE
Effective route:
Audited: YES | NO

Do not repeat system findings.

Do not score a redirect stub as a screen.

---

## Design-system drift

List:

- token bypasses
- role misuse
- role non-adoption (declared but unused)
- duplicate primitives
- hardcoded values
- component divergence

---

## Responsive / Accessibility

Separate confirmed failures from hypotheses.

Report 200% text zoom as content loss vs intentional truncation separately.

Report touch targets against both the 24 CSS px minimum and the Atlas 44 px
preferred target.

---

## Motion

For each motion finding specify:

Trigger:
Purpose:
Duration:
Reduced-motion:
Domain event:

Also distinguish governed motion primitives from raw transition utilities
that the reduced-motion block does not cover.

---

## Unknowns

Explicitly document things that could not be verified.

Unknown is preferable to invented certainty.

State the evidence tier and which claim classes remain LIKELY/UNKNOWN under
SOURCE_ONLY.

---

# Candidate Wave

Do not implement.

Group candidate work into coherent slices.

For each slice:

Objective:
Files likely affected:
Dependencies:
Risk:
Verification:
Specialist skills useful:

---

AUDIT_STATUS:
EVIDENCE_TIER:
SAFE_RENDER_TARGET: YES | NO
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
