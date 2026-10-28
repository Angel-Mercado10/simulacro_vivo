import type { PixelBox } from '@simulacro/contracts';

export interface NormalizedBox { xMin: number; yMin: number; xMax: number; yMax: number }

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampNormalizedBox(box: NormalizedBox): NormalizedBox {
  return {
    xMin: clamp(Math.round(box.xMin), 0, 1000),
    yMin: clamp(Math.round(box.yMin), 0, 1000),
    xMax: clamp(Math.round(box.xMax), 0, 1000),
    yMax: clamp(Math.round(box.yMax), 0, 1000),
  };
}

/** Convert a 0-1000 normalized box to inclusive pixel coords. */
export function toPixelBox(box: NormalizedBox, width: number, height: number): PixelBox {
  const clamped = clampNormalizedBox(box);
  return {
    x1: clamp(Math.round((clamped.xMin * width) / 1000), 0, Math.max(0, width - 1)),
    y1: clamp(Math.round((clamped.yMin * height) / 1000), 0, Math.max(0, height - 1)),
    x2: clamp(Math.round((clamped.xMax * width) / 1000), 0, Math.max(0, width - 1)),
    y2: clamp(Math.round((clamped.yMax * height) / 1000), 0, Math.max(0, height - 1)),
  };
}

export function clampPixelBox(box: PixelBox, width: number, height: number): PixelBox {
  return {
    x1: clamp(Math.round(box.x1), 0, Math.max(0, width - 1)),
    y1: clamp(Math.round(box.y1), 0, Math.max(0, height - 1)),
    x2: clamp(Math.round(box.x2), 0, Math.max(0, width - 1)),
    y2: clamp(Math.round(box.y2), 0, Math.max(0, height - 1)),
  };
}

export function boxArea(box: PixelBox): number {
  return Math.max(0, box.x2 - box.x1 + 1) * Math.max(0, box.y2 - box.y1 + 1);
}

export function boxIoU(a: PixelBox, b: PixelBox): number {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  if (x2 < x1 || y2 < y1) return 0;
  const intersection = (x2 - x1 + 1) * (y2 - y1 + 1);
  const union = boxArea(a) + boxArea(b) - intersection;
  return union <= 0 ? 0 : intersection / union;
}

export function normalizedAreaFraction(box: NormalizedBox): number {
  const clamped = clampNormalizedBox(box);
  const w = Math.max(0, clamped.xMax - clamped.xMin);
  const h = Math.max(0, clamped.yMax - clamped.yMin);
  return (w * h) / 1_000_000;
}
