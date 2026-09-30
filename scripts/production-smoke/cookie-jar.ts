/**
 * Private in-memory cookie jar.
 *
 * Cookies live only in process memory for the duration of a run. Nothing is
 * persisted, logged, or uploaded. Values are never exposed by the runner.
 */
export class CookieJar {
  private readonly cookies = new Map<string, string>();

  /** Stores cookies from response `Set-Cookie` values, honoring deletions. */
  capture(setCookieValues: readonly string[]): void {
    for (const raw of setCookieValues) {
      const [pair, ...attributes] = raw.split(';');
      if (!pair) {
        continue;
      }
      const separator = pair.indexOf('=');
      if (separator <= 0) {
        continue;
      }
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      const expired = attributes
        .map((attribute) => attribute.trim().toLowerCase())
        .some((attribute) => attribute === 'max-age=0' || attribute.startsWith('max-age=-'));
      if (expired || value.length === 0) {
        this.cookies.delete(name);
        continue;
      }
      this.cookies.set(name, value);
    }
  }

  /** Serializes the jar into a single `Cookie` request header (or `null`). */
  header(): string | null {
    if (this.cookies.size === 0) {
      return null;
    }
    return Array.from(this.cookies, ([name, value]) => `${name}=${value}`).join('; ');
  }

  get isEmpty(): boolean {
    return this.cookies.size === 0;
  }

  clear(): void {
    this.cookies.clear();
  }
}
