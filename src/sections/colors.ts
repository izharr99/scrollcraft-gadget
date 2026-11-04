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

export interface FinishPicker {
  /** Show finish `index` with a short colour transition. */
  select(index: number): void;
  readonly current: number;
}

/**
 * Accessible radio-group finish picker. Emits interpolated colours during the transition so the
 * 3D material and the CSS accent move together. `onRequest` decides what a click does: in the
 * scroll-driven version it scrolls to that finish; in reduced motion it selects directly.
 */
export function initFinishPicker(
  finishes: Finish[],
  onColour: (shown: Finish) => void,
  onRequest: (index: number) => void,
): FinishPicker {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-finish]')];
  const nameEls = document.querySelectorAll<HTMLElement>('[data-finish-name], [data-finish-echo]');
  const codeEl = document.querySelector<HTMLElement>('[data-finish-code]');
  const indexEl = document.querySelector<HTMLElement>('[data-finish-index]');
  const first = finishes[0] ?? { name: '', body: '#000000', accent: '#000000' };
  const shown: Finish = { ...first };
  const tween = { t: 0 };
  let current = 0;

  const select = (index: number) => {
    const next = finishes[index];
    if (!next || index === current) return;
    current = index;
    buttons.forEach((b, i) => {
      b.setAttribute('aria-checked', String(i === index));
      b.tabIndex = i === index ? 0 : -1;
    });
    nameEls.forEach((el) => (el.textContent = next.name));
    if (codeEl) codeEl.textContent = next.code ?? '';
    if (indexEl) indexEl.textContent = String(index + 1).padStart(2, '0');

    const from = { ...shown };
    gsap.killTweensOf(tween);
    tween.t = 0;
    gsap.to(tween, {
      t: 1,
      duration: 0.55,
      ease: 'power4.inOut',
      onUpdate: () => {
        shown.body = lerpHex(from.body, next.body, tween.t);
        shown.bodyEnd = lerpHex(from.bodyEnd ?? from.body, next.bodyEnd ?? next.body, tween.t);
        shown.frame = lerpHex(from.frame ?? from.body, next.frame ?? next.body, tween.t);
        shown.accent = lerpHex(from.accent, next.accent, tween.t);
        shown.name = next.name;
        onColour(shown);
      },
    });
  };

  buttons.forEach((b, i) => {
    b.tabIndex = i === 0 ? 0 : -1;
    b.addEventListener('click', () => onRequest(i));
    b.addEventListener('keydown', (e) => {
      const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!delta) return;
      e.preventDefault();
      const i2 = (current + delta + buttons.length) % buttons.length;
      buttons[i2]?.focus();
      onRequest(i2);
    });
  });

  return {
    select,
    get current() {
      return current;
    },
  };
}
