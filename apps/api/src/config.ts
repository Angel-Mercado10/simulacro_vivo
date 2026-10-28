export interface AppConfig {
  modelApiKey: string | null;
  metaBaseUrl: string;
  sparkModel: string;
  samModel: string;
  voiceModel: string;
  sessionBudgetUsd: number;
  dailyBudgetUsd: number;
  demoAccessCode: string | null;
  port: number;
  sparkInputPricePer1M: number;
  sparkOutputPricePer1M: number;
  samPricePerImage: number;
  voicePricePerHour: number;
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const sparkModel = env.SPARK_MODEL ?? 'muse-spark-1.3';
  const samModel = env.SAM_MODEL ?? 'sam-3.1';
  const voiceModel = env.VOICE_MODEL ?? 'muse-voice-transcribe-1.0';
  for (const [name, id] of [['SPARK_MODEL', sparkModel], ['SAM_MODEL', samModel], ['VOICE_MODEL', voiceModel]] as const) {
    if (id.endsWith('-contributor')) {
      throw new Error(`${name} must not use a -contributor model id (Standard mode only).`);
    }
  }
  return {
    modelApiKey: env.MODEL_API_KEY?.trim() ? env.MODEL_API_KEY.trim() : null,
    metaBaseUrl: env.META_BASE_URL ?? 'https://api.meta.ai/v1',
    sparkModel, samModel, voiceModel,
    sessionBudgetUsd: num(env.SESSION_BUDGET_USD, 0.5),
    dailyBudgetUsd: num(env.DAILY_BUDGET_USD, 5),
    demoAccessCode: env.DEMO_ACCESS_CODE?.trim() ? env.DEMO_ACCESS_CODE.trim() : null,
    port: num(env.PORT, 3000) || 3000,
    sparkInputPricePer1M: 1.25,
    sparkOutputPricePer1M: 4.25,
    samPricePerImage: 0.0025,
    voicePricePerHour: 0.18,
  };
}
