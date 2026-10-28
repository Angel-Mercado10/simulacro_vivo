import type { Hazard } from '@simulacro/contracts';
import { boxIoU } from '../../shared/imaging/geometry.js';
import type { SamClientLike } from '../../shared/meta/sam-client.js';

export const MAX_CONCEPT_FALLBACKS = 3;
export const MIN_MASK_IOU = 0.3;

/** Spec 8.2: one SAM box request per photo, concept fallback per hazard (max 3). */
export async function resolveMasks(
  hazards: Hazard[],
  sam: SamClientLike,
  imageDataUrl: string,
  width: number,
  height: number,
): Promise<Hazard[]> {
  if (hazards.length === 0) return hazards;
  const byBoxes = await sam.segmentByBoxes(
    imageDataUrl,
    hazards.map((h, index) => ({ id: index, box: h.box })),
    width,
    height,
  );
  const byId = new Map(byBoxes.map((r) => [r.id, r]));
  const resolved: Hazard[] = hazards.map((hazard, index) => {
    const hit = byId.get(index);
    if (hit && boxIoU(hit.box, hazard.box) > MIN_MASK_IOU) {
      return { ...hazard, maskSource: 'sam_box' as const, maskPath: hit.maskPath, samConfidence: hit.confidence };
    }
    return hazard;
  });

  // Concept fallbacks run concurrently (bounded); serial calls dominated latency.
  const fallbackIndexes = resolved
    .map((hazard, index) => (hazard.maskSource === 'none' ? index : -1))
    .filter((index) => index >= 0)
    .slice(0, MAX_CONCEPT_FALLBACKS);
  await Promise.all(fallbackIndexes.map(async (i) => {
    const hazard = resolved[i]!;
    const concepts = await sam.segmentByConcept(imageDataUrl, hazard.samPhrase, width, height);
    let best: (typeof concepts)[number] | null = null;
    let bestIoU = 0;
    for (const concept of concepts) {
      const iou = boxIoU(concept.box, hazard.box);
      if (iou > bestIoU) { bestIoU = iou; best = concept; }
    }
    if (best && bestIoU > MIN_MASK_IOU) {
      resolved[i] = { ...hazard, maskSource: 'sam_concept', maskPath: best.maskPath, samConfidence: best.confidence };
    }
  }));
  return resolved;
}
