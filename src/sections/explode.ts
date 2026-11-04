import type { LayerSpec } from '../types';
import type { Stage } from '../scene/Stage';

const SVG = 'http://www.w3.org/2000/svg';
/** Callouts use the floating two-column layout at this width and up; below it, a static grid. */
export const CALLOUT_DESKTOP = 1024;

interface Item {
  spec: LayerSpec;
  el: HTMLElement;
  counter: HTMLElement;
  line: SVGLineElement;
  dot: SVGCircleElement;
  side: 'left' | 'right';
  /** Explode amount at which this callout starts appearing. */
  start: number;
  shown: number;
  y: number;
  ay: number;
}

/**
 * Spec callouts tied to projected 3D anchors. Labels sit in two columns either side of the
 * device (first half of content.explode.layers on the left, so list them front to back) and
 * a leader line follows each layer as it flies out. Values count up with the explode amount.
 */
export class ExplodeCallouts {
  private items: Item[];

  constructor(
    private root: HTMLElement,
    private svg: SVGSVGElement,
    specs: LayerSpec[],
  ) {
    const half = Math.ceil(specs.length / 2);
    this.items = specs.map((spec, i) => {
      const el = root.querySelector<HTMLElement>(`[data-layer="${spec.id}"]`) as HTMLElement;
      const line = document.createElementNS(SVG, 'line');
      const dot = document.createElementNS(SVG, 'circle');
      dot.setAttribute('r', '4');
      svg.append(line, dot);
      const side = i < half ? 'left' : 'right';
      el.dataset.side = side;
      return {
        spec,
        el,
        counter: el.querySelector<HTMLElement>('[data-count]') as HTMLElement,
        line,
        dot,
        side,
        start: 0.12 + (i / Math.max(1, specs.length)) * 0.6,
        shown: -1,
        y: 0,
        ay: 0,
      };
    });
  }

  update(stage: Stage, explode: number, vis: number): void {
    const active = vis > 0.05 && explode > 0.02;
    this.root.classList.toggle('is-active', active);
    this.svg.classList.toggle('is-active', active);
    if (!active) return;
    const desktop = window.innerWidth >= CALLOUT_DESKTOP;

    for (const it of this.items) {
      const t = Math.min(1, Math.max(0, (explode - it.start) / 0.22));
      it.el.style.setProperty('--t', t.toFixed(3));
      if (Math.abs(t - it.shown) > 0.002) {
        it.shown = t;
        const ease = 1 - (1 - t) ** 3;
        it.counter.textContent = (it.spec.value * ease).toFixed(it.spec.decimals);
      }
    }

    if (!desktop) {
      for (const it of this.items) it.el.style.transform = '';
      return;
    }

    const cx = window.innerWidth / 2;
    const spread = Math.min(window.innerWidth * 0.3, 470);
    const top = window.innerHeight * 0.38;
    const bottom = window.innerHeight - 60;
    const anchors = new Map<Item, { x: number; y: number }>();
    for (const it of this.items) anchors.set(it, stage.project(it.spec.id));

    for (const side of ['left', 'right'] as const) {
      const col = this.items.filter((i) => i.side === side);
      col.forEach((i) => (i.ay = (anchors.get(i) as { y: number }).y));
      col.sort((a, b) => a.ay - b.ay);
      let prev = -Infinity;
      for (const it of col) {
        it.y = Math.max(it.ay, prev + 122, top);
        prev = it.y;
      }
      // If the column overflowed the bottom, shift it up as a block.
      const over = prev - bottom;
      if (over > 0) col.forEach((i) => (i.y -= over));

      const edge = side === 'left' ? cx - spread : cx + spread;
      for (const it of col) {
        const a = anchors.get(it) as { x: number; y: number };
        it.el.style.transform = `translate3d(${edge.toFixed(1)}px, ${it.y.toFixed(1)}px, 0)`;
        const lx = side === 'left' ? edge + 14 : edge - 14;
        const op = String(it.shown);
        it.line.setAttribute('x1', lx.toFixed(1));
        it.line.setAttribute('y1', it.y.toFixed(1));
        it.line.setAttribute('x2', (lx + (a.x - lx) * it.shown).toFixed(1));
        it.line.setAttribute('y2', (it.y + (a.y - it.y) * it.shown).toFixed(1));
        it.line.style.opacity = op;
        it.dot.setAttribute('cx', a.x.toFixed(1));
        it.dot.setAttribute('cy', a.y.toFixed(1));
        it.dot.style.opacity = op;
      }
    }
  }
}
