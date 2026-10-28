export interface EvidenceStep {
  step: string; durationMs: number; model: string | null;
  inputTokens: number | null; outputTokens: number | null; reasoningTokens: number | null;
  samImages: number | null; estimatedCostUsd: number;
  outcome: 'ok' | 'fallback' | 'error'; noteEs: string | null;
}
export interface EngineDecision { ruleId: string; outcome: 'accepted' | 'rejected' | 'adjusted'; detailEs: string }
export interface Evidence {
  traceId: string;
  steps: EvidenceStep[];
  modelProposal: unknown;
  engineDecisions: EngineDecision[];
  totalLatencyMs: number;
  estimatedCostUsd: number;
}

export type ApiErrorCode =
  | 'IMAGE_UNREADABLE' | 'VALIDATION_FAILED' | 'DEMO_CODE_REQUIRED' | 'BUDGET_EXCEEDED'
  | 'META_ACCESS_DENIED' | 'META_BAD_REQUEST' | 'META_RATE_LIMITED' | 'META_TIMEOUT';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; messageEs: string; retryable: boolean };
}
