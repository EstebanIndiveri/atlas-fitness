import { describe, expect, it } from '@jest/globals';
import { compareMaxWeight } from './compare-sets';

describe('compareMaxWeight', () => {
  it('returns none when there is no previous session', () => {
    expect(compareMaxWeight([{ weightKg: '80' }], null).direction).toBe('none');
    expect(compareMaxWeight([{ weightKg: '80' }], []).previousMaxKg).toBeNull();
  });

  it('compares decimal string max weights without asserting floats', () => {
    const up = compareMaxWeight([{ weightKg: '82.5' }, { weightKg: '80' }], [{ weightKg: '80' }]);
    expect(up.direction).toBe('up');
    expect(up.currentMaxKg).toBe('82.5');
    expect(up.previousMaxKg).toBe('80');
    expect(up.deltaKg).toBe('2.5');

    const down = compareMaxWeight([{ weightKg: '75' }], [{ weightKg: '80' }]);
    expect(down.direction).toBe('down');
    expect(down.deltaKg).toBe('5');

    const same = compareMaxWeight([{ weightKg: '80.0' }], [{ weightKg: '80' }]);
    expect(same.direction).toBe('same');
  });
});
