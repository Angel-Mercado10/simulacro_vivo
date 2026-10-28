import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../../apps/api/src/config.js';
import { createMetaClient } from '../../apps/api/src/shared/meta/meta-client.js';
import { SparkClient } from '../../apps/api/src/shared/meta/spark-client.js';
import { normalizeImage, drawRedBox } from '../../apps/api/src/shared/imaging/image-normalizer.js';
import { fixVerificationPrompt } from '../../apps/api/src/features/scan-room/hazard-detection.prompt.js';
import { decideFixStatus } from '../../apps/api/src/features/verify-fix/decide-fix-status.js';
import { FixVerificationJsonSchema, FixVerificationSchema } from '../../packages/contracts/src/index.js';
import { sparkCostUsd } from '../../apps/api/src/shared/budget/cost-guard.js';

interface Pair {
  name: string;
  before: string; after: string;
  labelEs: string;
  box: { x1: number; y1: number; x2: number; y2: number };
}

const dir = 'C:/Users/angel/Downloads/nuevas ultimas fotos';
const pairs: Pair[] = [
  {
    name: 'sillon-movido',
    before: 'WhatsApp Image 2026-10-27 at 11.18.34 AM.jpeg',
    after: 'WhatsApp Image 2026-10-27 at 11.18.34 AM (1).jpeg',
    labelEs: 'Sillón junto a la ventana',
    box: { x1: 0, y1: 500, x2: 300, y2: 1279 },
  },
  {
    name: 'silla-movida',
    before: 'WhatsApp Image 2026-10-27 at 11.18.35 AM.jpeg',
    after: 'WhatsApp Image 2026-10-27 at 11.18.35 AM (1).jpeg',
    labelEs: 'Silla de plástico junto a la cama',
    box: { x1: 134, y1: 461, x2: 326, y2: 768 },
  },
];

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  if (!config.modelApiKey) throw new Error('MODEL_API_KEY missing');
  const spark = new SparkClient(createMetaClient(config), config.sparkModel);
  let cost = 0;
  let correct = 0;
  for (const pair of pairs) {
    const before = await normalizeImage(readFileSync(join(dir, pair.before)));
    const after = await normalizeImage(readFileSync(join(dir, pair.after)));
    const anchored = await drawRedBox(before.buffer, pair.box);
    const result = await spark.completeStructured({
      schemaName: 'FixVerification', jsonSchema: FixVerificationJsonSchema,
      userText: fixVerificationPrompt(pair.labelEs),
      imageDataUrls: [`data:image/jpeg;base64,${anchored.toString('base64')}`, after.dataUrl],
      reasoningEffort: 'low',
      parse: (value) => FixVerificationSchema.parse(value),
    });
    cost += sparkCostUsd(result.usage, config.sparkInputPricePer1M, config.sparkOutputPricePer1M);
    // Human ground truth: both objects were relocated, so the correct verdict
    // is sameScene=true with stillPresent=false at the anchored spot.
    const decision = decideFixStatus(result.data, 'relocation');
    const verdictCorrect = result.data.sameSceneLikely && !result.data.stillPresent;
    if (verdictCorrect) correct += 1;
    console.log(JSON.stringify({
      pair: pair.name, verdict: result.data, decision,
      status: decision.kind === 'retake' ? 'open' : decision.status,
      verdictCorrect,
    }));
  }
  console.log(JSON.stringify({ pairs: pairs.length, correct, estimatedCostUsd: Number(cost.toFixed(5)) }));
}

main().catch((error: unknown) => {
  const status = (error as { status?: number })?.status ?? null;
  console.log(JSON.stringify({ ok: false, status, message: (error instanceof Error ? error.message : 'unknown').slice(0, 400) }));
  process.exit(1);
});
