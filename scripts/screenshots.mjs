// Visual QA: serves dist/site and captures each section at desktop and mobile sizes,
// in both languages. Usage: node scripts/screenshots.mjs <outDir> [en|ro]
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = process.argv[2] || 'shots';
await mkdir(OUT, { recursive: true });
const LANGS = (process.argv[3] || 'en,ro').split(',');
const ROOT = path.resolve('dist/site');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const body = await readFile(path.join(ROOT, p));
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('404'); }
}).listen(4173);

const launch = async () => {
  try { return await chromium.launch(); } catch { return chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
};
const browser = await launch();
const errors = [];

async function shoot(name, viewport, lang, fn) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await fn(page, lang);
  await ctx.close();
}

const scrollTo = async (page, sel, offset = 0) => {
  await page.evaluate(([s, o]) => {
    const el = s === 'top' ? null : document.querySelector(s);
    const y = el ? el.getBoundingClientRect().top + window.scrollY + o : o;
    window.scrollTo(0, y);
  }, [sel, offset]);
  await page.waitForTimeout(1600);
};

for (const lang of LANGS) {
  await shoot(`desktop-${lang}`, { width: 1440, height: 900 }, lang, async (page) => {
    await page.goto(`http://localhost:4173/index.html?lang=${lang}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${OUT}/d-${lang}-1-hero.png` });
    await scrollTo(page, '.statement', -40);
    await scrollTo(page, '.statement', 200);
    await page.screenshot({ path: `${OUT}/d-${lang}-2-statement.png` });
    await scrollTo(page, '#services', 0);
    await page.screenshot({ path: `${OUT}/d-${lang}-3-services-head.png` });
    await scrollTo(page, '[data-service="0"]', -80);
    await page.screenshot({ path: `${OUT}/d-${lang}-4-service1.png` });
    await scrollTo(page, '[data-service="2"]', -60);
    await page.screenshot({ path: `${OUT}/d-${lang}-5-service3.png` });
    await scrollTo(page, '#process', 0);
    await page.screenshot({ path: `${OUT}/d-${lang}-6-process-a.png` });
    const pinLen = await page.evaluate(() => { const st = document.querySelector('.process .pin-spacer'); return st ? st.offsetHeight - innerHeight : 0; });
    await scrollTo(page, '#process', pinLen * 0.55);
    await page.screenshot({ path: `${OUT}/d-${lang}-7-process-b.png` });
    await scrollTo(page, '#process', pinLen * 0.98);
    await page.screenshot({ path: `${OUT}/d-${lang}-8-process-c.png` });
    await scrollTo(page, '#results', 0);
    await page.screenshot({ path: `${OUT}/d-${lang}-9-results-a.png` });
    await scrollTo(page, '.stats', -500);
    await page.screenshot({ path: `${OUT}/d-${lang}-10-results-b.png` });
    await scrollTo(page, '#contact-cta', 80);
    await page.screenshot({ path: `${OUT}/d-${lang}-11-cta.png` });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/d-${lang}-12-footer.png` });
    await page.goto(`http://localhost:4173/contact.html?lang=${lang}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/d-${lang}-13-contact.png` });
  });

  await shoot(`mobile-${lang}`, { width: 390, height: 844 }, lang, async (page) => {
    await page.goto(`http://localhost:4173/index.html?lang=${lang}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${OUT}/m-${lang}-1-hero.png` });
    await page.click('[data-menu-toggle]');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/m-${lang}-2-menu.png` });
    await page.click('[data-menu-toggle]');
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const full = await page.evaluate(() => document.documentElement.scrollHeight);
    // Walk down to trigger reveals before the full-page capture
    for (let y = 0; y < full; y += 600) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(250); }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/m-${lang}-3-full.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) errors.push(`mobile-${lang}: horizontal overflow ${overflow}px`);
  });
}

console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
server.close();
