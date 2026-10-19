// Build-time side of the bilingual layer (see src/assets/js/i18n.js):
//   extractStrings(html)     English strings keyed like the data-i18n* hooks (for the runtime switch)
//   translatePage(html, ro)  the same page with every hooked text, attribute and meta in Romanian,
//                            so /ro/ pages are real Romanian HTML that search engines can index.

// Finds every element carrying `attr="..."` and returns its key and the index range of its contents.
function* hooked(html, attr) {
  const re = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\s${attr}="([^"]+)"[^>]*>`, 'g');
  for (const m of html.matchAll(re)) {
    const tag = m[1];
    const start = m.index + m[0].length;
    // walk to the matching close tag, counting nested tags of the same name
    const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
    tagRe.lastIndex = start;
    let depth = 1;
    let t;
    while (depth && (t = tagRe.exec(html))) depth += t[1] ? -1 : (t[0].endsWith('/>') ? 0 : 1);
    if (!t) continue;
    yield { key: m[2], start, end: t.index, open: m[0], openIndex: m.index };
  }
}

const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const encodeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const encodeAttr = (s) => encodeText(s).replace(/"/g, '&quot;');

export function extractStrings(html, page) {
  const out = {};
  for (const h of hooked(html, 'data-i18n')) out[h.key] ??= decode(stripTags(html.slice(h.start, h.end)));
  for (const h of hooked(html, 'data-i18n-html')) out[h.key] ??= html.slice(h.start, h.end).trim();
  for (const m of html.matchAll(/<[^>]*\sdata-i18n-attr="([^"]+)"[^>]*>/g)) {
    for (const pair of m[1].split(';')) {
      const [attr, key] = pair.split(':');
      const v = m[0].match(new RegExp(`\\s${attr}="([^"]*)"`));
      out[key] ??= v ? decode(v[1]) : '';
    }
  }
  const title = html.match(/<title>([\s\S]*?)<\/title>/);
  if (title) out[`meta.${page}.title`] = decode(title[1].trim());
  const desc = html.match(/<meta name="description" content="([^"]*)"/);
  if (desc) out[`meta.${page}.desc`] = decode(desc[1]);
  return out;
}

// Applies replacements from the end of the string backwards so earlier indexes stay valid.
function splice(html, edits) {
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) html = html.slice(0, e.start) + e.text + html.slice(e.end);
  return html;
}

export function translatePage(html, ro, page) {
  const edits = [];
  for (const h of hooked(html, 'data-i18n')) if (ro[h.key] != null) edits.push({ start: h.start, end: h.end, text: encodeText(ro[h.key]) });
  for (const h of hooked(html, 'data-i18n-html')) if (ro[h.key] != null) edits.push({ start: h.start, end: h.end, text: ro[h.key] });
  // nested hooks (a data-i18n inside a data-i18n-html) would overlap: keep the outermost edit
  edits.sort((a, b) => a.start - b.start);
  const kept = edits.filter((e, i) => !edits.some((o, j) => j !== i && o.start <= e.start && o.end >= e.end && (o.start !== e.start || o.end !== e.end)));
  html = splice(html, kept);

  html = html.replace(/<[^>]*\sdata-i18n-attr="([^"]+)"[^>]*>/g, (tag, spec) => {
    for (const pair of spec.split(';')) {
      const [attr, key] = pair.split(':');
      if (ro[key] != null) tag = tag.replace(new RegExp(`(\\s${attr}=")[^"]*(")`), `$1${encodeAttr(ro[key])}$2`);
    }
    return tag;
  });

  const title = ro[`meta.${page}.title`];
  const desc = ro[`meta.${page}.desc`];
  if (title) {
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${encodeText(title)}</title>`);
    html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${encodeAttr(title)}$2`);
  }
  if (desc) {
    html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${encodeAttr(desc)}$2`);
    html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${encodeAttr(desc)}$2`);
  }
  // the form tells the inbox which language the visitor used, also when it is sent without JavaScript
  html = html.replace(/(name="language" value=")English(" data-form-lang)/, '$1Romanian$2');
  return html.replace(/<html lang="en"/, '<html lang="ro"');
}
