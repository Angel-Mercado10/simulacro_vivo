export interface CostGuardOptions {
  sessionBudgetUsd: number;
  dailyBudgetUsd: number;
  sparkInputPricePer1M: number;
  sparkOutputPricePer1M: number;
  samPricePerImage: number;
  voicePricePerHour: number;
}

export class BudgetExceededError extends Error {
  constructor(message = 'Budget exceeded') {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export function sparkCostUsd(
  usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined,
  inputPricePer1M: number,
  outputPricePer1M: number,
): number {
  if (!usage) return 0;
  const input = ((usage.prompt_tokens ?? 0) / 1_000_000) * inputPricePer1M;
  const output = ((usage.completion_tokens ?? 0) / 1_000_000) * outputPricePer1M;
  return input + output;
}

/** In-memory budgets (reset on restart; acceptable for demo, declared in README). */
export class CostGuard {
  private readonly sessionSpend = new Map<string, number>();
  private dailySpend = 0;
  private dailyKey = new Date().toISOString().slice(0, 10);
  constructor(private readonly options: CostGuardOptions) {}

  private rollDay(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.dailyKey) { this.dailyKey = today; this.dailySpend = 0; }
  }

  assertCanSpend(sessionId: string, estimatedUsd: number): void {
    this.rollDay();
    const sessionTotal = (this.sessionSpend.get(sessionId) ?? 0) + estimatedUsd;
    if (sessionTotal > this.options.sessionBudgetUsd) {
      throw new BudgetExceededError(`Session budget exceeded: $${sessionTotal.toFixed(4)} > $${this.options.sessionBudgetUsd}`);
    }
    if (this.dailySpend + estimatedUsd > this.options.dailyBudgetUsd) {
      throw new BudgetExceededError(`Daily budget exceeded: $${(this.dailySpend + estimatedUsd).toFixed(4)} > $${this.options.dailyBudgetUsd}`);
    }
  }

  recordSpend(sessionId: string, actualUsd: number): void {
    this.rollDay();
    this.sessionSpend.set(sessionId, (this.sessionSpend.get(sessionId) ?? 0) + actualUsd);
    this.dailySpend += actualUsd;
  }

  sessionSpendUsd(sessionId: string): number { return this.sessionSpend.get(sessionId) ?? 0; }
  dailySpendUsd(): number { this.rollDay(); return this.dailySpend; }
}
