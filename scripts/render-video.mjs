// Renders the closing 3D clip (scripts/video/scene.html) frame by frame in headless Chromium and
// encodes it with ffmpeg into src/assets/video/: WebM (VP9) + MP4 (H.264) at two sizes, plus a poster.
//   node scripts/render-video.mjs            full render
//   node scripts/render-video.mjs --preview  a few stills into /tmp for a quick look
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const FPS = 30;
const SECONDS = 8;
const SIZES = [{ name: 'cta-arrow', w: 1600, h: 700 }, { name: 'cta-arrow-sm', w: 960, h: 560 }];
const preview = process.argv.includes('--preview');
const OUT = 'src/assets/video';
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

await mkdir(OUT, { recursive: true });
for (const size of preview ? SIZES.slice(0, 1) : SIZES) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h } });
  page.on('pageerror', (e) => console.error('scene error:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('scene console:', m.text()); });
  await page.goto(`http://localhost:4190/scripts/video/scene.html?w=${size.w}&h=${size.h}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const canvas = page.locator('canvas');

  if (preview) {
    const dir = process.argv[process.argv.indexOf('--preview') + 1] || os.tmpdir();
    for (const t of [0, 0.25, 0.5, 0.75]) {
      await page.evaluate((v) => window.renderFrame(v), t);
      await canvas.screenshot({ path: `${dir}/preview-${t}.png` });
    }
    console.log('preview stills in', dir);
    continue;
  }

  const frames = path.join(os.tmpdir(), `scalium-frames-${size.name}`);
  await rm(frames, { recursive: true, force: true });
  await mkdir(frames, { recursive: true });
  const total = FPS * SECONDS;
  for (let i = 0; i < total; i++) {
    await page.evaluate((v) => window.renderFrame(v), i / total);
    await canvas.screenshot({ path: `${frames}/f${String(i).padStart(4, '0')}.png` });
    if (i % 30 === 0) console.log(`${size.name}: frame ${i}/${total}`);
  }
  const input = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${frames}/f%04d.png`];
  execFileSync('ffmpeg', [...input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-deadline', 'good', '-pix_fmt', 'yuv420p', '-an', `${OUT}/${size.name}.webm`]);
  execFileSync('ffmpeg', [...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', `${OUT}/${size.name}.mp4`]);
  await sharp(`${frames}/f0000.png`).webp({ quality: 72 }).toFile(`${OUT}/${size.name}-poster.webp`);
  await page.close();
}
await browser.close();
server.close();
