/**
 * Procedural "night city through a lens" scene. Scroll progress drives optical zoom and
 * depth-of-field: background lights grow into soft bokeh discs while the subject stays sharp.
 */
interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
  depth: number;
}

interface Building {
  x: number;
  w: number;
  h: number;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = ['#ffb35c', '#ff7a59', '#ffd88a', '#7cc4ff', '#ff5f8f', '#fff1c9'];

export class CameraScene {
  private ctx: CanvasRenderingContext2D;
  private lights: Light[] = [];
  private buildings: Building[] = [];
  private w = 0;
  private h = 0;
  private dpr = 1;
  private last = -1;
  accent = '#7c9cff';

  constructor(private canvas: HTMLCanvasElement, mobile: boolean) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    const rand = mulberry32(7);
    const count = mobile ? 110 : 190;
    for (let i = 0; i < count; i++) {
      this.lights.push({
        x: (rand() * 2 - 1) * 1.3,
        y: rand() * 0.9 - 0.15,
        r: 1 + rand() * 2.2,
        color: PALETTE[Math.floor(rand() * PALETTE.length)] as string,
        depth: 0.4 + rand() * 0.6,
      });
    }
    let x = -1.4;
    while (x < 1.4) {
      const w = 0.06 + rand() * 0.14;
      this.buildings.push({ x, w, h: 0.15 + rand() * 0.55 });
      x += w + 0.005;
    }
    this.dpr = Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.5);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.last = -1;
  }

  draw(p: number, force = false): void {
    if (!force && Math.abs(p - this.last) < 0.001) return;
    this.last = p;
    const { ctx, w, h } = this;
    const unit = Math.min(w, h);
    const cx = w / 2;
    const horizon = h * 0.62;
    const zoom = 1 + p * 2.4;
    const blur = p * unit * 0.045;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#05060f');
    sky.addColorStop(0.6, '#141233');
    sky.addColorStop(1, '#2a1630');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Skyline silhouettes dissolve as focus pulls to the subject.
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p * 1.6);
    ctx.fillStyle = '#070712';
    for (const b of this.buildings) {
      const bx = cx + b.x * unit * zoom * 0.8;
      const bw = b.w * unit * zoom * 0.8;
      const bh = b.h * unit * zoom * 0.6;
      ctx.fillRect(bx, horizon - bh + (zoom - 1) * unit * 0.12, bw, h);
    }
    ctx.restore();

    // Bokeh lights
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.lights) {
      const lx = cx + l.x * unit * zoom * 0.8;
      const ly = horizon - l.y * unit * zoom * 0.55 + (zoom - 1) * unit * 0.12;
      const r = l.r * (1 + p * 0.6) + blur * l.depth;
      if (lx < -r || lx > w + r || ly < -r || ly > h + r) continue;
      const a = Math.min(0.95, Math.pow(l.r / r, 0.45)) * (0.75 + p * 0.25);
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      g.addColorStop(0, rgba(l.color, a * 0.85));
      g.addColorStop(0.72, rgba(l.color, a * 0.7));
      g.addColorStop(0.9, rgba(l.color, a * 0.9));
      g.addColorStop(1, rgba(l.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lx, ly, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    this.lantern(cx + unit * 0.02, h * 0.42, unit * 0.11 * (1 + p * 1.1));

    // Vignette
    const v = ctx.createRadialGradient(cx, h / 2, unit * 0.2, cx, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  private lantern(x: number, y: number, s: number) {
    const { ctx } = this;
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, s * 0.2, x, y, s * 2.6);
    glow.addColorStop(0, rgba(this.accent, 0.45));
    glow.addColorStop(1, rgba(this.accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, y - s * 1.05);
    ctx.stroke();

    ctx.fillStyle = '#1b1b22';
    ctx.fillRect(x - s * 0.32, y - s * 1.1, s * 0.64, s * 0.16);
    ctx.fillRect(x - s * 0.32, y + s * 0.94, s * 0.64, s * 0.16);

    const body = ctx.createRadialGradient(x - s * 0.2, y - s * 0.25, s * 0.1, x, y, s);
    body.addColorStop(0, '#fff6e0');
    body.addColorStop(0.45, mix(this.accent, '#ffcf8a', 0.55));
    body.addColorStop(1, mix(this.accent, '#b03a2e', 0.5));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.82, s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(60,20,10,0.35)';
    ctx.lineWidth = Math.max(1, s * 0.025);
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(x, y, i * s * 0.26, s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + ((B[i] as number) - v) * t)).join(',')})`;
}
