import '@fontsource-variable/inter-tight';
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { content } from './types';
import { fmtHud, renderPage } from './render';
import { CameraPhoto } from './sections/camera';
import { initFinishPicker } from './sections/colors';
import { ExplodeCallouts } from './sections/explode';
import type { Stage } from './scene/Stage';
import type { Finish } from './types';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => window.innerWidth < 768;
const root = document.documentElement;
root.classList.toggle('is-reduced', reduced);
root.classList.add('js');

// ---------------------------------------------------------------- content
document.title = content.meta.title;
document.documentElement.lang = content.meta.lang;
document.querySelector('meta[name="description"]')?.setAttribute('content', content.meta.description);
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', content.meta.themeColor);
const app = document.getElementById('app');
if (!app) throw new Error('#app missing');
app.innerHTML = renderPage(content);
root.style.setProperty('--accent', content.colors.finishes[0]?.accent ?? '#6a4ae6');

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel as string) as T;
const $$ = <T extends Element = HTMLElement>(sel: string) => [...document.querySelectorAll<T>(sel)];

// ---------------------------------------------------------------- smooth scroll
let lenis: Lenis | null = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.14, smoothWheel: true, anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis?.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

const nav = $('[data-nav]');
const syncNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 80);
window.addEventListener('scroll', syncNav, { passive: true });
syncNav();

// ---------------------------------------------------------------- camera section
const camera = new CameraPhoto($('[data-camera-photo]'));
const zoomLabel = $('[data-zoom]');
const zoomBar = $('[data-zoom-bar]');
const focus = $('[data-vf-focus]');
let camProgress = reduced ? 0.55 : 0;
const drawCamera = (force = false) => {
  camera.draw(camProgress, force);
  zoomLabel.textContent = `${(1 + camProgress * (content.camera.zoomMax - 1)).toFixed(1)}x`;
  zoomBar.style.transform = `scaleX(${camProgress.toFixed(3)})`;
  focus.style.transform = `translate(-50%, -50%) scale(${(1.4 - camProgress * 0.5).toFixed(3)})`;
};
drawCamera(true);

// ---------------------------------------------------------------- 3D stage (lazy)
let stage: Stage | null = null;
const callouts = new ExplodeCallouts($('[data-callouts]'), $<SVGSVGElement>('[data-callout-lines]'), content.explode.layers);

async function bootStage() {
  try {
    const { Stage } = await import('./scene/Stage');
    stage = new Stage($<HTMLCanvasElement>('[data-gl]'), content, { mobile: isMobile(), reduced });
  } catch (err) {
    console.warn('[stage] WebGL unavailable, continuing without 3D', err);
    root.classList.add('no-gl');
    return;
  }
  const s = stage;
  s.setFinish(shownFinish);
  if (reduced) {
    s.setIntro(1);
    s.frame(0, 0, 0);
  } else {
    gsap.to({ v: 0 }, { v: 1, duration: 1.1, ease: 'power4.out', onUpdate() { s.setIntro(this.targets()[0].v); } });
  }
  // Canvas text needs the web fonts; repaint the phone screen once they are in.
  Promise.all([
    document.fonts.load('600 16px "Inter Tight Variable"'),
    document.fonts.load('500 12px "JetBrains Mono Variable"'),
  ])
    .catch(() => undefined)
    .then(() => {
      s.refreshScreen();
      if (reduced) s.frame(0, 0, 0);
    });
  ScrollTrigger.refresh();
}

let lastTime = 0;
gsap.ticker.add((time) => {
  if (!stage || reduced) return;
  const dt = Math.min(0.1, time - lastTime);
  lastTime = time;
  const pose = stage.frame(window.scrollY, time, dt);
  callouts.update(stage, pose.explode, pose.vis);
});

// ---------------------------------------------------------------- finishes
const finishes = content.colors.finishes;
let shownFinish: Finish = { ...(finishes[0] ?? { name: '', body: '#2a2b2e', accent: '#2a2b2e' }) };
const colorsSection = $('[data-section="colors"]');
/** Scroll position at the middle of finish `i`'s slice of the pinned colours section. */
const finishScrollY = (i: number) => {
  const top = colorsSection.getBoundingClientRect().top + window.scrollY;
  const range = colorsSection.offsetHeight - window.innerHeight;
  return top + ((i + 0.5) / finishes.length) * range;
};
const picker = initFinishPicker(
  finishes,
  (shown) => {
    shownFinish = shown;
    root.style.setProperty('--accent', shown.accent);
    stage?.setFinish(shown);
    if (reduced) stage?.frame(0, 0, 0);
  },
  (i) => {
    if (reduced || !lenis) picker.select(i);
    else lenis.scrollTo(finishScrollY(i), { duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 4) });
  },
);

// ---------------------------------------------------------------- scroll choreography
const EASE = 'power4.out';

if (!reduced) {
  // Hero: a camera move. Macro crop on the lens plateau, dolly back, pull focus on the type,
  // then the word clocks out upward. Both type layers (solid behind, outline in front of the
  // phone) share one timeline so they stay registered.
  gsap.from('.hero__letter', { yPercent: 105, duration: 1, ease: EASE, stagger: 0.06, delay: 0.2 });
  gsap.from('.hero__bar, .hero__hud div, .hero__subtitle, .hero__hint', {
    clipPath: 'inset(0 100% 0 0)',
    duration: 0.7,
    ease: EASE,
    stagger: 0.06,
    delay: 0.4,
  });
  const heroTitles = $$('[data-hero-title]');
  const heroFront = $('[data-hero-front]');
  const heroBar = $('[data-hero-progress]');
  const hud = $$('[data-hud]').map((el) => ({
    el,
    from: Number(el.dataset.from),
    to: Number(el.dataset.to),
    unit: el.dataset.unit ?? '',
  }));
  gsap.set(heroTitles, { '--zoom': 1.22, '--dof': '14px' });
  gsap
    .timeline({
      scrollTrigger: {
        trigger: '[data-section="hero"]',
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => {
          const p = self.progress;
          heroBar.style.transform = `scaleX(${p.toFixed(3)})`;
          const k = 1 - Math.pow(1 - Math.min(1, p / 0.5), 3);
          for (const h of hud) h.el.textContent = fmtHud(h.from + (h.to - h.from) * k, h.unit);
          heroFront.classList.toggle('is-off', p >= 0.98);
        },
      },
    })
    .to(heroTitles, { '--zoom': 1, '--dof': '0px', ease: 'power2.out', duration: 0.5 }, 0)
    .to('.hero__letter', { yPercent: -105, ease: 'power3.in', stagger: 0.03, duration: 0.3 }, 0.62)
    .to('.hero__subtitle, .hero__hud', { clipPath: 'inset(0 0 0 100%)', ease: 'none', duration: 0.2 }, 0.7);

  // Screen: copy steps follow the in-device feed.
  const steps = $$('[data-step]');
  const ticks = $$('[data-tick]');
  let active = -1;
  ScrollTrigger.create({
    trigger: '[data-section="screen"]',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      const idx = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
      if (idx !== active) {
        active = idx;
        steps.forEach((el, i) => el.classList.toggle('is-active', i === idx));
        ticks.forEach((el, i) => el.classList.toggle('is-on', i <= idx));
      }
    },
  });
  steps[0]?.classList.add('is-active');
  ticks[0]?.classList.add('is-on');

  // Explode intro copy steps back as layers separate.
  gsap.to('.explode__intro', {
    opacity: 0.3,
    scrollTrigger: { trigger: '[data-section="explode"]', start: 'top top', end: '25% top', scrub: true },
  });

  // Specs: giant numbers run past like a filmstrip; each one wipes in and its counter ticks up.
  const track = $('[data-specs-track]');
  const trackTween = gsap.to(track, {
    x: () => -(track.scrollWidth - window.innerWidth),
    ease: 'none',
    scrollTrigger: { trigger: '[data-section="specs"]', start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
  });
  $$('.bigstat').forEach((el, i) => {
    const valueEl = el.querySelector<HTMLElement>('.bigstat__value');
    const numEl = valueEl?.firstChild;
    const raw = content.specs.items[i]?.value ?? '';
    const target = /^\d+(\.\d+)?$/.test(raw) ? parseFloat(raw) : null;
    const decimals = raw.includes('.') ? raw.split('.')[1]!.length : 0;
    gsap.fromTo(
      valueEl,
      { clipPath: 'inset(0 100% 0 0)' },
      {
        clipPath: 'inset(0 0% 0 0)',
        duration: 0.7,
        ease: EASE,
        scrollTrigger: {
          trigger: el,
          containerAnimation: trackTween,
          start: 'left 85%',
          toggleActions: 'play none none reverse',
          onEnter: () => {
            if (target === null || !numEl) return;
            const o = { v: 0 };
            gsap.to(o, {
              v: target,
              duration: 0.8,
              ease: EASE,
              onUpdate: () => (numEl.textContent = o.v.toFixed(decimals)),
            });
          },
        },
      },
    );
  });

  // Finishes: pinned; scrolling steps through each finish, then releases.
  const colorsBar = $('[data-colors-bar]');
  ScrollTrigger.create({
    trigger: colorsSection,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      colorsBar.style.transform = `scaleX(${self.progress.toFixed(3)})`;
      picker.select(Math.min(finishes.length - 1, Math.floor(self.progress * finishes.length)));
    },
    onLeaveBack: () => picker.select(0),
  });

  // Camera: scroll is the zoom ring.
  ScrollTrigger.create({
    trigger: '[data-section="camera"]',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      camProgress = self.progress;
      drawCamera();
    },
  });

  // Chapter rules draw in as each section arrives.
  $$('.chapter').forEach((el) => {
    gsap.from(el, {
      '--rule': 0,
      duration: 0.8,
      ease: EASE,
      scrollTrigger: { trigger: el.closest('section') ?? el, start: 'top 80%', toggleActions: 'play none none reverse' },
    });
  });

  // Compare cards wipe up; pre-order mega type rises out of its masks.
  gsap.set('[data-reveal]', { clipPath: 'inset(100% 0 0 0)' });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 85%',
    onEnter: (els) => gsap.to(els, { clipPath: 'inset(0% 0 0 0)', duration: 0.8, ease: EASE, stagger: 0.08 }),
  });
  gsap.from('.mega__ch', {
    yPercent: 105,
    ease: 'none',
    stagger: 0.03,
    scrollTrigger: { trigger: '#preorder', start: 'top 80%', end: 'top 30%', scrub: true },
  });
}

if (reduced) {
  // Static page: show the hero readouts at their final values.
  $$<HTMLElement>('[data-hud]').forEach((el) => {
    el.textContent = fmtHud(Number(el.dataset.to), el.dataset.unit ?? '');
  });
}

// ---------------------------------------------------------------- resize
ScrollTrigger.addEventListener('refresh', () => {
  stage?.resize();
  drawCamera(true);
  if (reduced) stage?.frame(0, 0, 0);
});
let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
});

// Defer WebGL until the first paint so text appears instantly.
const idle = (cb: () => void): void => {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(cb, { timeout: 400 });
  else setTimeout(cb, 60);
};
if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
idle(() => void bootStage());
