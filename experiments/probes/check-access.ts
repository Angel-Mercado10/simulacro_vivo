import { loadConfig } from '../../apps/api/src/config.js';
import { listModels } from '../../apps/api/src/shared/meta/meta-client.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  if (!config.modelApiKey) {
    console.log(JSON.stringify({ ok: false, reason: 'MODEL_API_KEY missing' }));
    return;
  }
  try {
    const models = await listModels(config);
    console.log(JSON.stringify({
      ok: true,
      totalModels: models.length,
      hasSpark: models.includes(config.sparkModel),
      hasSam: models.includes(config.samModel),
      hasVoice: models.includes(config.voiceModel),
      sparkModel: config.sparkModel,
      samModel: config.samModel,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = (error as { status?: number })?.status ?? null;
    console.log(JSON.stringify({ ok: false, status, message: message.slice(0, 300) }));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
