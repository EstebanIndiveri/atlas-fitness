import { describe, expect, it } from '@jest/globals';
import {
  EMPTY_SEMANTIC_DRAFT,
  applyLoadMode,
  applySide,
  defaultWeightForLoadMode,
  draftFromConfirmedSet,
  draftToCapture,
  evaluateCapture,
} from './semantics-draft';
import type { SemanticDraft } from './semantics-draft';

const externalDraft: SemanticDraft = {
  loadMode: 'external',
  amountBasis: 'total',
  side: 'bilateral',
  setPurpose: 'working',
  repCountBasis: '',
};

describe('draftFromConfirmedSet', () => {
  it('restores a v1 tuple', () => {
    expect(
      draftFromConfirmedSet({
        loadMode: 'external',
        amountBasis: 'per_side',
        side: 'left',
        setPurpose: 'warmup',
        repCountBasis: null,
      }),
    ).toEqual({
      loadMode: 'external',
      amountBasis: 'per_side',
      side: 'left',
      setPurpose: 'warmup',
      repCountBasis: '',
    });
  });

  it('ignores invalid values instead of inferring', () => {
    expect(
      draftFromConfirmedSet({
        loadMode: 'nope',
        amountBasis: 'total',
        side: null,
        setPurpose: 'working',
        repCountBasis: 'per_side',
      }),
    ).toEqual({
      loadMode: '',
      amountBasis: 'total',
      side: '',
      setPurpose: 'working',
      repCountBasis: 'per_side',
    });
  });
});

describe('applyLoadMode', () => {
  it('clears the amount basis for bodyweight', () => {
    const next = applyLoadMode(externalDraft, 'bodyweight');
    expect(next.amountBasis).toBe('');
    expect(next.loadMode).toBe('bodyweight');
  });

  it('clears a per_side basis when the side is left/right', () => {
    const next = applyLoadMode({ ...externalDraft, side: 'left', amountBasis: 'per_side' }, 'assisted');
    expect(next.amountBasis).toBe('');
  });
});

describe('applySide', () => {
  it('clears repCountBasis when leaving alternating', () => {
    const next = applySide({ ...externalDraft, side: 'alternating', repCountBasis: 'per_side' }, 'bilateral');
    expect(next.repCountBasis).toBe('');
  });

  it('clears per_side amount basis for left/right', () => {
    const next = applySide({ ...externalDraft, amountBasis: 'per_side' }, 'right');
    expect(next.amountBasis).toBe('');
  });
});

describe('draftToCapture', () => {
  it('returns null when a required selection is missing', () => {
    expect(draftToCapture(EMPTY_SEMANTIC_DRAFT, '40', 8)).toBeNull();
    expect(draftToCapture({ ...externalDraft, amountBasis: '' }, '40', 8)).toBeNull();
  });

  it('maps an empty basis to null and stamps version 1', () => {
    expect(draftToCapture({ ...externalDraft, amountBasis: '' }, '40', 8)).toBeNull();
    expect(
      draftToCapture(
        { loadMode: 'bodyweight', amountBasis: '', side: 'bilateral', setPurpose: 'working', repCountBasis: '' },
        '0',
        8,
      ),
    ).toMatchObject({ semanticCaptureVersion: 1, loadMode: 'bodyweight', amountBasis: null, repCountBasis: null });
  });
});

describe('evaluateCapture', () => {
  it('accepts an external working set', () => {
    expect(evaluateCapture(externalDraft, '80', 8)?.ok).toBe(true);
  });

  it('accepts bodyweight with the zero sentinel', () => {
    const draft: SemanticDraft = { loadMode: 'bodyweight', amountBasis: '', side: 'bilateral', setPurpose: 'working', repCountBasis: '' };
    expect(evaluateCapture(draft, '0', 8)?.ok).toBe(true);
    expect(evaluateCapture(draft, '5', 8)?.ok).toBe(false);
  });

  it('rejects external zero and missing basis', () => {
    expect(evaluateCapture(externalDraft, '0', 8)?.ok).toBe(false);
    expect(evaluateCapture({ ...externalDraft, amountBasis: '' }, '80', 8)).toBeNull();
  });

  it('requires a rep-count basis for alternating', () => {
    const draft: SemanticDraft = { ...externalDraft, side: 'alternating', repCountBasis: '' };
    expect(evaluateCapture(draft, '40', 8)).toBeNull();
    expect(evaluateCapture({ ...draft, repCountBasis: 'per_side' }, '40', 8)?.ok).toBe(true);
  });

  it('records warmups but does not mark them comparable', () => {
    const result = evaluateCapture({ ...externalDraft, setPurpose: 'warmup' }, '40', 8);
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.outcome).toBe('recorded_not_comparable');
    }
  });
});

describe('defaultWeightForLoadMode', () => {
  it('seeds the bodyweight sentinel and clears other modes', () => {
    expect(defaultWeightForLoadMode('bodyweight')).toBe('0');
    expect(defaultWeightForLoadMode('external')).toBe('');
    expect(defaultWeightForLoadMode('')).toBe('');
  });
});
