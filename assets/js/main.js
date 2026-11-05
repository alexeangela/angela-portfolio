/* Angela Alexe · interazioni del sito */
const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const narrowQuery = window.matchMedia('(max-width: 899px)');
const isMobile = narrowQuery.matches || coarsePointer || !finePointer;
const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
if (!reduceMotion && hasGSAP) root.classList.add('motion');

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

/* ---------- Scroll: Lenis solo su desktop con mouse. Sul telefono resta lo scroll nativo. ---------- */
let lenis = null;
const enableLenis = !reduceMotion && finePointer && !coarsePointer && window.innerWidth >= 1024 && typeof window.Lenis !== 'undefined';
if (enableLenis) {
  lenis = new window.Lenis({ duration: 1.15, smoothWheel: true, syncTouch: false, anchors: false });
  if (hasGSAP) {
    lenis.on('scroll', window.ScrollTrigger.update);
    window.gsap.ticker.add((time) => lenis.raf(time * 1000));
    window.gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
}
function scrollToTarget(target) {
  const behavior = reduceMotion ? 'auto' : 'smooth';
  if (typeof target === 'number') {
    if (lenis) lenis.scrollTo(target, { duration: reduceMotion ? 0 : 1.1 });
    else window.scrollTo({ top: target, behavior });
    return;
  }
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  if (lenis) {
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    lenis.scrollTo(el, { offset: -pad, duration: reduceMotion ? 0 : 1.15 });
  } else {
    el.scrollIntoView({ behavior, block: 'start' });
  }
}
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) { e.preventDefault(); closeMenu(); scrollToTarget(0); return; }
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault(); closeMenu();
    scrollToTarget(el);
  });
});

/* ---------- Header che si nasconde scendendo ---------- */
const header = document.querySelector('.site-header');
let lastY = 0;
function onScrollHeader(y) {
  if (menuOpen) return;
  header.classList.toggle('is-hidden', y > lastY && y > 200);
  lastY = y;
}

/* ---------- Menu mobile ---------- */
const toggle = document.querySelector('.menu-toggle');
const menu = document.getElementById('menu');
let menuOpen = false;
let lockY = 0;
function lockScroll() {
  lockY = window.scrollY || document.documentElement.scrollTop || 0;
  root.classList.add('menu-open');
  document.body.style.position = 'fixed';
  document.body.style.top = `-${lockY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  lenis?.stop();
  water?.setPaused?.(true);
}
function unlockScroll() {
  root.classList.remove('menu-open');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  lenis?.start();
  window.scrollTo(0, lockY);
  if (lenis) lenis.scrollTo(lockY, { immediate: true });
  water?.setPaused?.(false);
}
function openMenu() {
  menuOpen = true; menu.hidden = false;
  menu.classList.add('is-open');
  toggle.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-label', 'Chiudi il menu');
  header.classList.remove('is-hidden');
  lockScroll();
  menu.querySelector('a')?.focus({ preventScroll: true });
}
function closeMenu() {
  if (!menuOpen) return;
  menuOpen = false; menu.classList.remove('is-open');
  menu.hidden = true;
  toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Apri il menu');
  unlockScroll();
}
toggle.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
menu.querySelectorAll('a[href^="http"]').forEach((a) => a.addEventListener('click', () => closeMenu()));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) { closeMenu(); toggle.focus(); } });
window.matchMedia('(min-width: 900px)').addEventListener('change', (m) => { if (m.matches) closeMenu(); });

/* ---------- Intro dei lavori: sopra le card in verticale, dentro la fila in orizzontale ---------- */
const worksIntro = document.querySelector('.works__intro');
const worksTrack = document.querySelector('.works__track');
const worksPin = document.querySelector('.works__pin');
const introInside = window.matchMedia('(min-width: 1024px) and (min-height: 600px) and (hover: hover) and (pointer: fine), (orientation: landscape) and (max-height: 540px), (min-width: 900px) and (orientation: landscape)');
function placeIntro() {
  if (introInside.matches && worksIntro.parentElement !== worksTrack) worksTrack.prepend(worksIntro);
  else if (!introInside.matches && worksIntro.parentElement === worksTrack) worksPin.prepend(worksIntro);
}
placeIntro();
introInside.addEventListener('change', () => { placeIntro(); if (hasGSAP) window.ScrollTrigger.refresh(); });

/* ---------- Manifesto: parole che si accendono ---------- */
const manifesto = document.querySelector('[data-words]');
function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
          else { const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.appendChild(s); }
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) walk(child);
    });
  };
  walk(el);
  return el.querySelectorAll('.w');
}

/* ---------- Acqua WebGL ---------- */
let water = null;
const canvas = document.getElementById('water');
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
function staticWaterPreferred() {
  if (reduceMotion) return true;
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')) return true;
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) return true;
  return false;
}
async function batteryTooLow() {
  try {
    if (!isMobile || typeof navigator.getBattery !== 'function') return false;
    const battery = await navigator.getBattery();
    return !battery.charging && battery.level > 0 && battery.level <= 0.15;
  } catch { return false; }
}
async function startWater() {
  if (staticWaterPreferred() || await batteryTooLow()) { root.classList.add('no-webgl'); return; }
  if (!webglOK()) { root.classList.add('no-webgl'); return; }
  try {
    const { createWater } = await import('./water.js');
    water = createWater(canvas, {
      mobile: isMobile,
      onLost() {
        water = null;
        root.classList.remove('webgl-ready');
        root.classList.add('no-webgl');
      },
    });
    root.classList.add('webgl-ready');
    const title = document.querySelector('.hero__title');
    const drawTitle = () => water && water.setTitle(title);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      drawTitle();
      // il riflesso compare dopo l'entrata del titolo
      const t0 = performance.now();
      const fade = (now) => { const k = Math.min((now - t0) / 1600, 1); water.showTitle(k); if (k < 1) requestAnimationFrame(fade); };
      setTimeout(() => requestAnimationFrame(fade), reduceMotion ? 0 : 900);
    });
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawTitle, 200); });
    // prima goccia di benvenuto
    setTimeout(() => water && water.drop(window.innerWidth * 0.62, window.innerHeight * 0.55, 1.2), reduceMotion ? 0 : 1200);
  } catch (err) {
    root.classList.add('no-webgl');
    console.warn('Acqua WebGL non disponibile:', err);
  }
}

/* Puntatore → acqua. Lo scroll verticale col dito non genera onde e non blocca la pagina. */
let lastDrop = { x: -999, y: -999, t: 0 };
let gesture = null;
window.addEventListener('pointerdown', (e) => {
  gesture = { x: e.clientX, y: e.clientY, type: e.pointerType, scroll: false, t: performance.now() };
  if (e.pointerType === 'mouse') {
    water?.drop(e.clientX, e.clientY, 1.1);
    water?.pointer(e.clientX, e.clientY);
  }
}, { passive: true });
window.addEventListener('pointermove', (e) => {
  if (!water) return;
  if (e.pointerType !== 'mouse') {
    if (!gesture) return;
    const dx = e.clientX - gesture.x;
    const dy = e.clientY - gesture.y;
    if (!gesture.scroll && Math.hypot(dx, dy) > 12 && Math.abs(dy) >= Math.abs(dx)) gesture.scroll = true;
    if (gesture.scroll) return;
  }
  water.pointer(e.clientX, e.clientY);
  const now = performance.now();
  const d = Math.hypot(e.clientX - lastDrop.x, e.clientY - lastDrop.y);
  if (d > (e.pointerType === 'mouse' ? 70 : 36) && now - lastDrop.t > 90) {
    water.drop(e.clientX, e.clientY, e.pointerType === 'mouse' ? 0.35 : 0.45);
    lastDrop = { x: e.clientX, y: e.clientY, t: now };
  }
}, { passive: true });
document.addEventListener('pointerleave', () => water?.pointerLeave());
window.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'mouse') return;
  const g = gesture;
  gesture = null;
  if (!water) return;
  const moved = g ? Math.hypot(e.clientX - g.x, e.clientY - g.y) : 99;
  if (g && !g.scroll && moved < 16) {
    water.drop(e.clientX, e.clientY, 1);
    water.pointer(e.clientX, e.clientY);
  }
  setTimeout(() => water?.pointerLeave(), 650);
}, { passive: true });
window.addEventListener('pointercancel', () => { gesture = null; water?.pointerLeave(); }, { passive: true });

if (isMobile) {
  let scrollIdle;
  window.addEventListener('scroll', () => {
    if (menuOpen) return;
    water?.setPaused?.(true);
    clearTimeout(scrollIdle);
    scrollIdle = setTimeout(() => { if (!menuOpen) water?.setPaused?.(false); }, 180);
  }, { passive: true });
}

/* Giroscopio, solo su richiesta */
const tiltBtn = document.querySelector('.tilt-toggle');
if (!finePointer && 'DeviceOrientationEvent' in window && !reduceMotion) {
  tiltBtn.hidden = false;
  let on = false;
  const onOrient = (e) => {
    if (e.gamma == null) return;
    water?.tilt(Math.max(-1, Math.min(1, e.gamma / 35)) * 0.5, Math.max(-1, Math.min(1, (e.beta - 45) / 35)) * 0.4);
  };
  tiltBtn.addEventListener('click', async () => {
    if (on) { window.removeEventListener('deviceorientation', onOrient); water?.tilt(0, 0); on = false; tiltBtn.setAttribute('aria-pressed', 'false'); tiltBtn.textContent = "Attiva l'inclinazione"; return; }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') return;
      }
      window.addEventListener('deviceorientation', onOrient);
      on = true; tiltBtn.setAttribute('aria-pressed', 'true'); tiltBtn.textContent = 'Inclinazione attiva';
    } catch { tiltBtn.hidden = true; }
  });
}

/* ---------- Card video: inclinazione 3D, riflesso, tocco ---------- */
document.querySelectorAll('.reel').forEach((card) => {
  if (finePointer && !reduceMotion) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
      card.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  }
  card.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') card.classList.add('is-pressed'); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => card.addEventListener(ev, () => card.classList.remove('is-pressed')));
});

/* ---------- Cursore e bottoni magnetici (solo mouse) ---------- */
if (finePointer && !reduceMotion) {
  const cursor = document.querySelector('.cursor');
  cursor.style.display = 'block';
  let cx = -100, cy = -100, tx = -100, ty = -100;
  window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  const loop = () => {
    cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  };
  loop();
  document.addEventListener('pointerover', (e) => {
    const view = e.target.closest('.reel');
    const link = e.target.closest('a, button');
    cursor.classList.toggle('is-view', !!view);
    cursor.classList.toggle('is-link', !view && !!link);
  });
  document.querySelectorAll('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${x * 0.25}px, ${y * 0.3}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* ---------- Animazioni GSAP ---------- */
function initMotion() {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  // entrata hero
  const tl = gsap.timeline({ delay: 0.15, defaults: { ease: 'expo.out' } });
  tl.to('.hero__title .line__inner', { y: 0, duration: 1.6, stagger: 0.12 })
    .to('[data-intro]', { opacity: 1, duration: 1.2, stagger: 0.1, ease: 'power2.out' }, '-=1.1');

  // titolo hero che "affonda" lentamente scorrendo
  gsap.to('.hero__title', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // reveal generici
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.07, ease: 'expo.out', overwrite: true }),
  });

  // manifesto parola per parola
  if (manifesto) {
    const words = splitWords(manifesto);
    ScrollTrigger.create({
      trigger: manifesto, start: 'top 80%', end: 'bottom 45%', scrub: true,
      onUpdate: (self) => {
        const n = Math.round(self.progress * words.length);
        words.forEach((w, i) => w.classList.toggle('on', i < n));
      },
    });
  }

  // lavori: scorrimento orizzontale fissato su desktop
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1024px) and (min-height: 600px) and (hover: hover) and (pointer: fine)', () => {
    root.classList.add('pin-works');
    const track = document.querySelector('.works__track');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '.works', pin: '.works__pin', start: 'top top', end: () => `+=${dist()}`, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    gsap.utils.toArray('.reel').forEach((card) => {
      gsap.fromTo(card.querySelector('img'), { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    });
    ScrollTrigger.refresh();
    return () => { root.classList.remove('pin-works'); gsap.set(track, { clearProps: 'transform' }); };
  });

  // colore dell'acqua legato allo scroll
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => { water?.setScroll(self.scroll(), self.progress); onScrollHeader(self.scroll()); },
  });
}

function initStatic() {
  // nessuna animazione: aggiorna solo acqua e header
  const onS = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    water?.setScroll(window.scrollY, max > 0 ? window.scrollY / max : 0);
    onScrollHeader(window.scrollY);
  };
  window.addEventListener('scroll', onS, { passive: true }); onS();
}

if (root.classList.contains('motion')) initMotion(); else initStatic();
// l'acqua parte dopo il primo disegno della pagina
(window.requestIdleCallback || ((fn) => setTimeout(fn, 200)))(startWater, { timeout: 1200 });
window.addEventListener('load', () => { if (hasGSAP) window.ScrollTrigger.refresh(); });
