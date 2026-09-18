function collectErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  const seen = new Set<object>();
  const stack: unknown[] = [error];

  while (stack.length > 0) {
    const current = stack.pop();

    if (typeof current === 'string') {
      messages.push(current);
      continue;
    }

    if (current === null || current === undefined) {
      continue;
    }

    if (typeof current === 'object') {
      if (seen.has(current)) {
        continue;
      }
      seen.add(current);
    }

    if (current instanceof Error) {
      messages.push(current.message);
      stack.push(current.cause);
      continue;
    }

    if (typeof current === 'object') {
      const record = current as { message?: unknown; cause?: unknown };

      if (typeof record.message === 'string') {
        messages.push(record.message);
      }

      if ('cause' in record) {
        stack.push(record.cause);
      }
    }
  }

  return messages;
}

export function isMissingDatabaseSchemaError(error: unknown): boolean {
  return collectErrorMessages(error).some((message) =>
    message.toLowerCase().includes('no such table'),
  );
}
