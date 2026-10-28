import sharp from 'sharp';
import { loadConfig } from '../../apps/api/src/config.js';
import { createMetaClient } from '../../apps/api/src/shared/meta/meta-client.js';
import { SparkClient } from '../../apps/api/src/shared/meta/spark-client.js';
import { SamClient } from '../../apps/api/src/shared/meta/sam-client.js';
import { normalizeImage } from '../../apps/api/src/shared/imaging/image-normalizer.js';
import { hazardDetectionPrompt } from '../../apps/api/src/features/scan-room/hazard-detection.prompt.js';
import { HazardDetectionJsonSchema, HazardDetectionSchema } from '@simulacro/contracts';
import { sparkCostUsd } from '../../apps/api/src/shared/budget/cost-guard.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  if (!config.modelApiKey) throw new Error('MODEL_API_KEY missing');

  // Synthetic probe image (not a real room): proves request/response contracts only.
  const synthetic = await sharp({
    create: { width: 1280, height: 960, channels: 3, background: { r: 180, g: 170, b: 160 } },
  }).jpeg().toBuffer();
  const normalized = await normalizeImage(synthetic);

  const spark = new SparkClient(createMetaClient(config), config.sparkModel);
  const started = Date.now();
  const sparkResult = await spark.completeStructured({
    schemaName: 'HazardDetection',
    jsonSchema: HazardDetectionJsonSchema,
    userText: hazardDetectionPrompt('bedroom'),
    imageDataUrls: [normalized.dataUrl],
    reasoningEffort: 'low',
    parse: (value) => HazardDetectionSchema.parse(value),
  });
  const sparkMs = Date.now() - started;
  const sparkCost = sparkCostUsd(sparkResult.usage, config.sparkInputPricePer1M, config.sparkOutputPricePer1M);
  console.log(JSON.stringify({
    probe: 'spark', ok: true, latencyMs: sparkMs,
    imageQuality: sparkResult.data.imageQuality, hazards: sparkResult.data.hazards.length,
    usage: sparkResult.usage, estimatedCostUsd: Number(sparkCost.toFixed(5)),
  }));

  const sam = new SamClient(config.modelApiKey, config.metaBaseUrl, config.samModel);
  const samStarted = Date.now();
  const concepts = await sam.segmentByConcept(normalized.dataUrl, 'bookshelf', normalized.width, normalized.height);
  const samMs = Date.now() - samStarted;
  console.log(JSON.stringify({
    probe: 'sam-concept', ok: true, latencyMs: samMs, results: concepts.length,
    estimatedCostUsd: config.samPricePerImage,
    note: 'Empty results are a normal outcome on a synthetic image.',
  }));
}

main().catch((error: unknown) => {
  const status = (error as { status?: number })?.status ?? null;
  const message = error instanceof Error ? error.message : 'unknown error';
  console.log(JSON.stringify({ probe: 'failed', ok: false, status, message: message.slice(0, 400) }));
  process.exit(1);
});
