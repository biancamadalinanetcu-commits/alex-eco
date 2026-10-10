// Interaction smoke test against dist/site: language switch, persistence, every CTA's destination,
// page-transition cleanup and in-page anchors. Exits non-zero on failure.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('dist/site');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try { res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(await readFile(path.join(ROOT, p))); }
  catch { res.writeHead(404); res.end(); }
}).listen(4175);

const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const base = 'http://localhost:4175/';

await page.goto(base, { waitUntil: 'networkidle' });
check('starts in English', (await page.textContent('h1')).includes('Scale smarter'));

await page.click('.nav .lang [data-lang="ro"]');
check('RO button translates the hero', (await page.textContent('h1')).includes('Scalează'));
check('RO sets <html lang>', (await page.getAttribute('html', 'lang')) === 'ro');
check('RO translates the title', (await page.title()).includes('Agenție'));
check('both switches stay in sync', (await page.getAttribute('.footer .lang [data-lang="ro"]', 'aria-pressed')) === 'true');

await page.reload({ waitUntil: 'networkidle' });
check('language persists after reload', (await page.textContent('h1')).includes('Scalează'));

await page.click('.hero .btn--ghost');
await page.waitForTimeout(1500);
const servicesTop = await page.evaluate(() => document.getElementById('services').getBoundingClientRect().top);
check('"See our services" scrolls to services', Math.abs(servicesTop) < 90, `top=${Math.round(servicesTop)}`);

await page.click('.nav__links a[href$="#process"]');
await page.waitForTimeout(1500);
const processTop = await page.evaluate(() => document.getElementById('process').getBoundingClientRect().top);
check('nav "Process" scrolls to process', Math.abs(processTop) < 90, `top=${Math.round(processTop)}`);

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await page.click('.hero .btn--primary');
await page.waitForURL('**/contact.html', { timeout: 4000 }).catch(() => {});
check('hero "Contact us" opens the contact page', page.url().endsWith('contact.html'));
await page.waitForTimeout(1200);
const wipeGone = await page.evaluate(() => !document.documentElement.classList.contains('is-entering') && getComputedStyle(document.querySelector('.wipe')).visibility === 'hidden');
check('page transition clears after arrival', wipeGone);
check('contact page keeps Romanian', (await page.textContent('h1')).includes('Hai să vorbim'));

await page.click('.back-link');
await page.waitForURL((u) => !u.pathname.endsWith('contact.html'), { timeout: 4000 }).catch(() => {});
check('"Back to home" returns home', !page.url().endsWith('contact.html'));

await page.goto(base + 'contact.html', { waitUntil: 'networkidle' });
await page.click('.nav__links a[href$="#results"]');
await page.waitForURL('**/index.html#results', { timeout: 4000 }).catch(() => {});
await page.waitForTimeout(2500);
const resultsTop = await page.evaluate(() => document.getElementById('results').getBoundingClientRect().top);
check('cross-page link lands on #results', Math.abs(resultsTop) < 120, `top=${Math.round(resultsTop)}`);

await page.goto(base, { waitUntil: 'networkidle' });
await page.evaluate(() => document.getElementById('contact-cta').scrollIntoView());
await page.waitForTimeout(1200);
const ctaHref = await page.getAttribute('.cta .btn--primary', 'href');
check('final CTA points to the contact page', ctaHref === 'contact.html');
await page.click('.footer .lang [data-lang="en"]');
check('footer switch returns to English', (await page.textContent('h1')).includes('Scale smarter'));
await page.click('[data-to-top]');
await page.waitForTimeout(1800);
check('"Back to top" scrolls up', (await page.evaluate(() => window.scrollY)) < 5);

// mobile menu
const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await m.newPage();
await mp.goto(base, { waitUntil: 'networkidle' });
await mp.click('[data-menu-toggle]');
await mp.waitForTimeout(600);
check('mobile menu opens', await mp.evaluate(() => document.querySelector('[data-menu]').classList.contains('is-open')));
await mp.click('.menu__links a[href$="#services"]');
await mp.waitForTimeout(1500);
check('mobile menu link closes menu and scrolls', await mp.evaluate(() => !document.querySelector('[data-menu]').classList.contains('is-open') && Math.abs(document.getElementById('services').getBoundingClientRect().top) < 90));
check('no horizontal scroll on mobile', (await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);

check('no JavaScript errors', errors.length === 0, errors.join('; '));
console.log(results.join('\n'));
await browser.close();
server.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
