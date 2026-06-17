/**
 * In-memory HttpClient for tests. No real network — every call is recorded
 * and a queued response is returned.
 */

import type { HttpClient, HttpRequestOptions, HttpResponse } from "./client.js";
import { HttpError } from "./client.js";

export interface QueuedResponse {
  status?: number;
  body: string;
  url?: string;
}

export class FakeHttpClient implements HttpClient {
  readonly calls: { url: string; options: HttpRequestOptions | undefined }[] = [];
  private readonly responses: QueuedResponse[] = [];
  /** If set, throw this from get() instead of returning a response. */
  throwWith: Error | null = null;

  enqueue(response: QueuedResponse): this {
    this.responses.push(response);
    return this;
  }

  enqueueError(error: Error): this {
    this.throwWith = error;
    return this;
  }

  async get(url: string, options?: HttpRequestOptions): Promise<HttpResponse> {
    this.calls.push({ url, options });

    if (this.throwWith) {
      throw this.throwWith;
    }

    const queued = this.responses.shift();
    if (!queued) {
      throw new Error(`FakeHttpClient: no queued response for ${url}`);
    }

    const status = queued.status ?? 200;
    if (status < 200 || status >= 300) {
      throw new HttpError(`HTTP ${status} for ${url}`, status, queued.url ?? url);
    }

    return {
      status,
      body: queued.body,
      url: queued.url ?? url,
    };
  }
}
