# Atlas Design Audit Rubric

For every reviewed route answer:

## Preflight and safety

- Was Phase 0 completed before any evaluation?
- Is the audited SHA the requested SHA?
- Was the working tree state recorded?
- Is the data source classified?
- If rendered, was the render target verified safe for AUDIT_ONLY?
- Was authentication performed only against a verified test/local source?

## Route resolution

- Was the requested route resolved to a type?
- If it is a REDIRECT, was the effective route identified and audited instead?
- Was a redirect stub correctly NOT scored as a screen?
- If DYNAMIC_ROUTE_REQUIRING_FIXTURE, was the fixture documented or skipped?

## Evidence tier

- What is the declared evidence tier (RENDERED / MIXED / SOURCE_ONLY)?
- Does every visual claim match the tier it was actually verified at?
- Are SOURCE_ONLY claims correctly marked LIKELY or UNKNOWN rather than stated
  as rendered fact?

## Purpose

- What is the user's main job?
- What should visually dominate?
- What is secondary?
- What should disappear until needed?

## Hierarchy

- Is there exactly one dominant region?
- Are multiple cards competing?
- Are primary and secondary CTAs distinguishable?
- Can the page be understood in 3–5 seconds?

## Surfaces

- Is L0/L1/L2 hierarchy respected?
- Are cards nested unnecessarily?
- Is shadow being used semantically?
- Are borders/radius consistent?

## Role adoption vs mere token existence

- Which v0.13 roles does this surface actually consume?
- Is a role merely declared in tokens/roles while no reviewed surface uses it?
- Is a legacy primitive (`rounded-lg`, `shadow-card`, `font-serif`, raw
  transition) still carrying the surface?
- Do not credit role existence as a strength when adoption is absent.

## Typography

- Do roles match their intended use?
- Are numbers comparable at a glance?
- Does long es-AR copy break hierarchy?
- Does 200% zoom remain usable?
- Are arbitrary size/spacing values bypassing the scale?

## Color semantics

- Is action visually distinct from verified progress?
- Is unknown visibly different from zero?
- Is danger reserved for danger?
- Is meaning also communicated without color?
- Do distinct semantic roles resolve to distinct primitives?

## Motion

For each motion:

- trigger
- purpose
- duration
- repetition
- interruption
- reduced-motion behavior
- underlying verified event

Then separate:

- governed primitives that correctly support reduce
- raw transition utilities the grammar does not cover

If purpose cannot be stated, recommend removing it.

## Components

- Is there an existing primitive that should be reused?
- Are there local duplicates?
- Are variants becoming boolean-prop soup?
- Is UI logic leaking into page components?

## States

Check:

- default
- hover
- focus
- pressed
- disabled
- loading
- empty
- error
- success/confirmation
- unknown
- partial data

## Responsive

Check at least:

- ~390px
- tablet if behavior changes
- desktop

Evaluate:

- overflow
- wrapping
- safe areas
- fixed navigation
- touch targets
- keyboard
- dense metrics

## Accessibility

Check:

- semantics
- labels
- keyboard
- focus
- contrast
- accessible names
- screen-reader state
- touch targets
- reduced motion
- 200% zoom

Touch target judgement:

- below 24 CSS px: standards failure; severity depends on task importance
- 24–43 px: may pass minimum web requirements but violates the Atlas 44 px
  preferred mobile target; normally P2 unless the interaction is essential and
  demonstrably difficult
- 44+ px: preferred Atlas mobile target for primary controls

Keyboard judgement:

- missing expected arrow-key behavior in a composite widget is a finding
- severity depends on whether an equivalent operable path exists
- do not automatically inflate to P1

## Zoom adjudication

Separate:

- content LOSS / essential content inaccessible at 200%: P1 candidate
- horizontal scrolling at 200% alone: do NOT automatically label P1
- intentional ellipsis: not a failure until adjudicated

State explicitly which of the three applies.

## Product personality

Ask:

Does this feel like Atlas?

Do not reward uniqueness for its own sake.

Check consistency with "calma atlética".
