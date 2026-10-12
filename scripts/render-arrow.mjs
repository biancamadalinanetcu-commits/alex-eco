// Renders the closing 3D arrow (scripts/video/scene.html, three.js) in headless Chromium as a
// sequence of stills at different angles. On the site, scrolling picks the frame, so the arrow
// turns to face the visitor as the closing section comes into view (like Apple's product pages).
//   node scripts/render-arrow.mjs            writes src/assets/arrow/{d,m}/00.webp ... and still.webp
//   node scripts/render-arrow.mjs --preview <dir>   a few stills for a quick look
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const FRAMES = 60;
const SIZES = [{ dir: 'd', w: 1600, h: 700 }, { dir: 'm', w: 960, h: 560 }];
const preview = process.argv.includes('--preview');
const OUT = 'src/assets/arrow';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let body;
  try { body = await readFile(path.join(process.cwd(), p)); } catch { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  res.end(body);
}).listen(4190);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
}).catch(() => chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }));

if (!preview) await rm(OUT, { recursive: true, force: true });
for (const size of preview ? SIZES.slice(0, 1) : SIZES) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h } });
  page.on('pageerror', (e) => console.error('scene error:', e.message));
  await page.goto(`http://localhost:4190/scripts/video/scene.html?w=${size.w}&h=${size.h}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const canvas = page.locator('canvas');
  const shot = async (p) => { await page.evaluate((v) => window.renderTurn(v), p); return canvas.screenshot(); };

  if (preview) {
    const dir = process.argv[process.argv.indexOf('--preview') + 1];
    for (const p of [0, 0.35, 0.7, 1]) await sharp(await shot(p)).png().toFile(`${dir}/turn-${p}.png`);
    console.log('preview stills in', dir);
    continue;
  }
  await mkdir(`${OUT}/${size.dir}`, { recursive: true });
  for (let i = 0; i < FRAMES; i++) {
    const png = await shot(i / (FRAMES - 1));
    await sharp(png).webp({ quality: 68, effort: 6 }).toFile(`${OUT}/${size.dir}/${String(i).padStart(2, '0')}.webp`);
    if (i === FRAMES - 1) await sharp(png).webp({ quality: 80, effort: 6 }).toFile(`${OUT}/${size.dir}/still.webp`);
    if (i % 15 === 0) console.log(`${size.dir}: frame ${i}/${FRAMES}`);
  }
  await page.close();
}
await browser.close();
server.close();
