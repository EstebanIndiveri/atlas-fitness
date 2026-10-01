import { describe, expect, it } from '@jest/globals';
import { validateSemanticCapture } from './semantics';
import type {
  CaptureOutcome,
  SemanticCaptureInput,
  SemanticUnknownReason,
} from '@/types/progression';

const captureInput = (overrides: Partial<SemanticCaptureInput> = {}): SemanticCaptureInput => ({
  semanticCaptureVersion: 1,
  loadMode: 'external',
  amountBasis: 'total',
  side: 'bilateral',
  setPurpose: 'working',
  repCountBasis: null,
  weightKg: '100',
  reps: 5,
  ...overrides,
});

describe('validateSemanticCapture', () => {
  const validToRecord: Array<{
    label: string;
    input: Partial<SemanticCaptureInput>;
    outcome: CaptureOutcome;
  }> = [
    { label: 'external total bilateral working', input: { weightKg: '100' }, outcome: 'valid' },
    {
      label: 'external per_side bilateral working',
      input: { amountBasis: 'per_side', weightKg: '20' },
      outcome: 'valid',
    },
    {
      label: 'external total left working',
      input: { side: 'left', weightKg: '100' },
      outcome: 'valid',
    },
    {
      label: 'external total right working',
      input: { side: 'right', weightKg: '100' },
      outcome: 'valid',
    },
    {
      label: 'external total bilateral warmup',
      input: { setPurpose: 'warmup', weightKg: '60' },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'external total alternating working',
      input: { side: 'alternating', repCountBasis: 'total', weightKg: '30' },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'external per_side alternating warmup',
      input: {
        amountBasis: 'per_side',
        side: 'alternating',
        repCountBasis: 'per_side',
        setPurpose: 'warmup',
        weightKg: '10',
      },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'bodyweight bilateral working',
      input: { loadMode: 'bodyweight', amountBasis: null, weightKg: '0' },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'bodyweight left working',
      input: { loadMode: 'bodyweight', amountBasis: null, side: 'left', weightKg: '0' },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'bodyweight right warmup',
      input: {
        loadMode: 'bodyweight',
        amountBasis: null,
        side: 'right',
        setPurpose: 'warmup',
        weightKg: '0',
      },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'bodyweight alternating working',
      input: {
        loadMode: 'bodyweight',
        amountBasis: null,
        side: 'alternating',
        repCountBasis: 'total',
        weightKg: '0',
      },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'bodyweight_added total bilateral working',
      input: { loadMode: 'bodyweight_added', amountBasis: 'total', weightKg: '10' },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'bodyweight_added per_side bilateral working',
      input: { loadMode: 'bodyweight_added', amountBasis: 'per_side', weightKg: '5' },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'bodyweight_added total left working',
      input: { loadMode: 'bodyweight_added', amountBasis: 'total', side: 'left', weightKg: '10' },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'bodyweight_added total alternating working',
      input: {
        loadMode: 'bodyweight_added',
        amountBasis: 'total',
        side: 'alternating',
        repCountBasis: 'total',
        weightKg: '10',
      },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'assisted total bilateral working',
      input: { loadMode: 'assisted', amountBasis: 'total', weightKg: '30' },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'assisted total right working',
      input: { loadMode: 'assisted', amountBasis: 'total', side: 'right', weightKg: '12' },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'assisted per_side bilateral working',
      input: { loadMode: 'assisted', amountBasis: 'per_side', side: 'bilateral', weightKg: '8' },
      outcome: 'recorded_not_comparable',
    },
    {
      label: 'assisted per_side alternating warmup',
      input: {
        loadMode: 'assisted',
        amountBasis: 'per_side',
        side: 'alternating',
        repCountBasis: 'per_side',
        setPurpose: 'warmup',
        weightKg: '15',
      },
      outcome: 'recorded_not_comparable',
    },
  ];

  it('implements every VALID and RECORDED_BUT_NOT_COMPARABLE matrix row', () => {
    for (const testCase of validToRecord) {
      const result = validateSemanticCapture(captureInput(testCase.input));
      expect({ label: testCase.label, ...result }).toMatchObject({
        label: testCase.label,
        ok: true,
        outcome: testCase.outcome,
      });
    }
  });

  it('rejects every INVALID matrix row with a typed structural reason', () => {
    const invalid: Array<{ label: string; input: Partial<SemanticCaptureInput>; reason: SemanticUnknownReason }> = [
      {
        label: 'external per_side left',
        input: { amountBasis: 'per_side', side: 'left' },
        reason: 'invalid_semantic_combination',
      },
      {
        label: 'external per_side right',
        input: { amountBasis: 'per_side', side: 'right' },
        reason: 'invalid_semantic_combination',
      },
      {
        label: 'bodyweight with amount basis',
        input: { loadMode: 'bodyweight', amountBasis: 'total' },
        reason: 'invalid_semantic_combination',
      },
      {
        label: 'bodyweight_added per_side left',
        input: { loadMode: 'bodyweight_added', amountBasis: 'per_side', side: 'left' },
        reason: 'invalid_semantic_combination',
      },
      {
        label: 'assisted per_side right',
        input: { loadMode: 'assisted', amountBasis: 'per_side', side: 'right' },
        reason: 'invalid_semantic_combination',
      },
      {
        label: 'non-alternating with rep basis',
        input: { repCountBasis: 'total' },
        reason: 'invalid_semantic_combination',
      },
      {
        label: 'alternating without rep basis',
        input: { side: 'alternating' },
        reason: 'invalid_semantic_combination',
      },
      {
        label: 'external without amount basis',
        input: { amountBasis: null },
        reason: 'invalid_semantic_combination',
      },
      {
        label: 'legacy all null',
        input: {
          loadMode: null,
          amountBasis: null,
          side: null,
          setPurpose: null,
          repCountBasis: null,
        },
        reason: 'unknown_semantics',
      },
      { label: 'missing load mode', input: { loadMode: null }, reason: 'unknown_semantics' },
      { label: 'missing side', input: { side: null }, reason: 'unknown_semantics' },
      { label: 'missing purpose', input: { setPurpose: null }, reason: 'unknown_semantics' },
      {
        label: 'unsupported capture version',
        input: { semanticCaptureVersion: 2 },
        reason: 'unsupported_capture_version',
      },
    ];
    for (const testCase of invalid) {
      expect({ label: testCase.label, ...validateSemanticCapture(captureInput(testCase.input)) }).toEqual({
        label: testCase.label,
        ok: false,
        reason: testCase.reason,
      });
    }
  });

  it('rejects invalid amounts with invalid_amount', () => {
    const invalid: Array<Partial<SemanticCaptureInput>> = [
      { weightKg: '0' },
      { weightKg: '0.0' },
      { weightKg: '80.50' },
      { weightKg: '1.0' },
      { weightKg: '-5' },
      { weightKg: 'abc' },
      { weightKg: '' },
      { loadMode: 'assisted', amountBasis: 'total', weightKg: '0' },
      { loadMode: 'bodyweight_added', amountBasis: 'total', weightKg: '0' },
      { loadMode: 'bodyweight', amountBasis: null, weightKg: '5' },
      { loadMode: 'bodyweight', amountBasis: null, weightKg: '0.01' },
    ];
    for (const overrides of invalid) {
      expect(validateSemanticCapture(captureInput(overrides))).toEqual({
        ok: false,
        reason: 'invalid_amount',
      });
    }
  });

  it('accepts the zero sentinel only for bodyweight', () => {
    for (const weightKg of ['0', '0.00', '00']) {
      expect(
        validateSemanticCapture(
          captureInput({ loadMode: 'bodyweight', amountBasis: null, weightKg }),
        ),
      ).toMatchObject({ ok: true, outcome: 'recorded_not_comparable' });
    }
  });

  it('requires reps to be a positive integer', () => {
    for (const reps of [0, -1, 2.5, 1.0001]) {
      expect(validateSemanticCapture(captureInput({ reps }))).toEqual({
        ok: false,
        reason: 'invalid_amount',
      });
    }
    expect(validateSemanticCapture(captureInput({ reps: 1 }))).toMatchObject({ ok: true });
    expect(validateSemanticCapture(captureInput({ reps: 12 }))).toMatchObject({ ok: true });
  });
});
