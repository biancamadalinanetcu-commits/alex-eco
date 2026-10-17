// Bilingual layer (English / Romanian).
// English is written in the HTML; Romanian lives in i18n-ro.js. The build pre-renders both languages
// (/ and /ro/ on the static site) so search engines index each one, extracts the English strings into
// i18n-en.js, and this script switches instantly between them, keeping the address in step.
// Markup hooks:
//   data-i18n="key"            replaces textContent
//   data-i18n-html="key"       replaces innerHTML (for headings with inline markup)
//   data-i18n-attr="attr:key"  replaces attributes, several separated by ";"

import { RO } from './i18n-ro.js';
import { EN as EN_STRINGS } from './i18n-en.js';

const STORAGE_KEY = 'scalium-lang';
const root = document.documentElement;
const page = document.body.getAttribute('data-page') || 'home';
const EN = { ...EN_STRINGS };
let current = root.getAttribute('lang') === 'ro' ? 'ro' : 'en';

// Keep the language in the address (?lang=) when it differs from the page's own, so a reload or a
// shared link shows the same language. The path never changes: relative links and images would break.
const pageLang = root.getAttribute('data-page-lang') === 'ro' ? 'ro' : 'en';
function syncUrl(lang) {
  try {
    const url = new URL(location.href);
    if (lang === pageLang) url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    if (url.href !== location.href) history.replaceState(history.state, '', url.href);
  } catch (e) { /* sandboxed frame */ }
}

function t(key, lang) {
  const dict = lang === 'ro' ? RO : EN;
  return dict[key] ?? EN[key];
}

function apply(lang) {
  current = lang === 'ro' ? 'ro' : 'en';
  root.lang = current;
  root.setAttribute('data-lang', current);

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = t(el.dataset.i18n, current);
    if (v != null && el.textContent !== v) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const v = t(el.dataset.i18nHtml, current);
    if (v != null && el.innerHTML.trim() !== v) el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':');
      const v = t(key, current);
      if (v != null) el.setAttribute(attr, v);
    });
  });

  // WhatsApp links open a chat with a greeting in the visitor's language.
  document.querySelectorAll('[data-wa][data-wa-text]').forEach((a) => {
    a.href = `https://wa.me/${a.dataset.wa}?text=${encodeURIComponent(a.dataset.waText)}`;
  });
  const formLang = document.querySelector('[data-form-lang]');
  if (formLang) formLang.value = current === 'ro' ? 'Romanian' : 'English';

  const title = t(`meta.${page}.title`, current);
  if (title) document.title = title;
  const desc = document.querySelector('meta[name="description"]');
  const d = t(`meta.${page}.desc`, current);
  if (desc && d) desc.content = d;

  document.querySelectorAll('.lang').forEach((group) => {
    group.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.lang === current));
    });
    group.classList.toggle('is-ro', current === 'ro');
  });
}

function set(lang, { persist = true } = {}) {
  const next = lang === 'ro' ? 'ro' : 'en';
  if (persist) { try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* private mode */ } }
  if (next === current) return;
  apply(next);
  syncUrl(next);
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: next } }));
}

const initial = root.getAttribute('data-lang') === 'ro' ? 'ro' : 'en';
apply(initial);
syncUrl(initial);

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.lang [data-lang]');
  if (btn) set(btn.dataset.lang);
});

window.ScaliumI18n = { set, get: () => current };
