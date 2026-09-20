/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from '@jest/globals';

describe('Routine detail route', () => {
  it('reuses the existing routine editor page so /dashboard/routines/:id exists', async () => {
    const detail = await import('./page');
    const edit = await import('./edit/page');

    expect(detail.default).toBe(edit.default);
  });
});
