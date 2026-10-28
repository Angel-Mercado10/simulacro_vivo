import type { Hazard, HazardDetection, HazardType } from '@simulacro/contracts';
import { hazardCatalog } from '@simulacro/contracts';
import { clampNormalizedBox, boxIoU, normalizedAreaFraction, toPixelBox } from '../../shared/imaging/geometry.js';

export const MAX_HAZARDS_PER_PHOTO = 12;
export const MIN_AREA_FRACTION = 0.002;

const CONFIDENCE_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

export function normalizeSamPhrase(raw: string, type: HazardType): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[,;]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && word !== 'and')
    .slice(0, 3)
    .join(' ')
    .trim();
  if (cleaned.length > 0) return cleaned;
  return hazardCatalog[type].examplePhrasesEn[0] ?? 'object';
}

/** Spec 8.1: validate Spark detections deterministically (no network). */
export function validateDetectedHazards(
  detection: HazardDetection,
  args: { roomId: string; photoId: string; width: number; height: number },
): { hazards: Hazard[]; imageQuality: HazardDetection['imageQuality'] } {
  if (detection.imageQuality !== 'ok') {
    return { hazards: [], imageQuality: detection.imageQuality };
  }
  const candidates: Hazard[] = [];
  for (const item of detection.hazards) {
    const box = clampNormalizedBox(item.box);
    if (box.xMin >= box.xMax || box.yMin >= box.yMax) continue;
    if (normalizedAreaFraction(box) < MIN_AREA_FRACTION) continue;
    const type = item.type as HazardType;
    candidates.push({
      id: `${args.photoId}-${candidates.length}`,
      roomId: args.roomId,
      photoId: args.photoId,
      type,
      labelEs: item.labelEs.slice(0, 60),
      samPhrase: normalizeSamPhrase(item.samPhrase, type),
      box: toPixelBox(box, args.width, args.height),
      maskPath: null,
      maskSource: 'none',
      flags: {
        heightLevel: item.heightLevel,
        nearRestArea: item.nearRestArea,
        blocksExitPath: item.blocksExitPath,
      },
      modelConfidence: item.confidence,
      samConfidence: null,
      evidenceEs: item.evidenceEs.slice(0, 200),
      status: 'open',
    });
  }

  // Dedupe: same type with IoU > 0.5 keeps the highest confidence.
  const deduped: Hazard[] = [];
  for (const candidate of candidates) {
    const existingIndex = deduped.findIndex(
      (h) => h.type === candidate.type && boxIoU(h.box, candidate.box) > 0.5,
    );
    if (existingIndex === -1) { deduped.push(candidate); continue; }
    const existing = deduped[existingIndex]!;
    if (CONFIDENCE_RANK[candidate.modelConfidence]! > CONFIDENCE_RANK[existing.modelConfidence]!) {
      deduped[existingIndex] = candidate;
    }
  }

  deduped.sort((a, b) => {
    const severity = hazardCatalog[b.type].baseSeverity - hazardCatalog[a.type].baseSeverity;
    if (severity !== 0) return severity;
    return CONFIDENCE_RANK[b.modelConfidence]! - CONFIDENCE_RANK[a.modelConfidence]!;
  });

  return { hazards: deduped.slice(0, MAX_HAZARDS_PER_PHOTO), imageQuality: 'ok' };
}
