/**
 * Tiny HTTP client interface so scrapers can be tested without real network.
 *
 * The default implementation uses Node 22's built-in fetch. Tests pass a fake.
 */

export interface HttpClient {
  /** GET a URL and return the response body as text. Throws on non-2xx. */
  get(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
}

export interface HttpRequestOptions {
  /** Custom headers (e.g. User-Agent). */
  headers?: Record<string, string>;
  /** Timeout in ms. Defaults to 10s. */
  timeoutMs?: number;
}

export interface HttpResponse {
  readonly status: number;
  readonly body: string;
  readonly url: string;
}

/**
 * Default HTTP client using global fetch. Adds a sensible User-Agent
 * (FairPrice's bot detection is happy with a real browser UA).
 */
export class FetchHttpClient implements HttpClient {
  private readonly defaultHeaders: Record<string, string>;
  private readonly defaultTimeoutMs: number;

  constructor(options: FetchHttpClientOptions = {}) {
    this.defaultHeaders = options.defaultHeaders ?? DEFAULT_HEADERS;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 10_000;
  }

  async get(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const headers = { ...this.defaultHeaders, ...(options.headers ?? {}) };
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
        redirect: "follow",
      });

      if (!response.ok) {
        throw new HttpError(
          `HTTP ${response.status} ${response.statusText} for ${url}`,
          response.status,
          url,
        );
      }

      const body = await response.text();
      return { status: response.status, body, url: response.url };
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface FetchHttpClientOptions {
  defaultHeaders?: Record<string, string>;
  defaultTimeoutMs?: number;
}

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-SG,en;q=0.9",
};

/** Error thrown by HttpClient on non-2xx responses. */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
