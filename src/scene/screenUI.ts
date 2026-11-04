import type { ScreenUI } from '../types';

export interface ScreenState {
  /** 1 = lock screen fully visible, 0 = home feed. */
  lock: number;
  /** 0..1 scroll position inside the home feed. */
  feed: number;
  /** Seconds, for the small live details (music progress, waveform). */
  t: number;
  accent: string;
}

/** Design space in points, like a real 6.1" phone. The canvas is this times `k`. */
export const PT_W = 390;
export const PT_H = 844;

const SANS = '"Inter Tight Variable", "Inter Tight", ui-sans-serif, system-ui, sans-serif';
const MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';
const PAPER = '#f3f1ec';
const CARD = '#ffffff';
const INK = '#141414';
const MUTED = '#7b776f';
const RULE = 'rgba(20,20,20,0.12)';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/**
 * Draws the device's operating system into a high-resolution 2D canvas used as the screen
 * texture. Vector only, so it stays crisp at any size. Redraws only when its inputs change.
 */
export class ScreenPainter {
  readonly canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private k: number;
  private lastKey = '';
  private images = new Map<string, HTMLImageElement>();
  /** Called after a photo finishes loading (the next draw will include it). */
  onImageLoad?: () => void;

  constructor(
    private ui: ScreenUI,
    /** Canvas width in pixels; 1170 matches a real 3x phone panel. */
    width = 1170,
  ) {
    for (const src of [ui.wallpaper, ui.music.art, ...ui.photos]) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.invalidate();
        this.onImageLoad?.();
      };
      img.src = src;
      this.images.set(src, img);
    }
    this.k = width / PT_W;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(PT_W * this.k);
    this.canvas.height = Math.round(PT_H * this.k);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  /** Forces the next draw (e.g. after web fonts finish loading). */
  invalidate(): void {
    this.lastKey = '';
  }

  /** Returns true when the canvas changed and the texture needs uploading. */
  draw(s: ScreenState): boolean {
    const live = s.lock < 0.98;
    // Quantise inputs so we only repaint (and re-upload ~12 MB) when something visible moved.
    const key = `${s.lock.toFixed(3)}|${s.feed.toFixed(4)}|${s.accent}|${live ? Math.floor(s.t * 8) : 0}`;
    if (key === this.lastKey) return false;
    this.lastKey = key;

    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, PT_W, PT_H, 50);
    ctx.clip();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, PT_W, PT_H);

    if (s.lock < 0.995) {
      ctx.save();
      ctx.globalAlpha = 1 - s.lock;
      ctx.translate(0, s.lock * 40);
      this.home(s);
      ctx.restore();
    }
    if (s.lock > 0.005) {
      ctx.save();
      ctx.globalAlpha = s.lock;
      ctx.translate(0, -(1 - s.lock) * 60);
      this.lock(s);
      ctx.restore();
    }
    this.statusBar(s.lock);
    // home indicator
    ctx.fillStyle = s.lock > 0.5 ? '#ffffff' : INK;
    ctx.beginPath();
    ctx.roundRect(PT_W / 2 - 67, PT_H - 13, 134, 5, 2.5);
    ctx.fill();
    ctx.restore();
    return true;
  }

  // ------------------------------------------------------------------ helpers
  private text(str: string, x: number, y: number, font: string, color = INK, align: CanvasTextAlign = 'left', tracking = 0) {
    const { ctx } = this;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
    ctx.fillText(str, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  /** Draw a photo with object-fit: cover into a rounded rect. */
  private photo(src: string, x: number, y: number, w: number, h: number, r: number) {
    const { ctx } = this;
    const img = this.images.get(src);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.clip();
    if (img && img.complete && img.naturalWidth) {
      const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * s;
      const dh = img.naturalHeight * s;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#d8d4cc';
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  private rule(x1: number, y: number, x2: number) {
    const { ctx } = this;
    ctx.fillStyle = RULE;
    ctx.fillRect(x1, y, x2 - x1, 0.75);
  }

  private card(x: number, y: number, w: number, h: number, r = 22) {
    const { ctx } = this;
    ctx.fillStyle = CARD;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  // ------------------------------------------------------------------ status bar
  private statusBar(lock: number) {
    const { ctx } = this;
    if (lock < 1) {
      // Opaque strip so scrolled content never collides with the clock.
      ctx.save();
      ctx.globalAlpha = 1 - lock;
      const g = ctx.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, PAPER);
      g.addColorStop(0.75, PAPER);
      g.addColorStop(1, 'rgba(243,241,236,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, PT_W, 64);
      ctx.restore();
    }
    const fg = lock > 0.5 ? '#ffffff' : INK;
    const fgDim = lock > 0.5 ? 'rgba(255,255,255,0.4)' : 'rgba(20,20,20,0.25)';
    this.text(this.ui.time, 52, 33, `600 16px ${SANS}`, fg, 'center', -0.2);
    // dynamic island
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.roundRect(PT_W / 2 - 62, 11, 124, 36, 18);
    ctx.fill();
    // signal bars
    const bx = 292;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < 3 ? fg : fgDim;
      ctx.beginPath();
      ctx.roundRect(bx + i * 4.6, 29 - (4 + i * 2.6), 3, 4 + i * 2.6, 0.8);
      ctx.fill();
    }
    // wifi
    ctx.strokeStyle = fg;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.9;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(320, 30, 3.2 + i * 3.6, -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.stroke();
    }
    // battery
    ctx.lineWidth = 1;
    ctx.strokeStyle = fgDim;
    ctx.beginPath();
    ctx.roundRect(337.5, 19.5, 24, 12, 3.5);
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.roundRect(339.5, 21.5, 16, 8, 2);
    ctx.fill();
    ctx.fillStyle = fgDim;
    ctx.beginPath();
    ctx.roundRect(362.5, 23.5, 1.8, 4, 1);
    ctx.fill();
  }

  // ------------------------------------------------------------------ lock screen
  private lock(s: ScreenState) {
    const { ctx, ui } = this;
    this.photo(ui.wallpaper, 0, 0, PT_W, PT_H, 0);
    // Gentle scrims for legible type, like a real lock screen.
    const top = ctx.createLinearGradient(0, 0, 0, 360);
    top.addColorStop(0, 'rgba(0,0,0,0.35)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, PT_W, 360);
    const bottom = ctx.createLinearGradient(0, PT_H - 220, 0, PT_H);
    bottom.addColorStop(0, 'rgba(0,0,0,0)');
    bottom.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, PT_H - 220, PT_W, 220);

    const W = '#ffffff';
    this.text(ui.date.toUpperCase(), 28, 112, `500 12px ${MONO}`, 'rgba(255,255,255,0.85)', 'left', 1.2);
    this.text(ui.time, 22, 226, `600 128px ${SANS}`, W, 'left', -7);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(28, 262, PT_W - 56, 0.75);
    const cols: [string, string][] = [
      ['TEMP', ui.weather.temp],
      ['BATT', '86%'],
      ['NEXT', ui.events[0]?.time ?? ''],
    ];
    cols.forEach(([label, value], i) => {
      const x = 28 + i * 112;
      this.text(label, x, 286, `500 10px ${MONO}`, 'rgba(255,255,255,0.75)', 'left', 1);
      this.text(value, x, 314, `500 22px ${SANS}`, W, 'left', -0.5);
    });

    // Notification (frosted)
    ctx.fillStyle = 'rgba(245,243,238,0.86)';
    ctx.beginPath();
    ctx.roundRect(16, PT_H - 240, PT_W - 32, 74, 20);
    ctx.fill();
    ctx.fillStyle = s.accent;
    ctx.beginPath();
    ctx.roundRect(30, PT_H - 225, 44, 44, 11);
    ctx.fill();
    this.glyph('calendar', 52, PT_H - 203, '#fff');
    this.text(ui.events[0]?.title ?? '', 88, PT_H - 207, `600 15px ${SANS}`, INK);
    this.text(`Today at ${ui.events[0]?.time ?? ''}`, 88, PT_H - 187, `400 13px ${SANS}`, MUTED);
    this.text('NOW', PT_W - 34, PT_H - 207, `500 10px ${MONO}`, MUTED, 'right', 1);

    for (const [x, g] of [
      [62, 'torch'],
      [PT_W - 62, 'camera'],
    ] as const) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(x, 770, 25, 0, Math.PI * 2);
      ctx.fill();
      this.glyph(g, x, 770, W);
    }
  }

  // ------------------------------------------------------------------ home feed
  private home(s: ScreenState) {
    const { ctx, ui } = this;
    const L = 20;
    const W = PT_W - L * 2;
    const contentH = 1270;
    const viewH = PT_H - 70 - 100;
    const off = -s.feed * (contentH - viewH);
    ctx.save();
    ctx.translate(0, off);

    let y = 92;
    this.text(ui.date.toUpperCase(), L + 4, y, `500 11px ${MONO}`, MUTED, 'left', 1.2);
    y += 40;
    this.text(ui.greeting, L + 2, y, `600 32px ${SANS}`, INK, 'left', -1.2);
    y += 22;

    // Two square widgets
    const half = (W - 12) / 2;
    // Weather
    this.card(L, y, half, half);
    this.text('WEATHER', L + 16, y + 26, `500 10px ${MONO}`, MUTED, 'left', 1);
    this.text(ui.weather.temp, L + 12, y + 104, `500 64px ${SANS}`, INK, 'left', -3);
    this.text(ui.weather.label, L + 16, y + 132, `500 13px ${SANS}`, INK);
    this.text(ui.weather.city.toUpperCase(), L + 16, y + 150, `500 10px ${MONO}`, MUTED, 'left', 1);
    this.glyph('sun', L + half - 30, y + 32, s.accent);
    // Health ring
    const hx = L + half + 12;
    this.card(hx, y, half, half);
    this.text(ui.health.label.toUpperCase(), hx + 16, y + 26, `500 10px ${MONO}`, MUTED, 'left', 1);
    const fill = Math.min(1, Math.max(0.03, (s.feed - 0.05) / 0.5)) * (ui.health.score / 100);
    const cx = hx + half / 2;
    const cy = y + 98;
    ctx.lineWidth = 9;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(20,20,20,0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = s.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill);
    ctx.stroke();
    // tick marks like a dial
    ctx.fillStyle = INK;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillRect(cx + Math.cos(a) * 58 - 0.5, cy + Math.sin(a) * 58 - 0.5, 1, 1);
    }
    this.text(String(Math.round(fill * 100)), cx, cy + 10, `600 28px ${SANS}`, INK, 'center', -1);
    this.text(ui.health.steps.toUpperCase(), hx + 16, y + half - 14, `500 10px ${MONO}`, MUTED, 'left', 0.6);
    y += half + 12;

    // Calendar
    const calH = 58 + ui.events.length * 44;
    this.card(L, y, W, calH);
    this.text('TODAY', L + 16, y + 28, `500 10px ${MONO}`, MUTED, 'left', 1);
    this.text(`${ui.events.length} EVENTS`, L + W - 16, y + 28, `500 10px ${MONO}`, MUTED, 'right', 1);
    ui.events.forEach((e, i) => {
      const ey = y + 44 + i * 44;
      this.rule(L + 16, ey, L + W - 16);
      if (i === 0) {
        ctx.fillStyle = s.accent;
        ctx.fillRect(L + 16, ey + 12, 3, 22);
      }
      this.text(e.time, L + 28, ey + 28, `500 13px ${MONO}`, i === 0 ? INK : MUTED);
      this.text(e.title, L + 92, ey + 28, `500 16px ${SANS}`, INK, 'left', -0.2);
    });
    y += calH + 12;

    // Music
    const musH = 150;
    this.card(L, y, W, musH);
    this.photo(ui.music.art, L + 16, y + 16, 64, 64, 10);
    this.text('NOW PLAYING', L + 96, y + 32, `500 10px ${MONO}`, MUTED, 'left', 1);
    this.text(ui.music.track, L + 96, y + 56, `600 18px ${SANS}`, INK, 'left', -0.4);
    this.text(ui.music.artist, L + 96, y + 76, `400 14px ${SANS}`, MUTED);
    // equaliser
    for (let i = 0; i < 5; i++) {
      const h = 4 + Math.abs(Math.sin(s.t * 4 + i * 1.3)) * 14;
      ctx.fillStyle = s.accent;
      ctx.fillRect(L + W - 50 + i * 6, y + 34 - h, 3, h);
    }
    const prog = (s.t * 0.02) % 1;
    const px = L + 16;
    const pw = W - 32;
    ctx.fillStyle = 'rgba(20,20,20,0.1)';
    ctx.fillRect(px, y + 100, pw, 2);
    ctx.fillStyle = INK;
    ctx.fillRect(px, y + 100, pw * (0.32 + prog * 0.3), 2);
    const sec = Math.floor(70 + prog * 60);
    this.text(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, px, y + 120, `500 10px ${MONO}`, MUTED);
    this.text('3:48', px + pw, y + 120, `500 10px ${MONO}`, MUTED, 'right');
    this.glyph('prev', L + W / 2 - 50, y + 132, INK);
    this.glyph('pause', L + W / 2, y + 132, INK);
    this.glyph('next', L + W / 2 + 50, y + 132, INK);
    y += musH + 12;

    // Photos widget (real photographs)
    const ph = 34 + 2 * 104 + 14;
    this.card(L, y, W, ph);
    this.text('PHOTOS', L + 16, y + 26, `500 10px ${MONO}`, MUTED, 'left', 1);
    this.text('MEMORIES', L + W - 16, y + 26, `500 10px ${MONO}`, MUTED, 'right', 1);
    const tw = (W - 32 - 12) / 3;
    ui.photos.slice(0, 6).forEach((src, i) => {
      this.photo(src, L + 16 + (i % 3) * (tw + 6), y + 38 + Math.floor(i / 3) * 104, tw, 98, 8);
    });
    y += ph + 24;

    // App grid
    this.text('APPS', L + 4, y, `500 10px ${MONO}`, MUTED, 'left', 1);
    y += 16;
    const apps: [string, string, boolean][] = [
      ['Phone', 'phone', false],
      ['Mail', 'mail', false],
      ['Camera', 'camera', true],
      ['Photos', 'photos', false],
      ['Maps', 'maps', false],
      ['Clock', 'clock', false],
      ['Notes', 'notes', false],
      ['Settings', 'settings', false],
    ];
    const cell = W / 4;
    apps.forEach(([label, g, hl], i) => {
      const ax = L + (i % 4) * cell + cell / 2;
      const ay = y + Math.floor(i / 4) * 92;
      ctx.fillStyle = hl ? s.accent : i % 3 === 0 ? INK : CARD;
      ctx.beginPath();
      ctx.roundRect(ax - 30, ay, 60, 60, 15);
      ctx.fill();
      if (!hl && i % 3 !== 0) {
        ctx.strokeStyle = RULE;
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }
      this.glyph(g, ax, ay + 30, hl || i % 3 === 0 ? '#fff' : INK);
      this.text(label, ax, ay + 76, `500 11px ${SANS}`, INK, 'center');
    });
    ctx.restore();

    // Dock (fixed)
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect(12, PT_H - 96, PT_W - 24, 78, 30);
    ctx.fill();
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 0.75;
    ctx.stroke();
    ['phone', 'mail', 'photos', 'camera'].forEach((g, i) => {
      const dx = 12 + (PT_W - 24) * ((i + 0.5) / 4);
      ctx.fillStyle = i === 3 ? s.accent : INK;
      ctx.beginPath();
      ctx.roundRect(dx - 27, PT_H - 84, 54, 54, 14);
      ctx.fill();
      this.glyph(g, dx, PT_H - 57, '#fff');
    });
  }

  // ------------------------------------------------------------------ icons
  /** Minimal geometric line icons, centred on (x, y), roughly 22pt. */
  private glyph(name: string, x: number, y: number, color: string) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const line = (pts: [number, number][], close = false) => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      if (close) ctx.closePath();
      ctx.stroke();
    };
    switch (name) {
      case 'sun':
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          line([
            [Math.cos(a) * 11, Math.sin(a) * 11],
            [Math.cos(a) * 15, Math.sin(a) * 15],
          ]);
        }
        break;
      case 'calendar':
        ctx.strokeRect(-9, -8, 18, 17);
        line([
          [-9, -3],
          [9, -3],
        ]);
        line([
          [-4, -11],
          [-4, -6],
        ]);
        line([
          [4, -11],
          [4, -6],
        ]);
        break;
      case 'torch':
        line(
          [
            [-5, -11],
            [5, -11],
            [5, -4],
            [3, 0],
            [3, 11],
            [-3, 11],
            [-3, 0],
            [-5, -4],
          ],
          true,
        );
        break;
      case 'camera':
        ctx.beginPath();
        ctx.roundRect(-11, -7, 22, 16, 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 1, 4.5, 0, Math.PI * 2);
        ctx.stroke();
        line([
          [-4, -7],
          [-2, -10],
          [2, -10],
          [4, -7],
        ]);
        break;
      case 'phone':
        ctx.beginPath();
        ctx.moveTo(-9, -6);
        ctx.bezierCurveTo(-9, -9, -7, -11, -4, -11);
        ctx.lineTo(-1.5, -5.5);
        ctx.lineTo(-4.5, -3);
        ctx.bezierCurveTo(-3, 0.5, -0.5, 3, 3, 4.5);
        ctx.lineTo(5.5, 1.5);
        ctx.lineTo(11, 4);
        ctx.bezierCurveTo(11, 7, 9, 9, 6, 9);
        ctx.bezierCurveTo(-2, 9, -9, 2, -9, -6);
        ctx.closePath();
        ctx.fill();
        break;
      case 'mail':
        ctx.strokeRect(-11, -7, 22, 15);
        line([
          [-11, -7],
          [0, 2],
          [11, -7],
        ]);
        break;
      case 'photos':
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5, 5, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      case 'maps':
        line(
          [
            [-11, -8],
            [-4, -10],
            [4, -7],
            [11, -9],
            [11, 8],
            [4, 10],
            [-4, 7],
            [-11, 9],
          ],
          true,
        );
        line([
          [-4, -10],
          [-4, 7],
        ]);
        line([
          [4, -7],
          [4, 10],
        ]);
        break;
      case 'clock':
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.stroke();
        line([
          [0, -6],
          [0, 0],
          [5, 3],
        ]);
        break;
      case 'notes':
        for (let i = 0; i < 4; i++)
          line([
            [-9, -8 + i * 5.5],
            [i === 3 ? 2 : 9, -8 + i * 5.5],
          ]);
        break;
      case 'settings':
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          line([
            [Math.cos(a) * 7, Math.sin(a) * 7],
            [Math.cos(a) * 11, Math.sin(a) * 11],
          ]);
        }
        break;
      case 'prev':
        line(
          [
            [4, -6],
            [-4, 0],
            [4, 6],
          ],
          true,
        );
        line([
          [-6, -6],
          [-6, 6],
        ]);
        break;
      case 'next':
        line(
          [
            [-4, -6],
            [4, 0],
            [-4, 6],
          ],
          true,
        );
        line([
          [6, -6],
          [6, 6],
        ]);
        break;
      case 'pause':
        ctx.fillRect(-5, -7, 3.5, 14);
        ctx.fillRect(1.5, -7, 3.5, 14);
        break;
    }
    ctx.restore();
  }
}
