import { MetaApiError, MetaRateLimitError } from './meta-errors.js';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One retry on timeout/5xx/429 with exponential backoff + jitter. 400 never retries. */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const sleep = options.sleep ?? realSleep;
  const random = options.random ?? Math.random;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const meta = error instanceof MetaApiError ? error : null;
      const retryable = meta ? meta.retryable : false;
      if (!retryable || attempt >= maxAttempts) throw error;
      let delay = baseDelayMs * 2 ** (attempt - 1) + Math.floor(random() * 250);
      if (error instanceof MetaRateLimitError && error.retryAfterMs !== null) {
        delay = Math.max(delay, error.retryAfterMs);
      }
      await sleep(delay);
    }
  }
  throw lastError;
}
