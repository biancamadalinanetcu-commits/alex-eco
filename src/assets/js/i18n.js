// Bilingual layer (English / Romanian).
// English lives in the HTML itself, so search engines and no-JS visitors get real content.
// On start-up the English strings are captured from the DOM; only Romanian needs a dictionary.
// Markup hooks:
//   data-i18n="key"            replaces textContent
//   data-i18n-html="key"       replaces innerHTML (for headings with inline markup)
//   data-i18n-attr="attr:key"  replaces attributes, several separated by ";"

const RO = {
  'meta.home.title': 'Scalium | Agenție de Meta Ads și Growth Marketing',
  'meta.home.desc': 'Scalium ajută brandurile eCommerce să crească profitabil prin campanii Meta Ads bazate pe date, optimizare cu AI și growth marketing.',
  'meta.contact.title': 'Contact | Scalium',
  'meta.contact.desc': 'Contactează Scalium pentru mai multe informații și prețuri despre Meta Ads, marketing și growth marketing.',

  skip: 'Sari la conținut',
  'nav.label': 'Principal',
  'nav.mobile': 'Meniu mobil',
  'nav.services': 'Servicii',
  'nav.process': 'Proces',
  'nav.results': 'Rezultate',
  'nav.menu': 'Meniu',
  'lang.label': 'Limbă',
  'cta.contact': 'Contactează-ne',

  'hero.eyebrow': 'Meta Ads <span>&times;</span> AI <span>&times;</span> Creștere',
  'hero.title': '<span class="line"><span>Scalează inteligent</span></span> <span class="line"><span>cu <em>Meta Ads.</em></span></span>',
  'hero.lead': 'Ajutăm brandurile eCommerce să crească profitabil prin campanii Meta Ads bazate pe date, optimizare cu AI și strategie orientată spre performanță.',
  'hero.secondary': 'Vezi serviciile',
  'hero.alt': 'Dashboard Scalium pentru Meta Ads cu venituri totale, ROAS și campanii active',

  'statement.text': 'Majoritatea brandurilor nu au o problemă de trafic. Au o problemă de scalare. Noi construim sistemul care transformă bugetul de reclame în venituri predictibile.',
  'outcome.1': 'Venituri mai mari',
  'outcome.2': 'CAC mai mic',
  'outcome.3': 'Creștere pe termen lung',

  'services.title': 'Trei servicii. Un singur obiectiv: creștere profitabilă.',
  'services.lead': 'Alege unul sau combină-le pe toate trei. Aceeași echipă, aceleași date și același obiectiv în spatele fiecăruia.',

  'svc1.title': 'Scalarea brandului cu Meta Ads',
  'svc1.short': 'Scalare cu Meta Ads',
  'svc1.text': 'Campanii pe Facebook și Instagram construite să crească bugetul fără să piardă din eficiență. Structurăm contul, găsim audiențele care cumpără și scalăm bugetele pe baza semnalelor care contează.',
  'svc1.d1': 'Structură de campanii full-funnel',
  'svc1.d2': 'Cercetare și targetare de audiențe',
  'svc1.d3': 'Scalarea bugetului și strategie de licitare',
  'svc1.d4': 'Campanii Advantage+ și de catalog',

  'svc2.title': 'Marketing gestionat de noi',
  'svc2.short': 'Administrare marketing',
  'svc2.text': 'Ne ocupăm de marketingul tău zi de zi: producția și testarea creativelor, lansări, raportare și optimizare. Ai o echipă senior fără să construiești una internă.',
  'svc2.d1': 'Strategie și producție de creative',
  'svc2.d2': 'Testare continuă a creativelor',
  'svc2.d3': 'Lansări de campanii și promoții',
  'svc2.d4': 'Rapoarte săptămânale clare',

  'svc3.title': 'Growth marketing',
  'svc3.short': 'Growth marketing',
  'svc3.text': 'Creșterea vine din tot funnel-ul, nu dintr-un singur canal. Testăm oferte, landing page-uri și fluxuri de retenție, reparăm tracking-ul și folosim datele ca să găsim următoarea etapă de creștere.',
  'svc3.d1': 'Optimizarea ratei de conversie',
  'svc3.d2': 'Tracking cu Pixel, CAPI și GA4',
  'svc3.d3': 'Experimente de ofertă și funnel',
  'svc3.d4': 'Strategie de retenție și LTV',

  'process.title': 'De la prima reclamă la scalare predictibilă.',
  'process.lead': 'Cinci etape, un singur ciclu. Fiecare ciclu îl alimentează pe următorul cu date mai bune.',
  'step1.title': 'Creare',
  'step1.text': 'Creative construite pe cercetare și produse rapid cu AI, gata de testat din prima zi.',
  'step2.title': 'Lansare',
  'step2.text': 'Campaniile pornesc pe Facebook și Instagram cu un plan clar de testare.',
  'step3.title': 'Analiză',
  'step3.text': 'Citim cifrele care contează și le transformăm în decizii, nu doar în rapoarte.',
  'step4.title': 'Automatizare',
  'step4.text': 'Reguli și optimizare asistată de AI țin bugetele la lucru non-stop.',
  'step5.title': 'Scalare',
  'step5.text': 'Reclamele și audiențele câștigătoare primesc mai mult buget, iar creșterea rămâne profitabilă pe măsură ce investiția crește.',

  'results.title': 'Creștere <em>bazată pe date.</em>',
  'results.lead': 'Fiecare decizie e susținută de cifre. Acestea sunt metricile pentru care răspundem.',
  'results.alt': 'Dashboard de performanță cu buget de reclame, conversii și un grafic de venituri în creștere',
  'results.note': 'Cifre ilustrative. Rezultatele depind de brand, ofertă și buget.',
  'stat.leads': 'Lead-uri',
  'stat.revenue': 'Venituri',

  'cta.title': 'Creștem împreună.',
  'cta.sub': 'Meta Ads. Marketing. Growth Marketing.',
  'cta.button': 'Contactează-ne pentru informații și prețuri',

  'footer.tag': 'Automatizăm azi. Creștem mâine.',
  'footer.company': 'Companie',
  'footer.rights': 'Toate drepturile rezervate.',
  'footer.top': 'Înapoi sus',

  'contact.back': 'Înapoi la pagina principală',
  'contact.title': '<span class="line"><span>Hai să vorbim despre</span></span> <span class="line"><span><em>creșterea ta.</em></span></span>',
  'contact.lead': 'Mai multe informații și prețuri pentru Meta Ads, marketing și growth marketing.',
};

const STORAGE_KEY = 'scalium-lang';
const root = document.documentElement;
const page = document.body.getAttribute('data-page') || 'home';
const EN = {};
let current = 'en';

function capture() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { EN[el.dataset.i18n] ??= el.textContent.trim(); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { EN[el.dataset.i18nHtml] ??= el.innerHTML.trim(); });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':');
      EN[key] ??= el.getAttribute(attr) || '';
    });
  });
  EN[`meta.${page}.title`] = document.title;
  const desc = document.querySelector('meta[name="description"]');
  EN[`meta.${page}.desc`] = desc ? desc.content : '';
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
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: next } }));
}

capture();
apply(root.getAttribute('data-lang') === 'ro' ? 'ro' : 'en');

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.lang [data-lang]');
  if (btn) set(btn.dataset.lang);
});

window.ScaliumI18n = { set, get: () => current };
