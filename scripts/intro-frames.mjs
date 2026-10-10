// Captures the logo intro at evenly spaced scroll positions (desktop + mobile) for visual review.
// Usage: node scripts/intro-frames.mjs <outDir>
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = process.argv[2] || 'shots/intro';
await mkdir(OUT, { recursive: true });
const ROOT = path.resolve('dist/site');
const T = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  try { res.writeHead(200, { 'content-type': T[path.extname(p)] || 'application/octet-stream' }); res.end(await readFile(path.join(ROOT, p))); } catch { res.writeHead(404); res.end(); }
}).listen(4178);
const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
const errors = [];
for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const page = await (await browser.newContext({ viewport: vp })).newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto('http://localhost:4178/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3200);
  const end = await page.evaluate(() => { const s = document.querySelector('.pin-spacer'); return s ? s.offsetHeight - innerHeight : 0; });
  const steps = [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.72, 0.82, 0.92, 1.0, 1.15];
  for (const f of steps) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(end * f));
    await page.waitForTimeout(1900);
    await page.screenshot({ path: `${OUT}/${name}-${String(Math.round(f * 100)).padStart(3, '0')}.png` });
  }
  console.log(name, 'pin distance', end);
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close(); server.close();
