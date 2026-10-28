import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Hazard } from '@simulacro/contracts';
import { extractOutputText, parseSamOutput, parseSamStream } from '../../src/shared/meta/sam-client.js';
import { resolveMasks } from '../../src/features/scan-room/mask-resolver.js';

function makeHazard(partial: Partial<Hazard>): Hazard {
  return {
    id: 'h1', roomId: 'r1', photoId: 'p1', type: 'TALL_FURNITURE_UNANCHORED',
    labelEs: 'Librero', samPhrase: 'bookshelf',
    box: { x1: 100, y1: 100, x2: 300, y2: 400 }, maskPath: null, maskSource: 'none',
    flags: { heightLevel: 'high', nearRestArea: false, blocksExitPath: false },
    modelConfidence: 'high', samConfidence: null, evidenceEs: 'ok', status: 'open',
    ...partial,
  };
}

describe('extractOutputText', () => {
  it('rebuilds output_text from SSE deltas split across events', () => {
    const sse = [
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":"<0f>0<|box;x1=1"}',
      '',
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":";y1=2|><|mask;x=0;y=0;data=2,2,!aa|>"}',
      '',
    ].join('\n');
    expect(extractOutputText(sse)).toContain('<0f>0<|box;x1=1;y1=2|>');
  });
});

describe('parseSamStream', () => {
  it('extracts box, confidence and a decoded SVG mask path from a real captured response', async () => {
    const fixturePath = join(process.cwd(), 'tests/fixtures/sam-sse-raw.txt');
    const raw = readFileSync(fixturePath, 'utf8');
    const results = await parseSamStream(raw);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]?.box.x1).toBe(310);
    expect(results[0]?.box.x2).toBe(672);
    expect(typeof results[0]?.maskPath).toBe('string');
    expect((results[0]?.maskPath ?? '').length).toBeGreaterThan(0);
  });

  it('returns empty results for an empty SAM output (normal outcome)', () => {
    expect(parseSamOutput('', [])).toEqual([]);
  });
});

describe('resolveMasks fallbacks', () => {
  it('runs concept fallbacks concurrently, not one after another', async () => {
    const hazards = [
      makeHazard({ id: 'a' }),
      makeHazard({ id: 'b', box: { x1: 500, y1: 100, x2: 700, y2: 300 } }),
      makeHazard({ id: 'c', box: { x1: 800, y1: 500, x2: 1000, y2: 800 } }),
    ];
    let active = 0;
    let maxActive = 0;
    const fakeSam = {
      segmentByBoxes: async () => [],
      segmentByConcept: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
        return [];
      },
    };
    await resolveMasks(hazards, fakeSam, 'data:image/jpeg;base64,x', 1280, 960);
    expect(maxActive).toBeGreaterThanOrEqual(2);
  });
});
