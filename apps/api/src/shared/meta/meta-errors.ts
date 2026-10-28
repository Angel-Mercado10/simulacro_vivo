export class MetaApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  constructor(message: string, status: number, code: string, retryable: boolean) {
    super(message);
    this.name = 'MetaApiError';
    this.status = status; this.code = code; this.retryable = retryable;
  }
}

export class MetaAccessError extends MetaApiError {
  constructor(message = 'Meta model not found for this team (model_not_found).') {
    super(message, 404, 'model_not_found', false);
    this.name = 'MetaAccessError';
  }
}

export class MetaRateLimitError extends MetaApiError {
  readonly retryAfterMs: number | null;
  constructor(message = 'Meta rate limit exceeded.', retryAfterMs: number | null = null) {
    super(message, 429, 'rate_limited', true);
    this.name = 'MetaRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export function toMetaError(error: unknown): MetaApiError {
  if (error instanceof MetaApiError) return error;
  const anyErr = error as { status?: number; code?: string; message?: string };
  const status = typeof anyErr?.status === 'number' ? anyErr.status : 0;
  const message = anyErr?.message ?? 'Unknown Meta API error';
  if (status === 404) return new MetaAccessError(message);
  if (status === 429) return new MetaRateLimitError(message);
  if (status === 400) return new MetaApiError(message, 400, 'bad_request', false);
  if (status >= 500 || status === 0) return new MetaApiError(message, status || 502, 'upstream_error', true);
  return new MetaApiError(message, status, 'meta_error', false);
}
