import raw from './content.json';

export interface Link {
  label: string;
  href: string;
}

export interface Finish {
  name: string;
  /** Short catalogue code shown in mono, e.g. "SO-01". */
  code?: string;
  /** Back-glass colour (top of the gradient when `bodyEnd` is set). */
  body: string;
  /** Optional bottom colour for a gradient back. */
  bodyEnd?: string;
  /** Optional frame (metal band) tint; defaults to `body`. */
  frame?: string;
  /** Page accent colour applied while this finish is selected. */
  accent: string;
}

export type LayerId = 'glass' | 'display' | 'chip' | 'battery' | 'camera' | 'back';

export interface LayerSpec {
  id: LayerId;
  label: string;
  value: number;
  decimals: number;
  unit: string;
  detail: string;
}

export interface Stat {
  value: string;
  unit: string;
  label: string;
}

export interface Model {
  name: string;
  price: string;
  highlight: boolean;
  badge?: string;
  specs: { label: string; value: string }[];
}

export interface ScreenUI {
  time: string;
  date: string;
  greeting: string;
  weather: { temp: string; label: string; city: string };
  music: { track: string; artist: string; art: string };
  /** Photo thumbnails shown in the on-screen gallery widget. */
  photos: string[];
  /** Lock screen wallpaper photo (ideally 1170x2532). */
  wallpaper: string;
  health: { score: number; label: string; steps: string };
  events: { time: string; title: string }[];
}

export interface Content {
  meta: { title: string; description: string; themeColor: string; lang: string };
  brand: { name: string; product: string; logoMark: string };
  nav: { links: Link[]; cta: Link };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    scrollHint: string;
    /** Camera-style readouts that count from `from` to `to` as the hero pulls back. */
    hud: { label: string; from: number; to: number; unit: string }[];
  };
  screen: { kicker: string; steps: { title: string; body: string }[]; ui: ScreenUI };
  explode: { kicker: string; heading: string; body: string; layers: LayerSpec[] };
  specs: { kicker: string; items: Stat[] };
  colors: { kicker: string; heading: string; body: string; finishes: Finish[] };
  camera: {
    kicker: string;
    heading: string;
    body: string;
    zoomMax: number;
    aperture: string;
    stats: Stat[];
    /** Sharp photo, a pre-blurred copy of it, and a real defocused (bokeh) photo. */
    images: { sharp: string; soft: string; bokeh: string; alt: string };
  };
  /** Equirectangular .hdr used for reflections on the 3D phone. */
  environment: { hdri: string };
  compare: { kicker: string; heading: string; models: Model[] };
  preorder: {
    kicker: string;
    heading: string;
    price: string;
    cta: Link;
    secondary: Link;
    finePrint: string;
  };
  footer: { note: string; links: Link[] };
  /** Footer credit block. */
  credits: { author: string; url: string; repo: string; license: string; creditsUrl: string };
}

/** Typed view of src/content.json. Edit the JSON to rebrand; logic never hardcodes copy. */
export const content = raw as Content;
