// Builds the Scalium site from /src into two deliverables:
//   dist/site/                        static, minified website (open index.html or host anywhere)
//   dist/scalium-wordpress-theme.zip  the same site as an installable WordPress theme
//
// Source HTML supports three small macros so markup stays readable:
//   <!-- @include name -->                       inlines src/partials/name.html
//   <!-- @picture name="..." sizes="..." ... -->  expands to a responsive AVIF/WebP <picture>
//   <!-- @icons -->                              inlines the SVG icon sprite (Phosphor icons)
//   {{key}}                                      a value from src/config.json (email, WhatsApp, social links).
//                                                In WordPress these become Customizer settings.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, rm, cp, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { crops } from './crops.mjs';
import { extractStrings, translatePage } from './i18n-build.mjs';
import { RO } from '../src/assets/js/i18n-ro.js';

const SRC = 'src';
const DIST = 'dist';
const SITE = `${DIST}/site`;
const THEME_DIR = `${DIST}/wordpress/scalium`;

const ICONS = ['arrow-right', 'arrow-up-right', 'arrow-left', 'arrow-up', 'sparkle', 'paper-plane-tilt', 'chart-bar',
  'gear-six', 'trend-up', 'check', 'list', 'x', 'lightning', 'users-three', 'target',
  'whatsapp-logo', 'instagram-logo', 'tiktok-logo', 'envelope-simple', 'check-circle'];

// Contact details and social links live in one place.
const config = JSON.parse(await readFile(`${SRC}/config.json`, 'utf8'));
// The static site sends the form through FormSubmit (no server needed). After the one-time
// activation, "formsubmit" in config.json can be set to the private alias FormSubmit gives you.
const formsubmitId = config.formsubmit || config.email;
// Profiles for the schema: a bare platform home page (no profile set yet) says nothing about Scalium.
const profileUrls = [config.instagram, config.tiktok].filter((u) => { try { return new URL(u).pathname.replace(/\/+$/, '') !== ''; } catch { return false; } });
const STATIC_TOKENS = {
  ...config,
  same_as: JSON.stringify(profileUrls),
  form_action: `https://formsubmit.co/${formsubmitId}`,
  form_endpoint: `https://formsubmit.co/ajax/${formsubmitId}`,
  form_sent_body: '',
  form_sent_done: ' hidden',
  form_sent_fail: ' hidden',
};
// WordPress reads the same values from the Customizer (defaults come from config.json),
// and the form posts to the theme's own handler, which emails the request and keeps a copy in wp-admin.
const WP_FORM_URL = "<?php echo esc_url( admin_url( 'admin-post.php?action=scalium_contact' ) ); ?>";
const WP_TOKENS = {
  site_url: "<?php echo esc_url( untrailingslashit( home_url() ) ); ?>",
  email: "<?php echo esc_attr( scalium_setting( 'email' ) ); ?>",
  whatsapp: "<?php echo esc_attr( scalium_setting( 'whatsapp' ) ); ?>",
  whatsapp_display: "<?php echo esc_html( scalium_setting( 'whatsapp_display' ) ); ?>",
  instagram: "<?php echo esc_url( scalium_setting( 'instagram' ) ); ?>",
  tiktok: "<?php echo esc_url( scalium_setting( 'tiktok' ) ); ?>",
  same_as: '[]', // the theme prints its own schema (functions.php)
  form_action: WP_FORM_URL,
  form_endpoint: WP_FORM_URL,
  // Without JavaScript the WordPress handler redirects back with ?sent=1 or ?sent=0: show the result.
  form_sent_body: "<?php echo scalium_form_result() === 'sent' ? ' hidden' : ''; ?>",
  form_sent_done: "<?php echo scalium_form_result() === 'sent' ? '' : ' hidden'; ?>",
  form_sent_fail: "<?php echo scalium_form_result() === 'failed' ? '' : ' hidden'; ?>",
};
const fillTokens = (html, tokens) => html.replace(/\{\{(\w+)\}\}/g, (m, key) => {
  if (!(key in tokens)) throw new Error(`Unknown config token ${m}`);
  return tokens[key];
});

await rm(DIST, { recursive: true, force: true });
await mkdir(`${SITE}/assets`, { recursive: true });

// ---------------------------------------------------------------- icons
async function iconSprite() {
  const symbols = [];
  for (const name of ICONS) {
    const svg = await readFile(`node_modules/@phosphor-icons/core/assets/regular/${name}.svg`, 'utf8');
    const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    symbols.push(`<symbol id="i-${name}" viewBox="0 0 256 256">${inner}</symbol>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">${symbols.join('')}</svg>`;
}

// ---------------------------------------------------------------- html macros
const cropByName = Object.fromEntries(crops.map((c) => [c.name, c]));
const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map((m) => [m[1], m[2] ?? true]));

function picture(a) {
  const c = cropByName[a.name];
  if (!c) throw new Error(`Unknown picture: ${a.name}`);
  const set = (ext) => c.widths.map((w) => `assets/img/${c.name}-${w}.${ext} ${Math.min(w, c.width * 2)}w`).join(', ');
  const fallback = c.widths[Math.min(1, c.widths.length - 1)];
  const eager = a.eager === true || a.eager === 'true';
  const loading = eager ? 'fetchpriority="high" loading="eager"' : 'loading="lazy"';
  const i18nAlt = a['alt-key'] ? ` data-i18n-attr="alt:${a['alt-key']}"` : '';
  const cls = a.class ? ` class="${a.class}"` : '';
  const pcls = a['picture-class'] ? ` class="${a['picture-class']}"` : '';
  return `<picture${pcls}><source type="image/avif" srcset="${set('avif')}" sizes="${a.sizes}"><img${cls} src="assets/img/${c.name}-${fallback}.webp" srcset="${set('webp')}" sizes="${a.sizes}" width="${c.width}" height="${c.height}" alt="${a.alt ?? ''}"${i18nAlt} ${loading} decoding="async"></picture>`;
}

async function renderPage(file, sprite) {
  let html = await readFile(`${SRC}/${file}`, 'utf8');
  for (let pass = 0; pass < 3; pass++) {
    html = await replaceAsync(html, /<!--\s*@include\s+([\w-]+)\s*-->/g, async (_, name) => readFile(`${SRC}/partials/${name}.html`, 'utf8'));
  }
  html = html.replace(/<!--\s*@icons\s*-->/g, sprite);
  html = html.replace(/<!--\s*@picture\s+([\s\S]*?)-->/g, (_, a) => picture(attrs(a)));
  if (/[–—]/.test(html)) throw new Error(`${file}: contains an en/em dash. Use a hyphen.`);
  return minifyHtml(html);
}

async function replaceAsync(str, re, fn) {
  const parts = [];
  let last = 0;
  for (const m of str.matchAll(re)) {
    parts.push(str.slice(last, m.index), await fn(...m));
    last = m.index + m[0].length;
  }
  parts.push(str.slice(last));
  return parts.join('');
}

// Conservative minifier: strips comments (keeps WP markers) and indentation, never touches inline text.
function minifyHtml(html) {
  return html
    .replace(/<!--(?!\s*@(?:wp|seo))[\s\S]*?-->/g, '')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim() + '\n';
}

// ---------------------------------------------------------------- assets
async function buildAssets() {
  await build({
    entryPoints: [`${SRC}/assets/css/main.css`],
    bundle: true, minify: true, outfile: `${SITE}/assets/css/main.css`,
    external: ['*.woff2', '*.svg', '*.avif', '*.webp'], target: ['chrome100', 'safari15', 'firefox100'], logLevel: 'warning',
  });
  await build({
    entryPoints: [`${SRC}/assets/js/main.js`],
    bundle: true, minify: true, format: 'iife', outfile: `${SITE}/assets/js/main.js`,
    target: ['es2019'], logLevel: 'warning', legalComments: 'none',
  });
  await build({
    entryPoints: [`${SRC}/assets/js/i18n.js`],
    bundle: true, minify: true, format: 'iife', outfile: `${SITE}/assets/js/i18n.js`,
    target: ['es2019'], logLevel: 'warning', charset: 'utf8',
  });

  await cp(`${SRC}/assets/fonts`, `${SITE}/assets/fonts`, { recursive: true });
  await cp(`${SRC}/assets/img`, `${SITE}/assets/img`, { recursive: true });
}

// ---------------------------------------------------------------- cache busting (static site)
// Every asset URL carries a hash of the file (?v=…), so hosts can cache assets for a year and a
// new build is still fetched at once. The theme keeps plain paths: WordPress adds its own ?ver=.
const assetVersion = new Map();
const hashOf = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);
async function fingerprintAssets() {
  for (const dir of ['fonts', 'img', 'js']) {
    for (const f of await readdir(`${SITE}/assets/${dir}`)) assetVersion.set(`${dir}/${f}`, hashOf(await readFile(`${SITE}/assets/${dir}/${f}`)));
  }
  const cssFile = `${SITE}/assets/css/main.css`;
  const css = (await readFile(cssFile, 'utf8')).replace(/url\((["']?)\.\.\/((?:fonts|img)\/[^"')?#]+)\1\)/g, (m, q, ref) =>
    assetVersion.has(ref) ? `url(${q}../${ref}?v=${assetVersion.get(ref)}${q})` : m);
  await writeFile(cssFile, css);
  assetVersion.set('css/main.css', hashOf(css));
}
// Relative references only (assets/… or ../assets/…); absolute URLs such as og:image stay as they are.
const versionAssets = (html) => html.replace(/(?<![\w/.:-])((?:\.\.\/)?assets\/([\w\-./]+?\.(?:css|js|woff2|png|jpe?g|webp|avif|svg)))(?=["'\s,)])/g,
  (m, url, ref) => (assetVersion.has(ref) ? `${url}?v=${assetVersion.get(ref)}` : m));

// ---------------------------------------------------------------- wordpress theme
// The theme reuses the built pages verbatim. Asset paths become theme URLs, page links
// become WordPress permalinks, and the static <link>/<script> tags are replaced by
// wp_head()/wp_footer() so plugins (SEO, caching, analytics) keep working.
const PHP_ASSET = '<?php echo esc_url( SCALIUM_URI ); ?>/assets/';

function toPhp(html) {
  return fillTokens(html, WP_TOKENS)
    .replace(/(["\s,])assets\//g, `$1${PHP_ASSET}`)
    .replace(/href="index\.html#([\w-]+)"/g, (_, id) => `href="<?php echo esc_url( home_url( '/#${id}' ) ); ?>"`)
    .replace(/href="index\.html"/g, `href="<?php echo esc_url( home_url( '/' ) ); ?>"`)
    .replace(/href="contact\.html"/g, `href="<?php echo esc_url( scalium_contact_url() ); ?>"`);
}

function splitPage(html) {
  const headEnd = html.indexOf('<!-- @wp:main-start -->');
  const footStart = html.indexOf('<!-- @wp:main-end -->');
  if (headEnd < 0 || footStart < 0) throw new Error('Missing @wp:main markers');
  return {
    head: html.slice(0, headEnd),
    main: html.slice(headEnd + '<!-- @wp:main-start -->'.length, footStart),
    foot: html.slice(footStart + '<!-- @wp:main-end -->'.length),
  };
}

function wpHeader(head) {
  return head
    .replace(/<!-- @wp:remove -->[\s\S]*?<!-- @wp:end -->\n?/g, '')
    .replace(/<html lang="en"([^>]*)>/, '<html <?php language_attributes(); ?>$1>')
    .replace(/<title>[\s\S]*?<\/title>\n?/, '')
    .replace('<!-- @wp:head -->', '<?php wp_head(); ?>')
    .replace(/<body([^>]*)class="([^"]*)"([^>]*)>/, '<body$1 <?php body_class( \'$2\' ); ?>$3>\n<?php wp_body_open(); ?>')
    .replace(/data-page="\w+"/, 'data-page="<?php echo esc_attr( scalium_page_key() ); ?>"');
}

function wpFooter(foot) {
  return foot
    .replace(/<!-- @wp:remove -->[\s\S]*?<!-- @wp:end -->\n?/g, '')
    .replace('<!-- @wp:footer -->', '<?php wp_footer(); ?>');
}

async function buildTheme(pages) {
  await mkdir(THEME_DIR, { recursive: true });
  await cp(`${SITE}/assets`, `${THEME_DIR}/assets`, { recursive: true });
  const home = splitPage(toPhp(pages['index.html']));
  const contact = splitPage(toPhp(pages['contact.html']));

  await writeFile(`${THEME_DIR}/header.php`, wpHeader(home.head));
  await writeFile(`${THEME_DIR}/footer.php`, wpFooter(home.foot));
  await writeFile(`${THEME_DIR}/front-page.php`, `<?php get_header(); ?>\n${home.main}\n<?php get_footer();\n`);
  // The contact template keeps an editor slot: anything typed into the "Contact" page in WordPress shows up there.
  const contactMain = contact.main.replace('<!-- @wp:content -->', '<?php while ( have_posts() ) : the_post(); the_content(); endwhile; ?>');
  await writeFile(`${THEME_DIR}/page-contact.php`, `<?php get_header(); ?>\n${contactMain}\n<?php get_footer();\n`);
  await writeFile(`${THEME_DIR}/index.php`, await readFile('wordpress/index.php', 'utf8'));
  await writeFile(`${THEME_DIR}/functions.php`, await readFile('wordpress/functions.php', 'utf8'));
  // Customizer defaults, generated from src/config.json so both builds share one source.
  const phpStr = (v) => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const phpArray = Object.entries(config).map(([k, v]) => `\t${phpStr(k)} => ${phpStr(v)},`).join('\n');
  await writeFile(`${THEME_DIR}/config.php`, `<?php\n// Generated from src/config.json by scripts/build.mjs. Change values in Appearance > Customize > Scalium contact.\nreturn array(\n${phpArray}\n);\n`);
  await writeFile(`${THEME_DIR}/style.css`, await readFile('wordpress/style.css', 'utf8'));
  await cp('wordpress/screenshot.png', `${THEME_DIR}/screenshot.png`);

  const zip = path.resolve(`${DIST}/scalium-wordpress-theme.zip`);
  execFileSync('zip', ['-qr9', zip, 'scalium'], { cwd: `${DIST}/wordpress` });
}

// ---------------------------------------------------------------- seo (static site)
// Every page exists in English (/) and Romanian (/ro/). Each version names itself canonical and links
// its twin with hreflang, and the sitemap lists both.
const SITE_URL = config.site_url.replace(/\/+$/, '');
const pageUrl = (path, lang) => `${SITE_URL}/${lang === 'ro' ? 'ro/' : ''}${path}`;
function seoBlock(path, lang) {
  const other = lang === 'ro' ? 'en' : 'ro';
  return [
    `<link rel="canonical" href="${pageUrl(path, lang)}">`,
    `<link rel="alternate" hreflang="en" href="${pageUrl(path, 'en')}">`,
    `<link rel="alternate" hreflang="ro" href="${pageUrl(path, 'ro')}">`,
    `<link rel="alternate" hreflang="x-default" href="${pageUrl(path, 'en')}">`,
    `<meta property="og:url" content="${pageUrl(path, lang)}">`,
    `<meta property="og:locale" content="${lang === 'ro' ? 'ro_RO' : 'en_US'}">`,
    `<meta property="og:locale:alternate" content="${other === 'ro' ? 'ro_RO' : 'en_US'}">`,
  ].join('\n');
}
const pageKey = (html) => (html.match(/data-page="(\w+)"/) || [])[1] || 'home';

// ---------------------------------------------------------------- run
const sprite = await iconSprite();
const pages = {};
for (const file of (await readdir(SRC)).filter((f) => f.endsWith('.html'))) pages[file] = await renderPage(file, sprite);

// English strings for the runtime language switch, straight from the pages
const en = {};
for (const html of Object.values(pages)) Object.assign(en, extractStrings(html, pageKey(html)));
await writeFile(`${SRC}/assets/js/i18n-en.js`, `// Generated by scripts/build.mjs from the English pages. Do not edit: change the HTML instead.\nexport const EN = ${JSON.stringify(en, null, 2)};\n`);
await buildAssets();
await fingerprintAssets();

const sitemap = [];
await mkdir(`${SITE}/ro`, { recursive: true });
for (const [file, html] of Object.entries(pages)) {
  const path = file === 'index.html' ? '' : file;
  const seo = (h, lang) => h.replace(/<!-- @seo path="[^"]*" -->/, seoBlock(path, lang));
  // Static output: WP markers are not needed, strip them.
  const finish = (h) => versionAssets(fillTokens(h, STATIC_TOKENS).replace(/<!-- @wp:[\w-]+ -->\n?/g, ''));
  await writeFile(`${SITE}/${file}`, finish(seo(html, 'en')));
  const ro = translatePage(seo(html, 'ro'), RO, pageKey(html)).replace(/(["\s,(])assets\//g, '$1../assets/');
  await writeFile(`${SITE}/ro/${file}`, finish(ro));
  sitemap.push(path);
}
const today = new Date().toISOString().slice(0, 10);
const urlEntry = (path, lang) => `  <url>\n    <loc>${pageUrl(path, lang)}</loc>\n    <lastmod>${today}</lastmod>\n` +
  ['en', 'ro'].map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(path, l)}"/>`).join('\n') +
  `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(path, 'en')}"/>\n  </url>`;
await writeFile(`${SITE}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sitemap.sort().flatMap((p) => [urlEntry(p, 'en'), urlEntry(p, 'ro')]).join('\n')}\n</urlset>\n`);
await writeFile(`${SITE}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

// Netlify: one canonical host. www and the other of .ro/.com 301 to site_url, so Google
// never indexes the same page twice. Rules only fire for domains attached to the site.
const host = new URL(SITE_URL).hostname.replace(/^www\./, '');
const twin = host.endsWith('.ro') ? host.replace(/\.ro$/, '.com') : host.endsWith('.com') ? host.replace(/\.com$/, '.ro') : null;
const aliases = [`www.${host}`, host, ...(twin ? [twin, `www.${twin}`] : [])]
  .filter((h) => `https://${h}` !== SITE_URL);
await writeFile(`${SITE}/_redirects`, aliases.flatMap((h) => [`http://${h}/*`, `https://${h}/*`]).map((from) => `${from}  ${SITE_URL}/:splat  301!`).join('\n') + '\n');
// Netlify / Cloudflare Pages: assets are versioned, so they can be cached for a year.
await writeFile(`${SITE}/_headers`, '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n');
await buildTheme(pages);

// Size report (what a first visit to the homepage downloads, before lazy images)
const sizes = [];
for (const f of ['index.html', 'contact.html', 'assets/css/main.css', 'assets/js/main.js', 'assets/js/i18n.js']) {
  const buf = await readFile(`${SITE}/${f}`);
  sizes.push({ file: f, kb: (buf.length / 1024).toFixed(1), gzipKb: (gzipSync(buf).length / 1024).toFixed(1) });
}
console.table(sizes);
console.log(`Theme zip: ${((await stat(`${DIST}/scalium-wordpress-theme.zip`)).size / 1024).toFixed(0)} KB`);
