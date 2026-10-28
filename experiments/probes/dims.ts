import sharp from 'sharp';

const dir = 'C:/Users/angel/Downloads/nuevas ultimas fotos';
const files = [
  'WhatsApp Image 2026-10-27 at 11.18.34 AM.jpeg',
  'WhatsApp Image 2026-10-27 at 11.18.34 AM (1).jpeg',
  'WhatsApp Image 2026-10-27 at 11.18.35 AM.jpeg',
  'WhatsApp Image 2026-10-27 at 11.18.35 AM (1).jpeg',
];

async function main(): Promise<void> {
  for (const file of files) {
    const meta = await sharp(`${dir}/${file}`).metadata();
    const scale = Math.min(1280 / Math.max(meta.width ?? 0, meta.height ?? 0), 1);
    console.log(`${file.slice(19, 32)} ${meta.width}x${meta.height} -> ${Math.round((meta.width ?? 0) * scale)}x${Math.round((meta.height ?? 0) * scale)}`);
  }
}

main().catch((error: unknown) => { console.error(error); process.exit(1); });
