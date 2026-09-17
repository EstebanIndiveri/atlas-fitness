export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export type ExerciseMatch<T extends { name: string; slug: string }> =
  | { status: 'matched'; exercise: T }
  | { status: 'ambiguous'; exercises: T[] }
  | { status: 'none' };

export function matchExercise<T extends { name: string; slug: string }>(
  query: string,
  catalog: T[]
): ExerciseMatch<T> {
  const needle = normalizeSearch(query);
  if (!needle) {
    return { status: 'none' };
  }

  const exact = catalog.filter((item) => {
    return normalizeSearch(item.name) === needle || normalizeSearch(item.slug) === needle;
  });
  if (exact.length === 1) {
    return { status: 'matched', exercise: exact[0] };
  }
  if (exact.length > 1) {
    return { status: 'ambiguous', exercises: exact };
  }

  const partial = catalog.filter((item) => {
    const name = normalizeSearch(item.name);
    const slug = normalizeSearch(item.slug);
    return name.includes(needle) || slug.includes(needle);
  });

  if (partial.length === 0) {
    return { status: 'none' };
  }

  const starts = partial.filter((item) => normalizeSearch(item.name).startsWith(needle));
  if (starts.length === 1) {
    return { status: 'matched', exercise: starts[0] };
  }
  if (partial.length === 1) {
    return { status: 'matched', exercise: partial[0] };
  }

  return { status: 'ambiguous', exercises: partial };
}
