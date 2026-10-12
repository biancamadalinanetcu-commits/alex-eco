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
// The home page opens on the logo intro; the menu appears once it has opened, as for a real visitor.
const openIntro = async (p) => {
  await p.evaluate(() => { const s = document.querySelector('.pin-spacer'); window.scrollTo(0, s ? s.offsetHeight - innerHeight : 0); });
  await p.waitForTimeout(1800);
};

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const base = 'http://localhost:4175/';

await page.goto(base, { waitUntil: 'networkidle' });
check('opens on the logo intro', await page.evaluate(() => !!document.querySelector('.intro') && getComputedStyle(document.querySelector('.intro')).display !== 'none'));
await openIntro(page);
check('starts in English', (await page.textContent('h1')).includes('Scale smarter'));

await page.click('.nav .lang [data-lang="ro"]');
check('RO button translates the hero', (await page.textContent('h1')).includes('Scalează'));
check('RO sets <html lang>', (await page.getAttribute('html', 'lang')) === 'ro');
check('RO translates the title', (await page.title()).includes('Agenție'));
check('both switches stay in sync', (await page.getAttribute('.footer .lang [data-lang="ro"]', 'aria-pressed')) === 'true');

await page.reload({ waitUntil: 'networkidle' });
await openIntro(page);
check('language persists after reload', (await page.textContent('h1')).includes('Scalează'));

await page.click('.hero .btn--ghost');
await page.waitForTimeout(1500);
const servicesTop = await page.evaluate(() => document.getElementById('services').getBoundingClientRect().top);
check('"See our services" scrolls to services', Math.abs(servicesTop) < 90, `top=${Math.round(servicesTop)}`);

await page.click('.nav__links a[href$="#process"]');
await page.waitForTimeout(1500);
const processTop = await page.evaluate(() => document.getElementById('process').getBoundingClientRect().top);
check('nav "Process" scrolls to process', Math.abs(processTop) < 90, `top=${Math.round(processTop)}`);

await openIntro(page);
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
check('sphere picture is gone', (await page.locator('img[src*="cta-orb"], source[srcset*="cta-orb"]').count()) === 0);
// the arrow turns with scroll: the canvas shows a different angle at two scroll positions
const sample = () => page.evaluate(() => {
  const c = document.querySelector('.cta [data-turn] canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 97) sum += d[i];
  return { ready: c.parentElement.classList.contains('is-ready'), sum };
});
const turnTop = await page.evaluate(() => document.querySelector('.cta [data-turn]').getBoundingClientRect().top + scrollY);
await page.evaluate((y) => window.scrollTo(0, y - innerHeight + 120), turnTop);
await page.waitForTimeout(2500);
const early = await sample();
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(1500);
const late = await sample();
check('closing arrow turns as you scroll', early.ready && late.ready && Math.abs(early.sum - late.sum) > 1000, JSON.stringify({ early, late }));
await page.evaluate(() => document.getElementById('contact-cta').scrollIntoView());
await page.waitForTimeout(800);
check('final CTA points to the contact page', ctaHref === 'contact.html');
await page.click('.footer .lang [data-lang="en"]');
check('footer switch returns to English', (await page.textContent('h1')).includes('Scale smarter'));
await page.click('[data-to-top]');
await page.waitForTimeout(2600);
// With the logo intro, "top" is the opened hero (the end of the intro), not the closed logo at y=0.
check('"Back to top" returns to the hero', Math.abs(await page.evaluate(() => document.querySelector('.hero').getBoundingClientRect().top)) < 5);

// contact page: WhatsApp, social links and the request form (the email service is mocked, nothing is sent)
const cp = await ctx.newPage();
cp.on('pageerror', (e) => errors.push(e.message));
let sent = null;
let failNext = false;
await cp.route('https://formsubmit.co/**', async (route) => {
  if (failNext) { failNext = false; return route.fulfill({ status: 500, body: '{}' }); }
  sent = { url: route.request().url(), body: new URLSearchParams(route.request().postData() || '') };
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"true"}' });
});
await cp.goto(base + 'contact.html', { waitUntil: 'networkidle' });
const wa = await cp.getAttribute('.btn--wa', 'href');
check('WhatsApp button opens a chat with +40792535738', wa.startsWith('https://wa.me/40792535738?text=Hi%20Scalium'), wa);
check('social links: Instagram and TikTok in footer', (await cp.locator('.footer .social__link').count()) === 2
  && (await cp.getAttribute('.footer .social__link[aria-label="Instagram"]', 'href')).includes('instagram.com')
  && (await cp.getAttribute('.footer .social__link[aria-label="TikTok"]', 'href')).includes('tiktok.com'));

await cp.click('.form__submit');
const visibleErrors = await cp.$$eval('[data-error-for]', (els) => els.filter((e) => !e.hidden).map((e) => e.dataset.errorFor).join(','));
check('empty form shows all four errors', visibleErrors === 'service,name,email,phone', visibleErrors);
check('empty form is not sent', sent === null);

await cp.click('.chip:has(input[value="Meta Ads scaling"])');
await cp.click('.chip:has(input[value="Growth marketing"])');
await cp.fill('#f-name', 'Ana Test');
await cp.fill('#f-email', 'not-an-email');
await cp.fill('#f-phone', '0722 123 456');
await cp.click('.form__submit');
check('invalid email is caught', !(await cp.locator('[data-error-for="email"]').isHidden()) && sent === null);
await cp.fill('#f-email', 'ana@brand.ro');
await cp.fill('#f-message', 'Monthly budget 5000 EUR');

failNext = true;
await cp.click('.form__submit');
await cp.waitForTimeout(600);
check('failed send shows a fallback message', await cp.locator('[data-status="fail"]').isVisible());

await cp.click('.form__submit');
await cp.waitForSelector('[data-form-done]:not([hidden])', { timeout: 4000 }).catch(() => {});
check('form sends to scalium.buisiness@gmail.com', !!sent && sent.url === 'https://formsubmit.co/ajax/scalium.buisiness@gmail.com', sent && sent.url);
check('request carries service, email and phone', !!sent && sent.body.get('service') === 'Meta Ads scaling, Growth marketing'
  && sent.body.get('email') === 'ana@brand.ro' && sent.body.get('phone') === '0722 123 456' && sent.body.get('name') === 'Ana Test',
  sent && sent.body.toString());
check('success message replaces the form', await cp.locator('[data-form-done]').isVisible());

await cp.click('.nav .lang [data-lang="ro"]');
const waRo = await cp.getAttribute('.btn--wa', 'href');
check('WhatsApp greeting follows the language', waRo.includes('Bun%C4%83'), waRo);
await cp.click('.nav .lang [data-lang="en"]');
await cp.close();

// the logo intro must survive a slow connection (the animation script arriving late)
const slow = await ctx.newPage();
await slow.route('**/assets/js/main.js', async (route) => { await new Promise((r) => setTimeout(r, 5000)); return route.continue(); });
await slow.goto(base, { waitUntil: 'load', timeout: 20000 });
await slow.waitForTimeout(800);
check('logo intro survives a slow script', await slow.evaluate(() => !document.documentElement.classList.contains('intro-skip') && window.__scaliumIntro === true));
await slow.evaluate(() => window.scrollTo(0, 900));
await slow.waitForTimeout(1500);
await slow.reload({ waitUntil: 'load', timeout: 20000 });
await slow.waitForTimeout(800);
check('reload starts again on the logo intro', await slow.evaluate(() => scrollY === 0 && window.__scaliumIntro === true));
await slow.close();

// mobile menu
const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await m.newPage();
await mp.goto(base, { waitUntil: 'networkidle' });
await openIntro(mp);
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
