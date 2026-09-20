import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react';
import { MoodFace } from './MoodFace';

describe('MoodFace', () => {
  it('renders an svg face with three feature paths and an outline circle', () => {
    const { container } = render(<MoodFace value={4} />);
    const svg = container.querySelector('svg');

    expect(svg).toBeTruthy();
    expect(svg?.querySelectorAll('path')).toHaveLength(3);
    expect(svg?.querySelector('circle')).toBeTruthy();
  });

  it('varies the mouth path by mood value', () => {
    const worst = render(<MoodFace value={1} />).container.querySelectorAll('path')[2].getAttribute('d');
    const best = render(<MoodFace value={5} />).container.querySelectorAll('path')[2].getAttribute('d');

    expect(worst).not.toBe(best);
  });

  it('falls back to the neutral mouth for out-of-range values', () => {
    const neutral = render(<MoodFace value={3} />).container.querySelectorAll('path')[2].getAttribute('d');
    const fallback = render(<MoodFace value={99} />).container.querySelectorAll('path')[2].getAttribute('d');

    expect(fallback).toBe(neutral);
  });
});
