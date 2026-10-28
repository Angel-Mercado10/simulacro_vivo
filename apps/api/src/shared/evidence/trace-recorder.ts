import { randomUUID } from 'node:crypto';
import type { Evidence, EvidenceStep } from '@simulacro/contracts';

export class TraceRecorder {
  readonly traceId: string;
  private readonly startedAt: number;
  private readonly steps: EvidenceStep[] = [];
  modelProposal: unknown = null;
  engineDecisions: Evidence['engineDecisions'] = [];

  constructor(traceId: string = randomUUID()) {
    this.traceId = traceId;
    this.startedAt = Date.now();
  }

  recordStep(step: Omit<EvidenceStep, 'durationMs'> & { durationMs?: number }): void {
    this.steps.push({ durationMs: 0, ...step });
  }

  async measure<T>(step: string, model: string | null, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.steps.push({
        step, durationMs: Date.now() - start, model,
        inputTokens: null, outputTokens: null, reasoningTokens: null,
        samImages: null, estimatedCostUsd: 0, outcome: 'ok', noteEs: null,
      });
      return result;
    } catch (error) {
      this.steps.push({
        step, durationMs: Date.now() - start, model,
        inputTokens: null, outputTokens: null, reasoningTokens: null,
        samImages: null, estimatedCostUsd: 0, outcome: 'error',
        noteEs: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  }

  decide(ruleId: string, outcome: 'accepted' | 'rejected' | 'adjusted', detailEs: string): void {
    this.engineDecisions.push({ ruleId, outcome, detailEs });
  }

  toEvidence(): Evidence {
    const estimatedCostUsd = this.steps.reduce((sum, s) => sum + s.estimatedCostUsd, 0);
    const evidence: Evidence = {
      traceId: this.traceId,
      steps: [...this.steps],
      modelProposal: this.modelProposal,
      engineDecisions: [...this.engineDecisions],
      totalLatencyMs: Date.now() - this.startedAt,
      estimatedCostUsd,
    };
    // One JSON line per request; never images or keys.
    console.log(JSON.stringify({ type: 'trace', ...evidence }));
    return evidence;
  }
}
