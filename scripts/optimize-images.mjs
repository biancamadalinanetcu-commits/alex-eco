// Generates every raster asset the site uses from the original brand files in /brand:
// responsive AVIF + WebP crops, social preview image, favicons and the WP theme screenshot.
import sharp from 'sharp';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { crops } from './crops.mjs';

const OUT = 'src/assets/img';
await mkdir(OUT, { recursive: true });

// Upscaling beyond the source adds bytes without detail, so cap each width at 2x source.
const report = [];
for (const c of crops) {
  const base = sharp(c.src).extract({ left: c.left, top: c.top, width: c.width, height: c.height });
  for (const w of c.widths) {
    const width = Math.min(w, c.width * 2);
    const pipeline = base.clone().resize({ width, kernel: 'lanczos3' }).sharpen({ sigma: 0.5 });
    const avif = `${OUT}/${c.name}-${w}.avif`;
    const webp = `${OUT}/${c.name}-${w}.webp`;
    await pipeline.clone().avif({ quality: 52, effort: 6, chromaSubsampling: '4:2:0' }).toFile(avif);
    await pipeline.clone().webp({ quality: 74, effort: 6, smartSubsample: true }).toFile(webp);
    report.push([c.name, w, (await stat(avif)).size, (await stat(webp)).size]);
  }
}

// Social preview (Open Graph / Twitter): the full hero key visual.
await sharp('brand/1.webp').resize(1200, 630, { fit: 'cover', position: 'center' }).jpeg({ quality: 78, mozjpeg: true }).toFile(`${OUT}/og-image.jpg`);

// Favicons from the traced vector mark.
const markSvg = await sharp('src/assets/img/logo-mark.svg', { density: 600 });
const square = (size) => markSvg.clone().resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
await square(180).flatten({ background: '#020305' }).extend({ top: 0, bottom: 0, left: 0, right: 0 }).png().toFile(`${OUT}/apple-touch-icon.png`);
await square(32).png().toFile(`${OUT}/favicon-32.png`);

// WordPress theme screenshot (1200x900 is the size WP expects).
await sharp('brand/1.webp').resize(1200, 900, { fit: 'cover', position: 'right' }).png({ compressionLevel: 9, palette: true, quality: 80 }).toFile('wordpress/screenshot.png');

console.table(report.map(([n, w, a, wb]) => ({ image: n, width: w, avifKB: (a / 1024).toFixed(1), webpKB: (wb / 1024).toFixed(1) })));
