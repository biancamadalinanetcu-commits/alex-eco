// Traces the supplied raster logo (brand/5.jpg) into a clean two-colour SVG.
// Each part is isolated as a greyscale intensity map, upscaled smoothly and only
// then thresholded, so the JPEG edge noise does not end up in the outlines.
import sharp from 'sharp';
import potrace from 'potrace';
import { writeFile, mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';

const trace = promisify(potrace.trace);
const SRC = 'brand/5.jpg';
const SCALE = 4;
const SPLIT_Y = 652; // mark sits above, wordmark below

async function intensity(pick, region) {
  const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height, 255);
  for (let y = 0; y < info.height; y++) {
    if (!region(y)) continue;
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 3;
      out[y * info.width + x] = 255 - pick(data[i], data[i + 1], data[i + 2]);
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 1 } })
    .median(3)
    .resize(info.width * SCALE, info.height * SCALE, { kernel: 'cubic' })
    .blur(SCALE * 0.6)
    .threshold(128)
    .png()
    .toBuffer();
}

const blueness = (r, g, b) => Math.max(0, Math.min(255, (b - r) * 1.05));
const lightness = (r, g, b) => Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

const opts = { turdSize: 200, optTolerance: 0.6, alphaMax: 0.9, threshold: 128 };
const round = (d) => d.replace(/-?\d+(?:\.\d+)?/g, (n) => (+n / SCALE).toFixed(1).replace(/\.0$/, ''));
const pathOf = (svg) => round([...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join(' ')).replace(/, /g, ',').replace(/\s+/g, ' ');

const markD = pathOf(await trace(await intensity(blueness, (y) => y < SPLIT_Y), opts));
const wordD = pathOf(await trace(await intensity(lightness, (y) => y >= SPLIT_Y), opts));

await mkdir('src/assets/img', { recursive: true });
// Full lock-up (mark above wordmark), mark only, and horizontal lock-up for the header
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="280 410 695 415"><path fill="#0a6aff" fill-rule="evenodd" d="${markD}"/><path fill="#fff" fill-rule="evenodd" d="${wordD}"/></svg>`;
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="466 410 320 235"><path fill="#0a6aff" fill-rule="evenodd" d="${markD}"/></svg>`;
await writeFile('src/assets/img/logo-stacked.svg', full);
await writeFile('src/assets/img/logo-mark.svg', mark);
console.log('mark', markD.length, 'word', wordD.length);

// Horizontal lock-up (mark left of wordmark) used in the header, as in the brand key visuals.
const horizontal = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-62 630 1036 212"><path fill="#0a6aff" fill-rule="evenodd" transform="translate(-493.2 251.3) scale(.92)" d="${markD}"/><path fill="#fff" fill-rule="evenodd" d="${wordD}"/></svg>`;
await writeFile('src/assets/img/logo-horizontal.svg', horizontal);
