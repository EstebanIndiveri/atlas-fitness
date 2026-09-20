import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

interface Journal {
  entries: JournalEntry[];
}

function loadJournal(): Journal {
  const path = join(cwd(), 'lib/db/migrations/meta/_journal.json');
  return JSON.parse(readFileSync(path, 'utf8')) as Journal;
}

describe('migrations journal ordering', () => {
  it('keeps `when` timestamps strictly increasing with journal index', () => {
    const { entries } = loadJournal();
    const ordered = [...entries].sort((a, b) => a.idx - b.idx);

    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      expect(current.when).toBeGreaterThan(previous.when);
    }
  });
});
