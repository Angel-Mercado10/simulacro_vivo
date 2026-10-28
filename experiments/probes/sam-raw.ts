import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../../apps/api/src/config.js';
import { normalizeImage } from '../../apps/api/src/shared/imaging/image-normalizer.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  if (!config.modelApiKey) throw new Error('MODEL_API_KEY missing');
  const root = new URL('../00-hazard-detection/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const photosDir = join(root, 'photos');
  const first = readdirSync(photosDir).filter((f) => f.endsWith('.jpeg')).sort()[0];
  if (!first) throw new Error('no photos');
  const normalized = await normalizeImage(readFileSync(join(photosDir, first)));
  const w = normalized.width;
  const h = normalized.height;
  const prompt = `<0f>0<|box;x1=${Math.round(w * 0.3)};y1=${Math.round(h * 0.3)};x2=${Math.round(w * 0.7)};y2=${Math.round(h * 0.7)};w=${w};h=${h}|>`;
  const response = await fetch(`${config.metaBaseUrl}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.modelApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.samModel, stream: true,
      metadata: { include_confidence: 'true', mask_encoding: 'one_bit' },
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: normalized.dataUrl }] }],
    }),
  });
  const raw = await response.text();
  console.log(JSON.stringify({ status: response.status, bytes: raw.length, hasMaskToken: raw.includes('<|mask'), hasBoxToken: raw.includes('<|box') }));
  const at = raw.indexOf('<|mask');
  console.log(at >= 0 ? raw.slice(Math.max(0, at - 200), at + 300) : 'no mask token context');
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(join(root, '../../apps/api/tests/fixtures'), { recursive: true });
  writeFileSync(join(root, '../../apps/api/tests/fixtures/sam-sse-raw.txt'), raw);
  console.log('fixture written: apps/api/tests/fixtures/sam-sse-raw.txt');
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
