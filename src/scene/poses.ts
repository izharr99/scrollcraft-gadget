/**
 * Scroll-to-pose mapping. The phone's whole journey is a list of keyframes anchored to
 * positions inside page sections, so changing section heights in CSS never breaks it.
 */
export interface Pose {
  x: number;
  y: number;
  s: number;
  rx: number;
  ry: number;
  rz: number;
  explode: number;
  /** Canvas opacity, 0 hides the stage and pauses rendering. */
  vis: number;
  /** Screen state: 1 = lock screen. */
  lock: number;
  /** Screen state: home feed scroll 0..1. */
  feed: number;
}

export type SectionId = 'hero' | 'screen' | 'explode' | 'specs' | 'colors' | 'camera';

export interface Keyframe {
  /** [section, progress]. 0..1 spans the section's sticky scroll range; <0 or >1 extend by viewport heights. */
  at: [SectionId, number];
  pose: Partial<Pose>;
  /** Overrides for narrow (mobile) viewports. */
  mobile?: Partial<Pose>;
  /** Easing for the segment that ENDS at this keyframe. */
  ease?: 'linear' | 'inOut';
}

const PI = Math.PI;

export const KEYFRAMES: Keyframe[] = [
  { at: ['hero', 0], pose: { x: 0, y: -0.2, s: 0.9, rx: 0.35, ry: PI * 1.05, rz: -0.12, explode: 0, vis: 1, lock: 1, feed: 0 }, mobile: { s: 0.62, y: 0.05 } },
  { at: ['hero', 1], pose: { y: 0.1, s: 1, rx: 0.06, ry: -0.32, rz: 0.04 }, mobile: { s: 0.72, y: 0.2 } },
  { at: ['screen', 0], pose: { x: 1.25, ry: -0.28, rx: 0, rz: 0, s: 1.02, lock: 0, feed: 0 }, mobile: { x: 0, y: 0.62, s: 0.68 } },
  { at: ['screen', 1], pose: { ry: -0.12, feed: 1 }, mobile: { y: 0.62 }, ease: 'linear' },
  { at: ['explode', 0.08], pose: { x: 0, y: -0.1, s: 0.72, rx: 0.42, ry: -1.0, rz: 0.12, explode: 0 }, mobile: { x: 0, y: 0.15, s: 0.5 } },
  { at: ['explode', 0.7], pose: { ry: -1.18, explode: 1 }, mobile: { y: 0.15 } },
  { at: ['explode', 1], pose: { ry: -1.25, explode: 1, vis: 1 } },
  { at: ['specs', -0.15], pose: { vis: 0, explode: 0.4, s: 0.6 } },
  { at: ['colors', -0.35], pose: { vis: 0, explode: 0, x: -1.05, y: 0, rx: 0.15, ry: PI - 0.4, rz: -0.05, s: 0.95 }, mobile: { x: 0, y: 0.65, s: 0.62 } },
  { at: ['colors', 0], pose: { vis: 1 } },
  { at: ['colors', 1], pose: { ry: PI + 0.4, vis: 1 }, ease: 'linear' },
  { at: ['camera', -0.25], pose: { vis: 0, ry: PI + 1.2 } },
];

export const POSE_KEYS: (keyof Pose)[] = ['x', 'y', 's', 'rx', 'ry', 'rz', 'explode', 'vis', 'lock', 'feed'];

interface Resolved {
  px: number;
  pose: Pose;
  ease: 'linear' | 'inOut';
}

const inOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class PoseTrack {
  private resolved: Resolved[] = [];

  /** Recompute pixel anchors. Call on load and resize. */
  measure(mobile: boolean): void {
    const vh = window.innerHeight;
    let carry = {} as Pose;
    this.resolved = KEYFRAMES.map((k) => {
      const el = document.querySelector<HTMLElement>(`[data-section="${k.at[0]}"]`);
      const top = el ? el.getBoundingClientRect().top + window.scrollY : 0;
      const range = el ? Math.max(1, el.offsetHeight - vh) : vh;
      const f = k.at[1];
      const px = f < 0 ? top + f * vh : f > 1 ? top + range + (f - 1) * vh : top + f * range;
      carry = { ...carry, ...k.pose, ...(mobile ? k.mobile : undefined) };
      return { px, pose: { ...carry }, ease: k.ease ?? 'inOut' };
    });
  }

  sample(scrollY: number, out: Pose): Pose {
    const r = this.resolved;
    if (!r.length) return out;
    const first = r[0]!;
    const last = r[r.length - 1]!;
    if (scrollY <= first.px) return Object.assign(out, first.pose);
    if (scrollY >= last.px) return Object.assign(out, last.pose);
    for (let i = 1; i < r.length; i++) {
      const b = r[i]!;
      if (scrollY <= b.px) {
        const a = r[i - 1]!;
        const lin = (scrollY - a.px) / Math.max(1, b.px - a.px);
        const t = b.ease === 'linear' ? lin : inOut(lin);
        for (const key of POSE_KEYS) out[key] = a.pose[key] + (b.pose[key] - a.pose[key]) * t;
        return out;
      }
    }
    return out;
  }
}
