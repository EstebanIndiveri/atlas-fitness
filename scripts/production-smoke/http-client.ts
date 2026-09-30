import { MAX_REDIRECTS } from './constants';
import type { CookieJar } from './cookie-jar';
import type { FetchLike, HttpResult, Logger } from './types';

/** Base class for runner HTTP security errors (messages carry no secrets). */
export class SmokeHttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SmokeHttpError';
  }
}

export class UnexpectedHostError extends SmokeHttpError {
  constructor() {
    super('unexpected_host', 'Refusing HTTP request to an unexpected host');
    this.name = 'UnexpectedHostError';
  }
}

export class RedirectHostRejectedError extends SmokeHttpError {
  constructor() {
    super('redirect_host_rejected', 'Rejected redirect to a different host');
    this.name = 'RedirectHostRejectedError';
  }
}

/** Enforces the single expected-host binding before any request is sent. */
export function assertAllowedHost(url: URL, expectedHost: string): void {
  if (url.host !== expectedHost) {
    throw new UnexpectedHostError();
  }
}

/** Parses a body best-effort; malformed JSON is surfaced, not thrown. */
function parseJson(text: string): { ok: boolean; value: unknown } {
  if (text.trim() === '') {
    return { ok: true, value: null };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, value: null };
  }
}

/** Reads `Set-Cookie` values across Node and undici implementations. */
function readSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

export interface RequestOptions {
  body?: unknown;
  cookieOverride?: string | null;
  headers?: Record<string, string>;
}

/**
 * HTTP client bound to exactly one expected host.
 *
 * Cookies are captured into the in-memory jar; redirects to any other host are
 * rejected. Nothing is logged beyond caller-provided progress codes.
 */
export class SmokeHttpClient {
  readonly expectedHost: string;
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetchImpl: FetchLike,
    private readonly jar: CookieJar,
    private readonly logger: Logger = () => {},
  ) {
    const parsed = new URL(baseUrl);
    this.baseUrl = baseUrl;
    this.expectedHost = parsed.host;
  }

  get(path: string, options: RequestOptions = {}): Promise<HttpResult> {
    return this.request('GET', path, options);
  }

  post(path: string, options: RequestOptions = {}): Promise<HttpResult> {
    return this.request('POST', path, options);
  }

  patch(path: string, options: RequestOptions = {}): Promise<HttpResult> {
    return this.request('PATCH', path, options);
  }

  put(path: string, options: RequestOptions = {}): Promise<HttpResult> {
    return this.request('PUT', path, options);
  }

  del(path: string, options: RequestOptions = {}): Promise<HttpResult> {
    return this.request('DELETE', path, options);
  }

  async request(method: string, path: string, options: RequestOptions = {}): Promise<HttpResult> {
    const headers = new Headers(options.headers ?? {});
    const cookie = options.cookieOverride !== undefined ? options.cookieOverride : this.jar.header();
    if (cookie) {
      headers.set('cookie', cookie);
    }
    const rawBody = options.body === undefined ? undefined : JSON.stringify(options.body);
    if (rawBody !== undefined) {
      headers.set('content-type', 'application/json');
    }

    let url = new URL(path, this.baseUrl);
    assertAllowedHost(url, this.expectedHost);

    let response: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      response = await this.fetchImpl(url.toString(), {
        method,
        headers,
        body: rawBody,
        redirect: 'manual',
      });
      this.jar.capture(readSetCookies(response));

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          break;
        }
        const next = new URL(location, url);
        if (next.host !== this.expectedHost) {
          this.logger('smoke:http:redirect-rejected');
          throw new RedirectHostRejectedError();
        }
        url = next;
        continue;
      }
      break;
    }

    if (!response) {
      throw new SmokeHttpError('no_response', 'No HTTP response received');
    }

    const text = await response.text();
    const parsed = parseJson(text);
    return {
      status: response.status,
      text,
      body: parsed.value,
      jsonOk: parsed.ok,
      headers: response.headers,
    };
  }
}
