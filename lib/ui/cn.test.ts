import { describe, expect, it } from '@jest/globals';
import { cn } from './cn';

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('bg-brand', false, undefined, 'rounded-md')).toBe('bg-brand rounded-md');
  });
});
