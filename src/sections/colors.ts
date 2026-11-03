import { gsap } from 'gsap';
import type { Finish } from '../types';

const lerpHex = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const va = (pa >> shift) & 255;
    const vb = (pb >> shift) & 255;
    return Math.round(va + (vb - va) * t);
  };
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
};

/**
 * Accessible radio-group finish picker. Emits interpolated colours during a smooth
 * transition so both the 3D material and CSS accent animate together.
 */
export function initFinishPicker(finishes: Finish[], onChange: (shown: Finish) => void): void {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-finish]')];
  const nameEls = document.querySelectorAll<HTMLElement>('[data-finish-name], [data-finish-echo]');
  const first = finishes[0];
  if (!first) return;
  const shown: Finish = { ...first };
  const tween = { t: 0 };
  let current = 0;

  const select = (index: number, focus = false) => {
    const next = finishes[index];
    if (!next || index === current) return;
    current = index;
    buttons.forEach((b, i) => {
      b.setAttribute('aria-checked', String(i === index));
      b.tabIndex = i === index ? 0 : -1;
    });
    if (focus) buttons[index]?.focus();
    nameEls.forEach((el) => (el.textContent = next.name));

    const from = { ...shown };
    gsap.killTweensOf(tween);
    tween.t = 0;
    gsap.to(tween, {
      t: 1,
      duration: 0.9,
      ease: 'power2.inOut',
      onUpdate: () => {
        shown.body = lerpHex(from.body, next.body, tween.t);
        shown.accent = lerpHex(from.accent, next.accent, tween.t);
        shown.name = next.name;
        onChange(shown);
      },
    });
  };

  buttons.forEach((b, i) => {
    b.tabIndex = i === 0 ? 0 : -1;
    b.addEventListener('click', () => select(i));
    b.addEventListener('keydown', (e) => {
      const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!delta) return;
      e.preventDefault();
      select((current + delta + buttons.length) % buttons.length, true);
    });
  });
}
