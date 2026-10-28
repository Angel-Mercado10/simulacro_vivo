/**
 * Phase 0 hazard-detection experiment.
 * Usage:
 *   1. Put 15 photos in experiments/00-hazard-detection/photos/ (gitignored).
 *   2. Copy labels.example.json to labels.json and fill the human labels.
 *   3. Set MODEL_API_KEY and run: corepack pnpm exec tsx experiments/00-hazard-detection/run.ts
 * Without MODEL_API_KEY it runs in dry mode and writes an empty report.
 *
 * Metrics (precision/recall) need human marking in review.html; this script
 * writes detections + review.html + report.json with latency/cost and leaves
 * tp/fp/fn counts to be filled after human review via --score mode.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

interface LabelPhoto { file: string; roomKind: string; hazards: Array<{ type: string; note: string }> }

async function main(): Promise<void> {
  const root = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const photosDir = join(root, 'photos');
  const labelsPath = join(root, 'labels.json');
  const apiKey = process.env.MODEL_API_KEY?.trim();

  if (!existsSync(photosDir)) mkdirSync(photosDir, { recursive: true });
  const photos = readdirSync(photosDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  const labels: LabelPhoto[] = existsSync(labelsPath)
    ? (JSON.parse(readFileSync(labelsPath, 'utf8')) as { photos: LabelPhoto[] }).photos
    : [];

  if (!apiKey) {
    writeFileSync(join(root, 'report.json'), JSON.stringify({
      mode: 'dry', reason: 'MODEL_API_KEY is not configured; no Meta calls were made.',
      photosFound: photos.length, labelsFound: labels.length,
      detections: [], metrics: null, estimatedCostUsd: 0,
    }, null, 2));
    console.log('Dry mode: MODEL_API_KEY missing. Wrote report.json with 0 calls and $0.00.');
    return;
  }

  // Live mode is intentionally thin: it reuses the API clients.
  const { loadConfig } = await import('../../apps/api/src/config.js');
  const { createMetaClient } = await import('../../apps/api/src/shared/meta/meta-client.js');
  const { SparkClient } = await import('../../apps/api/src/shared/meta/spark-client.js');
  const { SamClient } = await import('../../apps/api/src/shared/meta/sam-client.js');
  const { normalizeImage } = await import('../../apps/api/src/shared/imaging/image-normalizer.js');
  const { validateDetectedHazards } = await import('../../apps/api/src/features/scan-room/validator.js');
  const { resolveMasks } = await import('../../apps/api/src/features/scan-room/mask-resolver.js');
  const { hazardDetectionPrompt } = await import('../../apps/api/src/features/scan-room/hazard-detection.prompt.js');
  const { HazardDetectionJsonSchema, HazardDetectionSchema } = await import('../../packages/contracts/src/index.ts');

  const config = loadConfig(process.env);
  const spark = new SparkClient(createMetaClient(config), config.sparkModel);
  const sam = new SamClient(config.modelApiKey!, config.metaBaseUrl, config.samModel);
  const detections: unknown[] = [];
  let totalCostUsd = 0;
  const efforts = ['minimal', 'low', 'medium'] as const;

  for (const effort of efforts) {
    for (const label of labels) {
      const filePath = join(photosDir, label.file);
      if (!existsSync(filePath)) continue;
      const raw = readFileSync(filePath);
      await sharp(raw).metadata();
      const normalized = await normalizeImage(raw);
      const started = Date.now();
      const result = await spark.completeStructured({
        schemaName: 'HazardDetection', jsonSchema: HazardDetectionJsonSchema,
        userText: hazardDetectionPrompt(label.roomKind as never),
        imageDataUrls: [normalized.dataUrl], reasoningEffort: effort,
        parse: (value) => HazardDetectionSchema.parse(value),
      });
      const validated = validateDetectedHazards(result.data, {
        roomId: 'eval', photoId: label.file, width: normalized.width, height: normalized.height,
      });
      const resolved = await resolveMasks(validated.hazards, sam, normalized.dataUrl, normalized.width, normalized.height);
      const latencyMs = Date.now() - started;
      totalCostUsd += 0.02;
      detections.push({ file: label.file, roomKind: label.roomKind, reasoningEffort: effort, latencyMs, hazards: resolved });
    }
  }

  writeFileSync(join(root, 'report.json'), JSON.stringify({
    mode: 'live', photos: labels.length, detections, metrics: null,
    note: 'Mark detections in review.html, then compute precision/recall; do not fabricate metrics.',
    estimatedCostUsd: Number(totalCostUsd.toFixed(4)),
  }, null, 2));
  writeFileSync(join(root, 'review.html'), '<!doctype html><html lang="es"><body><h1>Revisión pendiente</h1><p>Superpone las detecciones de report.json y marca correctas/incorrectas.</p></body></html>');
  console.log(`Live run done. Detections: ${detections.length}. Estimated cost: $${totalCostUsd.toFixed(4)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
