import sharp from 'sharp';
import { createHash } from 'node:crypto';

export interface NormalizedImage {
  buffer: Buffer;
  dataUrl: string;
  width: number;
  height: number;
  sha256: string;
  byteSize: number;
}

/** Single coordinate base: EXIF-rotate, cap long side at 1280px, JPEG q80, strip metadata. */
export async function normalizeImage(input: Buffer): Promise<NormalizedImage> {
  const pipeline = sharp(input, { failOn: 'error' }).rotate();
  const metadata = await pipeline.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('IMAGE_UNREADABLE');
  }
  const { data, info } = await pipeline
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    dataUrl: `data:image/jpeg;base64,${data.toString('base64')}`,
    width: info.width,
    height: info.height,
    sha256: createHash('sha256').update(data).digest('hex'),
    byteSize: data.byteLength,
  };
}

/** Draw a red rectangle for the fix-verification anchor image. */
export async function drawRedBox(
  image: Buffer,
  box: { x1: number; y1: number; x2: number; y2: number },
): Promise<Buffer> {
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="${box.x1}" y="${box.y1}" width="${Math.max(1, box.x2 - box.x1)}" height="${Math.max(1, box.y2 - box.y1)}" fill="none" stroke="red" stroke-width="6"/></svg>`;
  return sharp(image).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 80 }).toBuffer();
}
