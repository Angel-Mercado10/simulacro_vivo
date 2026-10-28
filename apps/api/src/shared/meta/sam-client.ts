import type { PixelBox } from '@simulacro/contracts';
import { decodeMaskToSVGPath, parseImageStream, recordsOfKind } from '@meta-sam/parser';
import { toMetaError } from './meta-errors.js';
import { withRetry } from './retry-policy.js';

export interface SamMaskResult {
  id: number;
  box: PixelBox;
  maskPath: string | null;
  confidence: number | null;
}

export interface SamClientLike {
  segmentByBoxes(imageDataUrl: string, boxes: Array<{ id: number; box: PixelBox }>, width: number, height: number): Promise<SamMaskResult[]>;
  segmentByConcept(imageDataUrl: string, phrase: string, width: number, height: number): Promise<SamMaskResult[]>;
}

/** SAM 3.1 via Responses API. Box prompts and concept prompts are never mixed. */
export class SamClient implements SamClientLike {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  private async callResponses(promptText: string, imageDataUrl: string): Promise<string> {
    try {
      return await withRetry(async () => {
        const response = await fetch(`${this.baseUrl}/responses`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            stream: true,
            metadata: { include_confidence: 'true', mask_encoding: 'one_bit' },
            input: [{
              role: 'user',
              content: [
                { type: 'input_text', text: promptText },
                { type: 'input_image', image_url: imageDataUrl },
              ],
            }],
          }),
        });
        if (!response.ok) {
          const text = await response.text();
          const error = new Error(`SAM request failed (${response.status}): ${text.slice(0, 500)}`) as Error & { status: number };
          error.status = response.status;
          throw error;
        }
        return response.text();
      });
    } catch (error) {
      throw toMetaError(error);
    }
  }

  async segmentByBoxes(
    imageDataUrl: string,
    boxes: Array<{ id: number; box: PixelBox }>,
    width: number,
    height: number,
  ): Promise<SamMaskResult[]> {
    if (boxes.length === 0) return [];
    if (boxes.length > 16) throw new Error('SAM accepts at most 16 box prompts per request');
    let promptText: string;
    try {
      const parser = (await import('@meta-sam/parser')) as unknown as {
        buildObjectPrompt?: (objects: Array<{ id: number; box: { left: number; top: number; right: number; bottom: number } }>, size: { width: number; height: number }) => string;
      };
      if (typeof parser.buildObjectPrompt === 'function') {
        // PixelBox is inclusive; the builder expects semi-open boxes.
        promptText = parser.buildObjectPrompt(
          boxes.map(({ id, box }) => ({ id, box: { left: box.x1, top: box.y1, right: box.x2 + 1, bottom: box.y2 + 1 } })),
          { width, height },
        );
      } else {
        throw new Error('buildObjectPrompt unavailable');
      }
    } catch {
      promptText = boxes
        .map(({ id, box }) => `<|box;x1=${box.x1};y1=${box.y1};x2=${box.x2};y2=${box.y2};w=${width};h=${height}|>`)
        .map((token, i) => `<0f>${boxes[i]?.id ?? i}${token}`)
        .join('');
    }
    const raw = await this.callResponses(promptText, imageDataUrl);
    return parseSamStream(raw);
  }

  async segmentByConcept(
    imageDataUrl: string,
    phrase: string,
    _width: number,
    _height: number,
  ): Promise<SamMaskResult[]> {
    const raw = await this.callResponses(phrase, imageDataUrl);
    return parseSamStream(raw);
  }
}

/**
 * Rebuild SAM output_text from an SSE stream. Tokens arrive split across
 * `response.output_text.delta` events, so parsing the raw stream text directly
 * breaks box/mask tokens at event boundaries. Plain (non-SSE) text passes through.
 */
export function extractOutputText(raw: string): string {
  if (!raw.includes('response.output_text.delta') && !raw.includes('"output_text"')) return raw;
  let text = '';
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const jsonText = trimmed.slice('data:'.length).trim();
    if (!jsonText.startsWith('{')) continue;
    try {
      const event = JSON.parse(jsonText) as {
        type?: string; delta?: string;
        response?: { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
      };
      if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') text += event.delta;
      if (event.type === 'response.completed' && event.response?.output) {
        for (const item of event.response.output) {
          for (const part of item.content ?? []) {
            if (part.type === 'output_text' && typeof part.text === 'string') text = part.text;
          }
        }
      }
    } catch {
      // Ignore malformed SSE lines; partial text is handled by the caller.
    }
  }
  return text.length > 0 ? text : raw;
}

/**
 * Parse a full SAM SSE stream with the official parser. Box records use
 * semi-open coords (right/bottom exclusive); converted back to inclusive
 * PixelBox. Mask rasters are local to their box bounds, so the SVG path is in
 * box-local coordinates (the frontend translates by the box origin).
 */
export async function parseSamStream(raw: string): Promise<SamMaskResult[]> {
  if (!raw.includes('data:')) return parseSamOutput(raw, []);
  const events: Array<{ type: string }> = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    try {
      events.push(JSON.parse(trimmed.slice('data:'.length).trim()) as { type: string });
    } catch { /* ignore malformed SSE lines */ }
  }
  if (events.length === 0) return parseSamOutput(extractOutputText(raw), []);
  async function* gen(): AsyncGenerator<{ type: string }> { for (const event of events) yield event; }
  const result = await parseImageStream(gen()).finalResult;
  const masksById = new Map<string, string>();
  for (const maskRecord of recordsOfKind(result.records, 'mask')) {
    try { masksById.set(maskRecord.objectId, decodeMaskToSVGPath(maskRecord.mask)); } catch { /* keep null */ }
  }
  const maskOnlyIds = new Set<string>();
  return recordsOfKind(result.records, 'box').map((boxRecord) => {
    const id = Number(boxRecord.objectId);
    return {
      id: Number.isFinite(id) ? id : 0,
      box: {
        x1: boxRecord.left, y1: boxRecord.top,
        x2: Math.max(boxRecord.left, boxRecord.right - 1),
        y2: Math.max(boxRecord.top, boxRecord.bottom - 1),
      },
      maskPath: masksById.get(boxRecord.objectId) ?? null,
      confidence: boxRecord.confidence ?? null,
    };
  }).concat(
    [...masksById.keys()].filter((objectId) => {
      if (maskOnlyIds.has(objectId)) return false;
      maskOnlyIds.add(objectId);
      return !recordsOfKind(result.records, 'box').some((b) => b.objectId === objectId);
    }).map((objectId) => ({
      id: Number(objectId) || 0,
      box: { x1: 0, y1: 0, x2: 0, y2: 0 },
      maskPath: masksById.get(objectId) ?? null,
      confidence: null,
    })),
  );
}

/** Parse SAM output_text tokens, decoding each mask payload to an SVG path. */
export function parseSamOutput(raw: string, _expectedIds: number[]): SamMaskResult[] {
  const results: SamMaskResult[] = [];
  const tokenPattern = /<0f>(\d+)<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)(?:;c=([\d.]+))?\|>|<\|mask;x=\d+;y=\d+(?:;c=([\d.]+))?;data=(\d+),(\d+),([~!])([\s\S]*?)\|>/g;
  let match: RegExpExecArray | null;
  let last: SamMaskResult | null = null;
  while ((match = tokenPattern.exec(raw)) !== null) {
    if (match[1] !== undefined) {
      last = {
        id: Number(match[1]),
        box: { x1: Number(match[2]), y1: Number(match[3]), x2: Number(match[4]), y2: Number(match[5]) },
        maskPath: null,
        confidence: match[8] ? Number(match[8]) : null,
      };
      results.push(last);
      continue;
    }
    // Mask token: belongs to the most recent box result.
    if (last && last.maskPath === null) {
      try {
        last.maskPath = decodeMaskToSVGPath({
          encoding: match[12] === '~' ? 'lossless' : 'one_bit',
          payload: match[13] ?? '',
          width: Number(match[11]),
          height: Number(match[10]),
        });
      } catch {
        last.maskPath = null;
      }
      if (last.confidence === null && match[9]) last.confidence = Number(match[9]);
    }
  }
  return results;
}
