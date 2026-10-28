import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseImageStream, recordsOfKind, decodeMaskToSVGPath } from '@meta-sam/parser';

async function main(): Promise<void> {
  const root = new URL('../../apps/api/tests/fixtures/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const raw = readFileSync(join(root, 'sam-sse-raw.txt'), 'utf8');
  const events: Array<{ type: string }> = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    try { events.push(JSON.parse(trimmed.slice('data:'.length).trim()) as { type: string }); } catch { /* ignore */ }
  }
  console.log('events', events.length);
  async function* gen(): AsyncGenerator<{ type: string }> { for (const event of events) yield event; }
  const parsed = parseImageStream(gen());
  const result = await parsed.finalResult;
  console.log('outcome', JSON.stringify(result.outcome), 'records', result.records.map((r) => r.kind).join(','));
  const boxes = recordsOfKind(result.records, 'box');
  const masks = recordsOfKind(result.records, 'mask');
  console.log('boxes', JSON.stringify(boxes));
  if (masks[0]) {
    const path = decodeMaskToSVGPath(masks[0].mask);
    console.log('svg len', String(path).length, 'dims', masks[0].mask.width, masks[0].mask.height, 'bounds', JSON.stringify(masks[0].bounds));
  }
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
