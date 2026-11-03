import '@fontsource-variable/space-grotesk';
import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { content } from './types';
import { renderPage } from './render';
import { CameraScene } from './sections/camera';
import { initFinishPicker } from './sections/colors';
import { ExplodeCallouts } from './sections/explode';
import type { Stage } from './scene/Stage';

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
root.style.setProperty('--accent', content.colors.finishes[0]?.accent ?? '#7c9cff');

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel as string) as T;
const $$ = <T extends Element = HTMLElement>(sel: string) => [...document.querySelectorAll<T>(sel)];

// ---------------------------------------------------------------- smooth scroll
let lenis: Lenis | null = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true, anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis?.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

const nav = $('[data-nav]');
ScrollTrigger.create({
  start: 80,
  end: 'max',
  onToggle: (self) => nav.classList.toggle('is-scrolled', self.isActive),
});

// ---------------------------------------------------------------- camera section
const camCanvas = $<HTMLCanvasElement>('[data-camera-canvas]');
const camera = new CameraScene(camCanvas, isMobile());
camera.accent = content.colors.finishes[0]?.accent ?? camera.accent;
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
camera.resize();
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
  if (reduced) {
    s.setIntro(1);
    s.frame(0, 0, 0);
  } else {
    gsap.to({ v: 0 }, { v: 1, duration: 1.8, ease: 'expo.out', onUpdate() { s.setIntro(this.targets()[0].v); } });
  }
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

initFinishPicker(content.colors.finishes, (shown) => {
  root.style.setProperty('--accent', shown.accent);
  stage?.setFinish(shown, 1, shown);
  camera.accent = shown.accent;
  drawCamera(true);
  if (reduced) stage?.frame(0, 0, 0);
});

// ---------------------------------------------------------------- scroll choreography
if (!reduced) {
  // Hero: letters fly apart behind the rising phone.
  gsap.from('.hero__letter', { yPercent: 110, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: 0.06, delay: 0.1 });
  gsap.from('.sec--hero .eyebrow, .hero__subtitle, .hero__hint', { y: 24, opacity: 0, duration: 1, stagger: 0.12, delay: 0.5 });
  const letters = $$('.hero__letter');
  const mid = (letters.length - 1) / 2;
  gsap
    .timeline({ scrollTrigger: { trigger: '[data-section="hero"]', start: 'top top', end: 'bottom bottom', scrub: true } })
    .to(letters, { xPercent: (i) => (i - mid) * 55, opacity: 0.12, ease: 'none' }, 0)
    .to('.hero__subtitle, .sec--hero .eyebrow, .hero__hint', { opacity: 0, y: -40, ease: 'none', duration: 0.4 }, 0);

  // Screen: copy steps follow the in-device feed.
  const steps = $$('[data-step]');
  const bar = $('[data-steps-bar]');
  let active = -1;
  ScrollTrigger.create({
    trigger: '[data-section="screen"]',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      bar.style.transform = `scaleY(${self.progress.toFixed(3)})`;
      const idx = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
      if (idx !== active) {
        active = idx;
        steps.forEach((el, i) => el.classList.toggle('is-active', i === idx));
      }
    },
  });
  steps[0]?.classList.add('is-active');

  // Explode intro copy fades as layers separate.
  gsap.to('.explode__intro', {
    opacity: 0.35,
    scrollTrigger: { trigger: '[data-section="explode"]', start: 'top top', end: '30% top', scrub: true },
  });

  // Specs: giant numbers slide sideways like a filmstrip.
  const track = $('[data-specs-track]');
  const trackTween = gsap.to(track, {
    x: () => -(track.scrollWidth - window.innerWidth * 0.9),
    ease: 'none',
    scrollTrigger: { trigger: '[data-section="specs"]', start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
  });
  $$('.bigstat').forEach((el) => {
    gsap.fromTo(
      el.querySelector('.bigstat__value'),
      { yPercent: 40, opacity: 0.15 },
      {
        yPercent: 0,
        opacity: 1,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, containerAnimation: trackTween, start: 'left 95%', end: 'left 55%', scrub: true },
      },
    );
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

  // Compare cards and pre-order mega type.
  gsap.set('[data-reveal]', { opacity: 0, y: 60 });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 85%',
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.12 }),
  });
  gsap.from('.mega__ch', {
    yPercent: 100,
    opacity: 0,
    ease: 'none',
    stagger: 0.04,
    scrollTrigger: { trigger: '#preorder', start: 'top 85%', end: 'top 25%', scrub: true },
  });
}

// ---------------------------------------------------------------- resize
ScrollTrigger.addEventListener('refresh', () => {
  stage?.resize();
  camera.resize();
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
