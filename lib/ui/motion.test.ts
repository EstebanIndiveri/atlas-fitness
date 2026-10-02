import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  MOTION_CELEBRATION_CLASS,
  MOTION_CONFIRMATION_CLASS,
  MOTION_DURATION_MS,
  MOTION_DURATION_RANGE_MS,
  MOTION_ORIENTATION_CLASS,
  MOTION_PROGRESS_CLASS,
  MOTION_REDUCED_MOTION_QUERY,
} from './motion';
import type { MotionPurpose } from './motion';

const globalsCss = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');
const packageJson = JSON.parse(
  readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const MOTION_CLASSES = [
  MOTION_ORIENTATION_CLASS,
  MOTION_CONFIRMATION_CLASS,
  MOTION_PROGRESS_CLASS,
  MOTION_CELEBRATION_CLASS,
] as const;

function walkSourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) {
      continue;
    }
    const full = path.join(root, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walkSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

const reducedMotionBlock = globalsCss.slice(
  globalsCss.indexOf('@media (prefers-reduced-motion: reduce)'),
);

describe('motion primitive contract (brief §16–17)', () => {
  it('exports exactly the committed CSS classes', () => {
    for (const className of MOTION_CLASSES) {
      expect(className.startsWith('motion-')).toBe(true);
      expect(globalsCss).toContain(`.${className}`);
    }
    expect(MOTION_REDUCED_MOTION_QUERY).toBe('(prefers-reduced-motion: reduce)');
  });

  it('keeps every duration inside its approved initial range', () => {
    for (const purpose of Object.keys(MOTION_DURATION_MS) as MotionPurpose[]) {
      const value = MOTION_DURATION_MS[purpose];
      const range = MOTION_DURATION_RANGE_MS[purpose];
      expect(value).toBeGreaterThanOrEqual(range.min);
      expect(value).toBeLessThanOrEqual(range.max);
      expect(globalsCss).toContain(`${value}ms`);
    }
  });

  it('declares a reduced-motion equivalent for every new primitive', () => {
    const reduceIndex = globalsCss.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(reduceIndex).toBeGreaterThanOrEqual(0);
    for (const className of MOTION_CLASSES) {
      expect(reducedMotionBlock).toContain(`.${className}`);
    }
  });

  it('never introduces perpetual feedback or generic transition-all', () => {
    expect(globalsCss).not.toContain('transition-all');
    expect(globalsCss).not.toMatch(/animation[^;]*infinite/);
    for (const className of MOTION_CLASSES) {
      expect(globalsCss).not.toMatch(new RegExp(`\\.${className}[^}]*animation-iteration-count:\\s*infinite`));
    }
  });

  it('retires the replayable streak pop', () => {
    expect(globalsCss).not.toContain('.streak-pop');
    expect(globalsCss).not.toContain('@keyframes streak-pop');
  });

  it('adds no JS motion or 3D dependency', () => {
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    for (const banned of ['framer-motion', 'motion', 'three', '@react-three/fiber']) {
      expect(allDependencies).not.toHaveProperty(banned);
    }
  });
});

describe('motion consumers stay inside the contract', () => {
  it('does not trigger the celebration primitive in any product component', () => {
    const files = [...walkSourceFiles(path.join(process.cwd(), 'components')), ...walkSourceFiles(path.join(process.cwd(), 'app'))];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toContain('MOTION_CELEBRATION_CLASS');
      expect(content).not.toContain('motion-celebrate');
    }
  });

  it('drives the Today completion meter through the progress purpose', () => {
    const hero = readFileSync(
      path.join(process.cwd(), 'components', 'today', 'TodayWorkoutHeroParts.tsx'),
      'utf8',
    );
    expect(hero).toContain('MOTION_PROGRESS_CLASS');
    expect(hero).not.toContain('transition-[width]');
    expect(hero).not.toContain('duration-500');
  });
});
