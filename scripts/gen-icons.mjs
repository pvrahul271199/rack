// Generates PWA icons into public/icons. Run: npm run icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

// A geometric "R" drawn as one stroke, white on ink.
const glyph = `<path d="M36 76 V24 H54 C66 24 72 31 72 40 C72 49 66 56 54 56 H36 M54 56 L72 76" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="square" stroke-linejoin="miter"/>`;

function svg({ rounded, inset }) {
  const bg = rounded ? `<rect width="100" height="100" rx="12" fill="#0A0A0A"/>` : `<rect width="100" height="100" fill="#0A0A0A"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg}<g transform="translate(50 50) scale(${inset}) translate(-50 -50)">${glyph}</g></svg>`;
}

mkdirSync('public/icons', { recursive: true });
const jobs = [
  ['icon-192.png', 192, { rounded: true, inset: 1 }],
  ['icon-512.png', 512, { rounded: true, inset: 1 }],
  ['icon-maskable-512.png', 512, { rounded: false, inset: 0.72 }],
  ['apple-touch-icon.png', 180, { rounded: false, inset: 0.9 }],
];
for (const [name, size, opts] of jobs) {
  await sharp(Buffer.from(svg(opts)), { density: 384 }).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log('wrote', name);
}
