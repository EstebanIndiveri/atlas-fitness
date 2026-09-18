import { describe, expect, it } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useRestTimer } from './useRestTimer';

describe('useRestTimer', () => {
  it('starts and skips the countdown', () => {
    const { result } = renderHook(() => useRestTimer());

    act(() => {
      result.current.start(45);
    });
    expect(result.current.active).toBe(true);
    expect(result.current.remaining).toBe(45);

    act(() => {
      result.current.skip();
    });
    expect(result.current.active).toBe(false);
    expect(result.current.remaining).toBe(0);
  });
});
