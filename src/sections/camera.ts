/**
 * Camera section driven by real photographs. Scroll progress zooms into a sharp night skyline,
 * pulls focus through a pre-blurred copy, and lands on a real defocused (bokeh) photo.
 * Everything is opacity + transform on stacked <img> layers, so it stays on the compositor.
 */
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class CameraPhoto {
  private sharp: HTMLElement;
  private soft: HTMLElement;
  private bokeh: HTMLElement;
  private last = -1;

  constructor(root: HTMLElement) {
    this.sharp = root.querySelector('[data-cam="sharp"]') as HTMLElement;
    this.soft = root.querySelector('[data-cam="soft"]') as HTMLElement;
    this.bokeh = root.querySelector('[data-cam="bokeh"]') as HTMLElement;
  }

  draw(p: number, force = false): void {
    if (!force && Math.abs(p - this.last) < 0.0005) return;
    this.last = p;
    const zoom = 1 + smooth(0, 0.6, p) * 1.5;
    const city = `scale(${zoom.toFixed(4)})`;
    this.sharp.style.transform = city;
    this.soft.style.transform = city;
    this.soft.style.opacity = smooth(0.38, 0.68, p).toFixed(3);
    const b = smooth(0.6, 0.92, p);
    this.bokeh.style.opacity = b.toFixed(3);
    this.bokeh.style.transform = `scale(${(1.25 - b * 0.2).toFixed(4)})`;
  }
}
