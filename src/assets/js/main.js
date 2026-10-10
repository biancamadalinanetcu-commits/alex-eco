// Scalium interactions.
// CSS owns the intro animation (so first paint never waits on this file); GSAP + ScrollTrigger
// own everything tied to scroll position. Every effect has a reduced-motion path.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const DESKTOP = '(min-width: 961px)';
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const navHeight = () => $('[data-nav]')?.offsetHeight || 0;
const normPath = (p) => p.replace(/index\.html$/, '').replace(/\/+$/, '');
const isSamePage = (url) => url.origin === location.origin && normPath(url.pathname) === normPath(location.pathname);

function scrollToEl(el, behavior = reduceMotion ? 'auto' : 'smooth') {
  const top = el === document.body ? 0 : el.getBoundingClientRect().top + window.scrollY - navHeight() + 1;
  window.scrollTo({ top, behavior });
}

/* ---------------------------------------------------------------- page transition */
function initTransitions() {
  if (root.classList.contains('is-entering')) {
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-entered')));
    setTimeout(() => root.classList.remove('is-entering', 'is-entered'), 900);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-transition]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || isSamePage(url)) return;
    if (reduceMotion) return;
    e.preventDefault();
    closeMenu();
    try { sessionStorage.setItem('scalium-wipe', '1'); } catch (err) { /* storage blocked */ }
    root.classList.add('is-leaving');
    setTimeout(() => { location.href = url.href; }, 480);
  });

  // Coming back through the browser cache restores the old DOM state, so clear it.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) root.classList.remove('is-leaving', 'is-entering', 'is-entered');
  });
}

/* ---------------------------------------------------------------- in-page anchors */
function initAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    const url = new URL(a.href, location.href);
    if (!isSamePage(url) || !url.hash) return;
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(target);
    history.pushState(null, '', url.hash);
  });

  $('[data-to-top]')?.addEventListener('click', () => {
    // With the logo intro, "top" means the opened hero, not the closed logo.
    window.scrollTo({ top: introTrigger ? introTrigger.end : 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    $('[data-home-link]')?.focus({ preventScroll: true });
  });
}

/* ---------------------------------------------------------------- navigation */
function initNav() {
  const nav = $('[data-nav]');
  const bar = $('[data-scroll-progress]');
  if (!nav) return;
  const setState = (y, progress) => {
    nav.classList.toggle('is-scrolled', y > 24);
    if (bar) bar.style.transform = `scaleX(${progress})`;
  };
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => setState(self.scroll(), self.progress),
    onRefresh: (self) => setState(self.scroll(), self.progress),
  });
}

/* ---------------------------------------------------------------- mobile menu */
let menuOpen = false;
function setMenu(open) {
  const menu = $('[data-menu]');
  const toggle = $('[data-menu-toggle]');
  if (!menu || !toggle || open === menuOpen) return;
  menuOpen = open;
  toggle.setAttribute('aria-expanded', String(open));
  if (open) {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    root.style.overflow = 'hidden';
    $('[data-nav]')?.classList.add('is-scrolled');
  } else {
    menu.classList.remove('is-open');
    root.style.overflow = '';
    setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 400);
  }
}
function closeMenu() { setMenu(false); }
function initMenu() {
  $('[data-menu-toggle]')?.addEventListener('click', () => setMenu(!menuOpen));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) { setMenu(false); $('[data-menu-toggle]')?.focus(); }
  });
  matchMedia(DESKTOP).addEventListener('change', (e) => { if (e.matches) setMenu(false); });
}

/* ---------------------------------------------------------------- reveal + dash lines */
function initReveal() {
  const items = $$('[data-reveal], [data-dash]');
  const show = (el) => el.classList.add(el.hasAttribute('data-dash') ? 'is-on' : 'is-in');
  if (reduceMotion || !('IntersectionObserver' in window)) { items.forEach(show); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      show(entry.target);
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
  items.forEach((el) => io.observe(el));
}

/* ---------------------------------------------------------------- intro: fly through the logo */
// One scrubbed value p (0 to 1) drives the whole scene through render(), so every element stays
// in lockstep and the ScrollTrigger scrub smoothing applies to all of it at once.
let introTrigger = null;
function initIntro() {
  const wrap = $('[data-intro-wrap]');
  const intro = $('[data-intro]');
  if (!wrap || !intro) return null;
  if (reduceMotion || root.classList.contains('intro-skip')) {
    root.classList.add('intro-skip', 'hero-go');
    return null;
  }
  window.__scaliumIntro = true;

  const heroLayers = $$('.hero__grid, .hero__bg', wrap);
  const bg = $('.intro__bg', intro);
  const mark = $('[data-intro-mark]', intro);
  const blade = $('.intro__blade', intro);
  const arrow = $('.intro__arrow', intro);
  const sheen = $('.intro__sheen', intro);
  const bloom = $('[data-intro-bloom]', intro);
  const cue = $('[data-intro-cue]', intro);
  const letters = $$('.intro__letter', intro).map((el) => ({ el, dx: parseFloat(el.style.getPropertyValue('--dx')) || 0 }));
  const rings = $$('.intro__ring', intro).map((el) => ({ el, z: parseFloat(el.style.getPropertyValue('--z')) || 0 }));

  // Light streaks for the warp, spread deterministically so every visit looks the same.
  const streakWrap = $('[data-intro-streaks]', intro);
  const count = window.innerWidth < 700 ? 18 : 30;
  const streaks = Array.from({ length: count }, (_, i) => {
    const el = document.createElement('span');
    el.className = 'intro__streak';
    streakWrap.appendChild(el);
    const r = Math.abs((Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1);
    return { el, angle: (i / count) * 360 + r * 10, r0: 5 + r * 14, len: 0.6 + r * 1.2, delay: r * 0.12 };
  });

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const TRAVEL = 4700;
  let heroGo = false;

  const render = (p) => {
    // Wordmark: each letter flies at the camera and fans out from the centre.
    const pl = smooth(0, 0.42, p);
    const lo = 1 - smooth(0.1, 0.38, p);
    letters.forEach(({ el, dx }) => {
      el.style.transform = `translate3d(${dx * 30 * pl}vw, ${pl * 9}vh, ${pl * (560 + 340 * (1 - Math.abs(dx)))}px) rotateY(${dx * 48 * pl}deg) rotateX(${-16 * pl}deg)`;
      el.style.opacity = lo;
    });

    // Mark: drifts to the centre, rushes toward the camera, then splits so we pass between the halves.
    const pm = smooth(0.02, 0.82, p);
    const center = smooth(0.04, 0.42, p);
    mark.style.transform = `translateY(calc(var(--logo-w) * ${0.14 * center})) translateZ(${Math.pow(pm, 1.5) * 860}px) rotateX(${pm * 12}deg)`;
    const ps = smooth(0.2, 0.86, p);
    const mo = 1 - smooth(0.7, 0.9, p);
    blade.style.transform = `translate3d(${-ps * 42}vw, ${ps * 26}vh, ${ps * 140}px) rotateZ(${-ps * 16}deg) rotateY(${ps * 42}deg)`;
    arrow.style.transform = `translate3d(${ps * 30}vw, ${-ps * 38}vh, ${ps * 180}px) rotateZ(${ps * 10}deg) rotateY(${-ps * 40}deg)`;
    blade.style.opacity = mo;
    arrow.style.opacity = mo;
    sheen.style.opacity = 1 - smooth(0.01, 0.1, p);

    // Rings: a tunnel that streams past the camera.
    const travel = Math.pow(smooth(0, 0.95, p), 1.15) * TRAVEL;
    rings.forEach(({ el, z: z0 }) => {
      const z = z0 + travel;
      el.style.transform = `translateZ(${z}px)`;
      el.style.opacity = (clamp01((z + 4400) / 1700) * (1 - clamp01((z - 420) / 420)) * 0.85).toFixed(3);
    });

    // Warp streaks.
    streaks.forEach((s) => {
      const t = clamp01((p - 0.1 - s.delay) / 0.68);
      s.el.style.transform = `rotate(${s.angle}deg) translateX(${s.r0 + t * t * 120}vmin) scaleX(${s.len * (0.3 + t * 3.4)})`;
      s.el.style.opacity = (Math.sin(Math.PI * t) * 0.9).toFixed(3);
    });

    // Light opens up and the scene dissolves onto the hero, which settles from a slight zoom.
    bloom.style.transform = `scale(${0.15 + smooth(0.42, 0.82, p) * 3.4})`;
    bloom.style.opacity = (Math.sin(Math.PI * clamp01((p - 0.42) / 0.38)) * 0.8).toFixed(3);
    bg.style.opacity = 1 - smooth(0.6, 0.84, p);
    intro.style.opacity = 1 - smooth(0.8, 0.95, p);
    intro.style.visibility = p > 0.995 ? 'hidden' : '';
    cue.style.opacity = 1 - smooth(0, 0.06, p);
    const settle = 1 + 0.12 * (1 - smooth(0.56, 0.98, p));
    heroLayers.forEach((el) => { el.style.transform = settle > 1.0005 ? `scale(${settle})` : ''; });

    if (!heroGo && p >= 0.58) { heroGo = true; root.classList.add('hero-go'); }
    root.classList.toggle('intro-done', p >= 0.78);
  };

  const state = { p: 0 };
  render(0);
  const tween = gsap.to(state, {
    p: 1,
    ease: 'none',
    onUpdate: () => render(state.p),
    scrollTrigger: {
      trigger: wrap,
      start: 'top top',
      end: () => `+=${Math.round(window.innerHeight * (window.innerWidth < 700 ? 1.5 : 1.9))}`,
      pin: true,
      scrub: 1.1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      // A reload or back-navigation can restore the page mid-way or below the intro without a
      // scroll event, so sync the scene to wherever the page actually is.
      onRefresh: (self) => { state.p = self.progress; render(self.progress); },
    },
  });
  introTrigger = tween.scrollTrigger;
  render(introTrigger.progress);
  return wrap;
}

/* ---------------------------------------------------------------- hero */
function initHero(introWrap) {
  const hero = $('.hero');
  if (!hero) return;
  const tilt = $('[data-tilt]', hero);
  const copy = $('[data-hero-copy]', hero);

  // Pause the light trails while the hero is off screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => hero.classList.toggle('is-offscreen', !entry.isIntersecting)).observe(hero);
  }
  if (reduceMotion) return;

  // The dashboard leans toward the cursor, like a physical panel.
  if (finePointer && tilt) {
    const rx = gsap.quickTo(tilt, 'rotationX', { duration: 1.4, ease: 'power3' });
    const ry = gsap.quickTo(tilt, 'rotationY', { duration: 1.4, ease: 'power3' });
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      ry(x * 7);
      rx(y * -5);
    });
    hero.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }

  // On scroll the copy lifts away and the dashboard tips back into depth.
  const tl = gsap.timeline({
    // Inside the intro's pinned wrapper, positions are measured after the pin releases.
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6, ...(introWrap ? { pinnedContainer: introWrap } : {}) },
  });
  if (copy) tl.to(copy, { y: -80, opacity: 0, ease: 'none' }, 0);
  if (tilt) tl.to(tilt, { y: -40, z: -120, opacity: 0.25, ease: 'none' }, 0);
}

/* ---------------------------------------------------------------- statement: words light up as you read */
function splitWords(el) {
  const text = el.textContent.trim();
  el.textContent = '';
  const frag = document.createDocumentFragment();
  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
    const span = document.createElement('span');
    span.className = 'w';
    span.textContent = part;
    frag.appendChild(span);
  });
  el.appendChild(frag);
  return $$('.w', el);
}

function initStatement() {
  const el = $('[data-scrub-words]');
  if (!el || reduceMotion) return;
  let tween;
  const build = () => {
    if (tween) { tween.scrollTrigger?.kill(); tween.kill(); }
    const words = splitWords(el);
    tween = gsap.fromTo(words, { opacity: 0.4 }, { // 0.4 keeps unread words above 3:1 contrast
      opacity: 1,
      ease: 'none',
      stagger: 0.1,
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 42%', scrub: 0.5 },
    });
  };
  build();
  document.addEventListener('langchange', build);
}

/* ---------------------------------------------------------------- services: sticky stage follows the active service */
function initServices() {
  const wrap = $('[data-services]');
  if (!wrap) return;
  const blocks = $$('[data-service]', wrap);
  const slides = $$('[data-slide]', wrap);
  const dots = $$('.stage__progress span', wrap);
  const scan = $('[data-scan]', wrap);
  let current = 0;

  const setActive = (i) => {
    if (i === current) return;
    current = i;
    blocks.forEach((b, n) => b.classList.toggle('is-active', n === i));
    slides.forEach((s, n) => {
      s.classList.toggle('is-active', n === i);
      s.classList.toggle('is-past', n < i);
    });
    dots.forEach((d, n) => d.classList.toggle('is-active', n === i));
    if (scan && !reduceMotion) {
      scan.classList.remove('is-running');
      void scan.offsetWidth; // restart the animation
      scan.classList.add('is-running');
    }
  };

  const mm = gsap.matchMedia();
  mm.add(DESKTOP, () => {
    blocks.forEach((block, i) => {
      ScrollTrigger.create({
        trigger: block,
        start: 'top 55%',
        end: 'bottom 55%',
        onToggle: (self) => { if (self.isActive) setActive(i); },
      });
    });
    return () => blocks.forEach((b) => b.classList.add('is-active'));
  });
  mm.add('(max-width: 960px)', () => {
    blocks.forEach((b) => b.classList.add('is-active'));
  });
}

/* ---------------------------------------------------------------- process: horizontal track on desktop, drawn timeline on mobile */
function initProcess() {
  const section = $('.process');
  const pin = $('[data-process]');
  const track = $('[data-process-track]');
  const stepsWrap = $('[data-process-steps]');
  const fill = $('[data-process-fill]');
  const head = $('[data-process-head]');
  const steps = $$('[data-step]');
  if (!section || !pin || !track || !stepsWrap) return;

  if (reduceMotion) {
    steps.forEach((s) => s.classList.add('is-lit'));
    if (fill) fill.style.transform = 'none';
    return;
  }

  const mm = gsap.matchMedia();
  mm.add(DESKTOP, () => {
    section.classList.add('is-horizontal');
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    // The beam sits at 62% of the viewport and slides to the right edge as the pin completes,
    // so the last stage lights up before the section releases.
    const update = (t = 0) => {
      const x = Number(gsap.getProperty(track, 'x')) || 0;
      const lineW = stepsWrap.offsetWidth;
      const focus = -x + window.innerWidth * (0.62 + 0.38 * t) - stepsWrap.offsetLeft;
      const p = gsap.utils.clamp(0, 1, focus / lineW);
      gsap.set(fill, { scaleX: p });
      gsap.set(head, { x: p * lineW });
      steps.forEach((s) => s.classList.toggle('is-lit', s.offsetLeft <= focus));
    };

    let tween = null; // assigned below; ScrollTrigger may refresh while the tween is being created
    tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      onUpdate() { update(this.progress()); },
      scrollTrigger: {
        trigger: pin,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onToggle: (self) => section.classList.toggle('is-active', self.isActive),
        onRefresh: () => update(tween ? tween.progress() : 0),
      },
    });

    return () => {
      section.classList.remove('is-horizontal', 'is-active');
      gsap.set([track, fill, head], { clearProps: 'all' });
    };
  });

  mm.add('(max-width: 960px)', () => {
    gsap.fromTo(fill, { scaleY: 0 }, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: stepsWrap, start: 'top 72%', end: 'bottom 60%', scrub: 0.4 },
    });
    steps.forEach((s) => {
      ScrollTrigger.create({ trigger: s, start: 'top 72%', onEnter: () => s.classList.add('is-lit'), onLeaveBack: () => s.classList.remove('is-lit') });
    });
    return () => gsap.set(fill, { clearProps: 'all' });
  });
}

/* ---------------------------------------------------------------- results: dashboard grows into place, numbers count */
function initResults() {
  const media = $('[data-zoom] picture');
  if (media && !reduceMotion) {
    gsap.fromTo(media, { scale: 0.84, opacity: 0.35 }, {
      scale: 1,
      opacity: 1,
      ease: 'none',
      scrollTrigger: { trigger: '[data-zoom]', start: 'top 96%', end: 'top 28%', scrub: 0.6 },
    });
  }

  const counters = $$('[data-count]');
  if (!counters.length || reduceMotion || !('IntersectionObserver' in window)) return;
  counters.forEach((el) => { el.textContent = `${el.dataset.sign || ''}0%`; });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const state = { v: 0 };
      gsap.to(state, {
        v: Number(el.dataset.count),
        duration: 1.8,
        ease: 'power3.out',
        onUpdate: () => { el.textContent = `${el.dataset.sign || ''}${Math.round(state.v)}%`; },
      });
      io.unobserve(el);
    });
  }, { threshold: 0.6 });
  counters.forEach((el) => io.observe(el));
}

/* ---------------------------------------------------------------- closing scene */
function initCta() {
  const media = $('[data-cta-media] picture');
  if (!media || reduceMotion) return;
  gsap.fromTo(media, { scale: 1.2, yPercent: 10 }, {
    scale: 1,
    yPercent: 0,
    ease: 'none',
    scrollTrigger: { trigger: '.cta', start: 'top 85%', end: 'bottom bottom', scrub: 0.6 },
  });
}

/* ---------------------------------------------------------------- boot */
function boot() {
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  initTransitions();
  initAnchors();
  initMenu();
  initNav();
  initReveal();
  const introWrap = initIntro();
  initHero(introWrap);
  initStatement();
  initServices();
  initProcess();
  initResults();
  initCta();

  // Copy length changes with the language, so pinned distances must be measured again.
  // Done synchronously: a deferred refresh would cancel a smooth scroll the visitor starts right after.
  document.addEventListener('langchange', () => ScrollTrigger.refresh());

  const settle = () => {
    ScrollTrigger.refresh();
    // Arriving on index.html#section from another page: re-aim once pin spacers exist.
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) scrollToEl(target, 'auto');
    }
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
  else window.addEventListener('load', settle);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
