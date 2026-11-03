import type { ScreenUI } from '../types';

export interface ScreenState {
  /** 1 = lock screen fully visible, 0 = home feed. */
  lock: number;
  /** 0..1 scroll position inside the home feed. */
  feed: number;
  /** Seconds, for idle animation (waveform, wallpaper drift). */
  t: number;
  accent: string;
}

const FONT = '"Space Grotesk Variable", ui-sans-serif, system-ui, sans-serif';

/**
 * Draws the device's "live" operating system into a 2D canvas that is used as the
 * screen texture. Everything is vector-drawn, so it stays crisp and costs no assets.
 */
export class ScreenPainter {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;

  constructor(
    private ui: ScreenUI,
    width = 480,
  ) {
    this.w = width;
    this.h = Math.round(width * 2.16);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  draw(s: ScreenState): void {
    const { ctx, w, h } = this;
    const k = w / 480; // design scale
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 58 * k);
    ctx.clip();
    ctx.scale(k, k);
    const W = 480;
    const H = h / k;

    this.wallpaper(W, H, s);

    // Home feed (under the lock screen)
    const feedAlpha = 1 - s.lock;
    if (feedAlpha > 0.01) {
      ctx.globalAlpha = feedAlpha;
      this.feed(W, H, s);
      ctx.globalAlpha = 1;
    }

    // Lock screen
    if (s.lock > 0.01) {
      ctx.globalAlpha = s.lock;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = `500 26px ${FONT}`;
      ctx.fillText(this.ui.date, W / 2, 190 - (1 - s.lock) * 40);
      ctx.font = `600 150px ${FONT}`;
      ctx.fillText(this.ui.time, W / 2, 330 - (1 - s.lock) * 60);
      ctx.font = `500 22px ${FONT}`;
      ctx.globalAlpha = s.lock * 0.7;
      ctx.fillText('Swipe up to open', W / 2, H - 80);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    this.chrome(W, H);
    ctx.restore();
  }

  private wallpaper(W: number, H: number, s: ScreenState) {
    const { ctx } = this;
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, W, H);
    const blobs: [number, number, number, string][] = [
      [0.2 + Math.sin(s.t * 0.4) * 0.08, 0.25, 360, s.accent],
      [0.85, 0.55 + Math.cos(s.t * 0.3) * 0.06, 420, '#ff5f8f'],
      [0.3, 0.9 - s.feed * 0.2, 380, '#2a3cff'],
    ];
    for (const [x, y, r, col] of blobs) {
      const g = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, r);
      g.addColorStop(0, hexA(col, 0.75));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private card(x: number, y: number, w: number, h: number) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 34);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private feed(W: number, H: number, s: ScreenState) {
    const { ctx, ui } = this;
    const pad = 28;
    const cw = W - pad * 2;
    const contentH = 1620;
    const offset = -s.feed * Math.max(0, contentH - (H - 120));
    ctx.save();
    ctx.translate(0, offset);

    let y = 130;
    ctx.fillStyle = '#fff';
    ctx.font = `600 40px ${FONT}`;
    ctx.fillText(ui.greeting, pad, y + 40);
    y += 80;

    // Weather
    this.card(pad, y, cw, 170);
    ctx.fillStyle = '#fff';
    ctx.font = `600 84px ${FONT}`;
    ctx.fillText(ui.weather.temp, pad + 30, y + 110);
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText(ui.weather.label, pad + 220, y + 72);
    ctx.globalAlpha *= 0.65;
    ctx.fillText(ui.weather.city, pad + 220, y + 108);
    ctx.globalAlpha = 1 - s.lock;
    const sunX = pad + cw - 60;
    ctx.fillStyle = '#ffd36a';
    ctx.beginPath();
    ctx.arc(sunX, y + 62, 26 + Math.sin(s.t * 2) * 2, 0, Math.PI * 2);
    ctx.fill();
    y += 200;

    // Calendar
    this.card(pad, y, cw, 250);
    ctx.font = `600 22px ${FONT}`;
    ctx.fillStyle = s.accent;
    ctx.fillText('TODAY', pad + 30, y + 50);
    ui.events.forEach((e, i) => {
      const ey = y + 100 + i * 52;
      ctx.fillStyle = s.accent;
      ctx.fillRect(pad + 30, ey - 26, 5, 36);
      ctx.fillStyle = '#fff';
      ctx.font = `600 26px ${FONT}`;
      ctx.fillText(e.title, pad + 52, ey);
      ctx.font = `500 22px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(e.time, pad + cw - 100, ey);
    });
    y += 280;

    // Music
    this.card(pad, y, cw, 250);
    const art = ctx.createLinearGradient(pad + 30, y + 30, pad + 150, y + 150);
    art.addColorStop(0, s.accent);
    art.addColorStop(1, '#ff5f8f');
    ctx.fillStyle = art;
    ctx.beginPath();
    ctx.roundRect(pad + 30, y + 30, 120, 120, 22);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(ui.music.track, pad + 175, y + 82);
    ctx.font = `500 22px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(ui.music.artist, pad + 175, y + 118);
    for (let i = 0; i < 28; i++) {
      const bh = 10 + Math.abs(Math.sin(s.t * 3 + i * 0.7) * Math.cos(i * 0.3)) * 46;
      ctx.fillStyle = i < 12 ? s.accent : 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.roundRect(pad + 30 + i * 13.6, y + 210 - bh, 7, bh, 4);
      ctx.fill();
    }
    y += 280;

    // Health ring
    this.card(pad, y, cw, 290);
    const cx = pad + 130;
    const cy = y + 145;
    ctx.lineCap = 'round';
    ctx.lineWidth = 26;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(cx, cy, 86, 0, Math.PI * 2);
    ctx.stroke();
    const fill = Math.min(1, Math.max(0, (s.feed - 0.45) / 0.4)) * (ui.health.score / 100);
    ctx.strokeStyle = s.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, 86, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, fill));
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = `600 56px ${FONT}`;
    ctx.fillText(String(Math.round(fill * 100)), cx, cy + 20);
    ctx.textAlign = 'left';
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(ui.health.label, pad + 260, cy - 10);
    ctx.font = `500 22px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(ui.health.steps, pad + 260, cy + 28);
    y += 320;

    // Photo grid
    for (let i = 0; i < 6; i++) {
      const gx = pad + (i % 3) * ((cw + 12) / 3);
      const gy = y + Math.floor(i / 3) * 140;
      const g = ctx.createLinearGradient(gx, gy, gx + 130, gy + 130);
      g.addColorStop(0, i % 2 ? '#ff8a4c' : s.accent);
      g.addColorStop(1, '#1a1d29');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(gx, gy, (cw - 24) / 3, 128, 18);
      ctx.fill();
    }
    ctx.restore();
  }

  private chrome(W: number, H: number) {
    const { ctx, ui } = this;
    // status bar
    ctx.fillStyle = '#fff';
    ctx.font = `600 24px ${FONT}`;
    ctx.fillText(ui.time, 44, 58);
    ctx.fillRect(W - 86, 40, 40, 20);
    ctx.fillRect(W - 44, 46, 4, 8);
    // camera pill
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 62, 26, 124, 38, 19);
    ctx.fill();
    // home indicator
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 70, H - 26, 140, 8, 4);
    ctx.fill();
  }
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
