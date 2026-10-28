import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../../apps/api/src/config.js';
import { createMetaClient } from '../../apps/api/src/shared/meta/meta-client.js';
import { SparkClient } from '../../apps/api/src/shared/meta/spark-client.js';
import { normalizeImage, drawRedBox } from '../../apps/api/src/shared/imaging/image-normalizer.js';
import { hazardDetectionPrompt, fixVerificationPrompt } from '../../apps/api/src/features/scan-room/hazard-detection.prompt.js';
import { validateDetectedHazards } from '../../apps/api/src/features/scan-room/validator.js';
import { decideFixStatus } from '../../apps/api/src/features/verify-fix/decide-fix-status.js';
import {
  HazardDetectionJsonSchema, HazardDetectionSchema, FixVerificationJsonSchema, FixVerificationSchema,
  hazardCatalog,
  type HazardType,
} from '../../packages/contracts/src/index.js';
import { sparkCostUsd } from '../../apps/api/src/shared/budget/cost-guard.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  if (!config.modelApiKey) throw new Error('MODEL_API_KEY missing');
  const root = new URL('../../00-hazard-detection/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  void root;
  const dir = 'C:/Users/angel/Downloads/nuevas fotos';
  const before = await normalizeImage(readFileSync(join(dir, 'WhatsApp Image 2026-10-27 at 11.03.08 AM.jpeg')));
  const after = await normalizeImage(readFileSync(join(dir, 'WhatsApp Image 2026-10-27 at 11.03.08 AM (1).jpeg')));
  const spark = new SparkClient(createMetaClient(config), config.sparkModel);
  let cost = 0;

  // Step 1: detect on the BEFORE photo, as the product would.
  const detection = await spark.completeStructured({
    schemaName: 'HazardDetection', jsonSchema: HazardDetectionJsonSchema,
    userText: hazardDetectionPrompt('hallway'),
    imageDataUrls: [before.dataUrl], reasoningEffort: 'low',
    parse: (value) => HazardDetectionSchema.parse(value),
  });
  cost += sparkCostUsd(detection.usage, config.sparkInputPricePer1M, config.sparkOutputPricePer1M);
  const validated = validateDetectedHazards(detection.data, { roomId: 'stairs', photoId: 'frame-before', width: before.width, height: before.height });
  console.log(JSON.stringify({
    step: 'detect-before', imageQuality: detection.data.imageQuality,
    hazards: validated.hazards.map((h) => ({ type: h.type, labelEs: h.labelEs, confidence: h.modelConfidence })),
  }));

  // Step 2: Spark found nothing, so the hazard comes from the human (ground
  // truth): the stone turtle frame on the stairwell wall. Box estimated by the
  // agent on the normalized image; the verdict below says whether it worked.
  const target = {
    id: 'frame-turtle', roomId: 'stairs', photoId: 'frame-before',
    type: 'HEAVY_OBJECT_HIGH' as HazardType,
    labelEs: 'Cuadro de piedra sobre la escalera',
    samPhrase: 'stone picture frame',
    box: { x1: 490, y1: 435, x2: 662, y2: 538 },
  };

  // Step 3: verify with the red-rectangle anchor, then decide.
  const anchored = await drawRedBox(before.buffer, target.box);
  const verification = await spark.completeStructured({
    schemaName: 'FixVerification', jsonSchema: FixVerificationJsonSchema,
    userText: fixVerificationPrompt(target.labelEs),
    imageDataUrls: [`data:image/jpeg;base64,${anchored.toString('base64')}`, after.dataUrl],
    reasoningEffort: 'low',
    parse: (value) => FixVerificationSchema.parse(value),
  });
  cost += sparkCostUsd(verification.usage, config.sparkInputPricePer1M, config.sparkOutputPricePer1M);
  const decision = decideFixStatus(verification.data, hazardCatalog[target.type].verification);
  console.log(JSON.stringify({
    step: 'verify', ok: true,
    targetType: target.type, targetLabel: target.labelEs,
    verdict: verification.data, decision,
    status: decision.kind === 'retake' ? 'open' : decision.status,
    estimatedCostUsd: Number(cost.toFixed(5)),
  }));
}

main().catch((error: unknown) => {
  const status = (error as { status?: number })?.status ?? null;
  console.log(JSON.stringify({ step: 'failed', ok: false, status, message: (error instanceof Error ? error.message : 'unknown').slice(0, 400) }));
  process.exit(1);
});
