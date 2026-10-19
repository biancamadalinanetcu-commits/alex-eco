// Scalium interactions.
// CSS owns the intro animation (so first paint never waits on this file); GSAP + ScrollTrigger
// own everything tied to scroll position. Every effect has a reduced-motion path.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

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

/* ---------------------------------------------------------------- smooth scroll
   Wheel and trackpad scrolling glide with a little inertia (Lenis), and every scroll-driven
   animation reads that same smoothed position, so pins and scrubs move as one. Touch keeps the
   phone's native scrolling; reduced motion keeps the browser's. */
let lenis = null;
function initSmoothScroll() {
  if (reduceMotion || !finePointer) return;
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, anchors: false, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollToY(top, immediate = reduceMotion) {
  if (lenis) {
    const distance = Math.abs(top - window.scrollY);
    lenis.scrollTo(top, { immediate, force: true, duration: Math.min(1.8, 0.8 + distance / 6000) });
  } else {
    window.scrollTo({ top, behavior: immediate ? 'auto' : 'smooth' });
  }
}

function scrollToEl(el, immediate = reduceMotion) {
  const top = el === document.body ? 0 : el.getBoundingClientRect().top + window.scrollY - navHeight() + 1;
  scrollToY(top, immediate);
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
    // "Skip to content" lands on the opened hero, not the closed logo intro.
    if (target.id === 'main' && introTrigger) scrollToY(introTrigger.end);
    else scrollToEl(target);
    // Move keyboard focus with the scroll, so the next Tab continues from the target.
    if (!target.matches('a[href], button, input, select, textarea, [tabindex]')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    // Keep the section in the address without adding history entries Back would have to step through.
    history.replaceState(history.state, '', url.hash);
  });

  $('[data-to-top]')?.addEventListener('click', () => {
    // With the logo intro, "top" means the opened hero, not the closed logo.
    scrollToY(introTrigger ? introTrigger.end : 0);
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
  // The overlay covers the page, so Tab must not wander into the content behind it.
  $$('main, footer').forEach((el) => { el.inert = open; });
  if (open) {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    root.style.overflow = 'hidden';
    lenis?.stop();
    $('[data-nav]')?.classList.add('is-scrolled');
  } else {
    menu.classList.remove('is-open');
    root.style.overflow = '';
    lenis?.start();
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
  const items = $$('[data-reveal], [data-reveal-media], [data-dash]');
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
  // A reload lands back on the closed logo, so the intro plays from the start. The browser reads the
  // restoration mode when the page is left, so set it then; back/forward keeps the visitor's place
  // (the head script switches it back to 'auto' for those) and onRefresh syncs the scene there.
  if ('scrollRestoration' in history) window.addEventListener('pagehide', () => { history.scrollRestoration = 'manual'; });
  if (!window.__scaliumBack) {
    // On a slow connection the visitor may already be reading further down: skip the intro then.
    if (window.scrollY > 4) { root.classList.add('intro-skip', 'hero-go'); return null; }
    ScrollTrigger.clearScrollMemory('manual');
    window.scrollTo(0, 0);
  }

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
      // Lenis already smooths the scroll itself, so less scrub lag keeps the same glide without delay.
      scrub: lenis ? 0.7 : 1.1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      // A reload or back-navigation can restore the page mid-way or below the intro without a
      // scroll event, so sync the scene to wherever the page actually is.
      onRefresh: (self) => { state.p = self.progress; render(self.progress); },
    },
  });
  introTrigger = tween.scrollTrigger;
  render(introTrigger.progress);

  // Keyboard visitors skip the scroll animation: the first Tab opens the hero, so focus is never on
  // something still hidden behind the logo.
  const openForKeyboard = (e) => {
    if (e.key !== 'Tab') return;
    document.removeEventListener('keydown', openForKeyboard, true);
    if (introTrigger.progress < 1) {
      scrollToY(introTrigger.end, true);
      tween.progress(1);
      render(1);
    }
  };
  document.addEventListener('keydown', openForKeyboard, true);
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
    new IntersectionObserver((entries) => hero.classList.toggle('is-offscreen', !entries[entries.length - 1].isIntersecting)).observe(hero);
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

/* ---------------------------------------------------------------- passage: statement into services
   One scrubbed value p (0 to 1) drives a minimal 3D scene: a grid floor unfolds up to a glowing horizon
   and streams toward you, thin frames rush past, the section name surfaces in the middle, and everything
   folds away as the services arrive. Meanwhile the statement above tilts back into the floor. */
function initShift() {
  const shift = $('[data-shift]');
  if (!shift || reduceMotion) return;
  const stage = $('[data-shift-stage]', shift);
  const floor = $('[data-shift-floor]', shift);
  const horizon = $('[data-shift-horizon]', shift);
  const label = $('[data-shift-label]', shift);
  const gates = $$('.shift__gate', shift);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const CELL = 120;

  const render = (p) => {
    // The stage is fully on screen (sticky) for p of about 0.38 to 0.62: it unfolds as it arrives
    // and has folded away before it scrolls off, so nothing sits behind the services heading.
    const open = smooth(0.14, 0.4, p) * (1 - smooth(0.58, 0.72, p));
    const travel = p * CELL * 22;
    floor.style.transform = `rotateX(${(90 - 15 * open).toFixed(2)}deg) translate3d(0, ${(-CELL + (travel % CELL)).toFixed(1)}px, 0)`;
    floor.style.opacity = open.toFixed(3);
    horizon.style.transform = `scaleX(${open.toFixed(3)})`;
    stage.style.setProperty('--open', open.toFixed(3));
    gates.forEach((g, i) => {
      const z = -3000 + i * 850 + p * 3900;
      g.style.transform = `translate3d(-50%, -50%, ${z.toFixed(0)}px)`;
      g.style.opacity = (clamp01((z + 3000) / 1400) * (1 - clamp01((z - 150) / 450)) * open).toFixed(3);
    });
    const l = smooth(0.37, 0.46, p) * (1 - smooth(0.55, 0.63, p));
    label.style.opacity = l.toFixed(3);
    label.style.transform = `translate3d(-50%, -50%, ${(-420 + 560 * smooth(0.37, 0.63, p)).toFixed(0)}px)`;
  };

  const state = { p: 0 };
  render(0);
  gsap.to(state, {
    p: 1,
    ease: 'none',
    onUpdate: () => render(state.p),
    scrollTrigger: {
      trigger: shift,
      start: 'top bottom',
      end: 'bottom top',
      scrub: lenis ? 0.3 : 0.6,
      onRefresh: (self) => { state.p = self.progress; render(self.progress); },
    },
  });

  // the statement tips back into the floor as the passage opens
  const text = $('.statement .container');
  if (text) {
    // the perspective stays fixed; tweening it from 0 would snap the text into its final slant at once
    gsap.set(text, { transformPerspective: 1100, transformOrigin: '50% 100%' });
    gsap.to(text, {
      rotationX: 34,
      z: -160,
      opacity: 0.08,
      ease: 'none',
      scrollTrigger: { trigger: shift, start: 'top 55%', end: 'top top', scrub: lenis ? 0.3 : 0.6 },
    });
  }
}

/* ---------------------------------------------------------------- headings rise word by word
   Each word sits in its own mask and slides up when the heading's section scrolls into view
   (the reveal observer adds .is-in). Screen readers get the plain sentence from aria-label. */
function splitHeading(el) {
  const label = el.textContent.replace(/\s+/g, ' ').trim();
  let n = 0;
  const wrapText = (node) => {
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
      const mask = document.createElement('span');
      mask.className = 'wm';
      const inner = document.createElement('span');
      inner.textContent = part;
      inner.style.setProperty('--wi', String(n++));
      mask.appendChild(inner);
      frag.appendChild(mask);
    });
    node.replaceWith(frag);
  };
  const walk = (parent) => {
    Array.from(parent.childNodes).forEach((node) => {
      if (node.nodeType === 3) wrapText(node);
      else if (node.nodeType === 1 && !node.classList.contains('wm')) walk(node);
    });
  };
  walk(el);
  el.setAttribute('aria-label', label);
  $$('.wm', el).forEach((w) => w.setAttribute('aria-hidden', 'true'));
}

function initHeadings() {
  const headings = $$('[data-split]');
  if (!headings.length || reduceMotion) return;
  const run = () => headings.forEach(splitHeading);
  run();
  // The language switch rewrites the text, so split the new words again.
  document.addEventListener('langchange', run);
}

/* ---------------------------------------------------------------- services: the stage opens like a curtain */
function initStage() {
  const frame = $('.stage__frame');
  if (!frame || reduceMotion) return;
  const mm = gsap.matchMedia();
  mm.add(DESKTOP, () => {
    gsap.fromTo(frame, { clipPath: 'inset(16% 12% 16% 12% round 28px)', scale: 0.94, rotationX: 22, transformPerspective: 1600, transformOrigin: '50% 100%' }, {
      clipPath: 'inset(0% 0% 0% 0% round 28px)',
      scale: 1,
      rotationX: 0,
      ease: 'none',
      scrollTrigger: { trigger: '.services__layout', start: 'top 95%', end: 'top 30%', scrub: 0.6 },
    });
    return () => gsap.set(frame, { clearProps: 'clipPath,transform,transformOrigin' });
  });
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
  if (!section || !pin || !track || !stepsWrap || !fill || !head) return;

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
    // Cards ahead of the beam stand turned away on their hinge (the node on the line) and swing
    // flat to face the visitor as the beam reaches them, like pages of a timeline opening in 3D.
    const setFill = gsap.quickSetter(fill, 'scaleX');
    const setHead = gsap.quickSetter(head, 'x', 'px');
    const update = (t = 0) => {
      const x = Number(gsap.getProperty(track, 'x')) || 0;
      const vw = window.innerWidth;
      const lineW = stepsWrap.offsetWidth;
      const focus = -x + vw * (0.62 + 0.38 * t) - stepsWrap.offsetLeft;
      const p = gsap.utils.clamp(0, 1, focus / lineW);
      setFill(p);
      setHead(p * lineW);
      steps.forEach((s) => {
        s.classList.toggle('is-lit', s.offsetLeft <= focus);
        const ahead = gsap.utils.clamp(0, 1, (s.offsetLeft - focus) / (vw * 0.42));
        const eased = ahead * ahead * (3 - 2 * ahead);
        s.style.transform = eased > 0.001 ? `perspective(1100px) rotateY(${(58 * eased).toFixed(2)}deg)` : '';
      });
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
        scrub: lenis ? 0.5 : 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onToggle: (self) => section.classList.toggle('is-active', self.isActive),
        onRefresh: () => update(tween ? tween.progress() : 0),
      },
    });

    return () => {
      section.classList.remove('is-horizontal', 'is-active');
      gsap.set([track, fill, head], { clearProps: 'all' });
      steps.forEach((s) => { s.style.transform = ''; });
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
    // The dashboard starts tipped back like a screen lying down and rises upright as it zooms in.
    gsap.fromTo(media, { scale: 0.84, opacity: 0.35, rotationX: 30, transformPerspective: 1500, transformOrigin: '50% 100%' }, {
      scale: 1,
      opacity: 1,
      rotationX: 0,
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
  gsap.fromTo(media, { scale: 1.1, yPercent: 8, transformOrigin: '50% 100%' }, {
    scale: 1,
    yPercent: 0,
    ease: 'none',
    scrollTrigger: { trigger: '.cta', start: 'top 85%', end: 'bottom bottom', scrub: 0.6 },
  });
}

/* ---------------------------------------------------------------- contact form
   Validates in the browser, sends in the background and shows the result in place.
   Static site: FormSubmit emails the request. WordPress: the theme's own handler does. */
function initContactForm() {
  const form = $('[data-contact-form]');
  if (!form) return;
  const body = $('[data-form-body]', form);
  const done = $('[data-form-done]', form);
  const submit = $('.form__submit', form);
  form.noValidate = true; // inline errors below replace the browser's bubbles
  if (!done.hidden) done.classList.add('is-in'); // WordPress ?sent=1 result page
  const status = (which) => $$('[data-status]', form).forEach((el) => { el.hidden = el.dataset.status !== which; });

  const rules = {
    service: () => $$('input[name="service[]"]:checked', form).length > 0,
    name: () => form.elements.name.value.trim().length >= 2,
    email: () => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.elements.email.value.trim()),
    phone: () => {
      const v = form.elements.phone.value.trim();
      return /^[+\d\s().\/-]+$/.test(v) && v.replace(/\D/g, '').length >= 7;
    },
  };
  const control = (name) => (name === 'service' ? $('[data-field="service"]', form) : form.elements[name]);
  const touched = new Set();
  // The error text is linked to its field only while it is showing, so screen readers announce it then.
  const check = (name) => {
    const ok = rules[name]();
    $(`[data-error-for="${name}"]`, form).hidden = ok;
    const el = control(name);
    el.classList.toggle('is-invalid', !ok);
    if (ok) el.removeAttribute('aria-describedby');
    else el.setAttribute('aria-describedby', `err-${name}`);
    const inputs = name === 'service' ? $$('input[name="service[]"]', form) : [el];
    inputs.forEach((i) => i.setAttribute('aria-invalid', String(!ok)));
    return ok;
  };

  // Errors appear once a field has been left, and clear as soon as it is fixed.
  form.addEventListener('focusout', (e) => {
    const name = e.target.name;
    if (name in rules && name !== 'service' && e.target.value.trim()) { touched.add(name); check(name); }
  });
  form.addEventListener('input', (e) => {
    const name = e.target.name;
    if (name in rules && touched.has(name)) check(name);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.classList.contains('is-sending')) return;
    const invalid = Object.keys(rules).filter((name) => !check(name));
    Object.keys(rules).forEach((name) => touched.add(name));
    if (invalid.length) {
      const first = invalid[0] === 'service' ? $('input[name="service[]"]', form) : form.elements[invalid[0]];
      first.focus();
      return;
    }

    const showDone = () => {
      body.hidden = true;
      done.hidden = false;
      requestAnimationFrame(() => done.classList.add('is-in'));
      $('.form__title', done).focus({ preventScroll: true });
      const top = form.getBoundingClientRect().top;
      if (top < navHeight() || top > window.innerHeight * 0.6) scrollToEl(form);
    };
    // Bots fill the hidden field; let them think it worked.
    if (form.elements._honey.value) { showDone(); return; }

    const fd = new FormData(form);
    const data = new URLSearchParams();
    data.set('service', fd.getAll('service[]').join(', '));
    ['name', 'email', 'phone', 'message', 'language'].forEach((k) => data.set(k, String(fd.get(k) || '').trim()));
    data.set('_subject', `${fd.get('_subject')}: ${data.get('name')}`);
    data.set('_template', String(fd.get('_template')));
    data.set('_honey', '');

    form.classList.add('is-sending');
    submit.disabled = true;
    status('sending');
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 20000);
    try {
      const res = await fetch(form.dataset.endpoint || form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data,
        signal: abort.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false || json.success === 'false') throw new Error(json.message || `HTTP ${res.status}`);
      status(null);
      form.reset();
      touched.clear();
      showDone();
    } catch (err) {
      status('fail');
    } finally {
      clearTimeout(timer);
      form.classList.remove('is-sending');
      submit.disabled = false;
      // disabling the button while sending dropped keyboard focus; give it back so "try again" is one key away
      if (!body.hidden && (!document.activeElement || document.activeElement === document.body)) submit.focus({ preventScroll: true });
    }
  });

  $('[data-form-again]', form)?.addEventListener('click', () => {
    done.classList.remove('is-in');
    done.hidden = true;
    body.hidden = false;
    form.elements.name.focus();
  });
}

/* ---------------------------------------------------------------- boot */
// Each feature starts on its own: one failing (an old browser, a blocked API) never takes the others down.
function safe(fn, ...args) {
  try { return fn(...args); } catch (err) { console.error(err); return null; }
}

function boot() {
  window.__scaliumBoot = true;
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  safe(initSmoothScroll);
  const introWrap = safe(initIntro); // first, so nothing else can keep the logo intro from starting
  safe(initTransitions);
  safe(initAnchors);
  safe(initMenu);
  safe(initNav);
  safe(initHeadings);
  safe(initReveal);
  safe(initHero, introWrap);
  safe(initStatement);
  safe(initShift);
  safe(initStage);
  safe(initServices);
  safe(initProcess);
  safe(initResults);
  safe(initCta);
  safe(initContactForm);

  // Copy length changes with the language, so pinned distances must be measured again.
  // Done synchronously: a deferred refresh would cancel a smooth scroll the visitor starts right after.
  document.addEventListener('langchange', () => ScrollTrigger.refresh());

  // Back/forward keeps the visitor's place. Browsers only restore it from their page cache, and the
  // home page leaves in 'manual' mode so a reload replays the intro, so the place is kept here too.
  const placeKey = `scalium-y:${location.pathname}`;
  window.addEventListener('pagehide', () => {
    try { sessionStorage.setItem(placeKey, String(Math.round(window.scrollY))); } catch (e) { /* storage off */ }
  });

  const settle = () => {
    ScrollTrigger.refresh();
    if (window.__scaliumBack && !location.hash) {
      let place = NaN;
      try { place = Number(sessionStorage.getItem(placeKey)); } catch (e) { /* storage off */ }
      if (place > 0 && Math.abs(window.scrollY - place) > 40) scrollToY(place, true);
    }
    // Arriving on index.html#section from another page: re-aim once pin spacers exist.
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) scrollToEl(target, true);
    }
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
  else window.addEventListener('load', settle);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
