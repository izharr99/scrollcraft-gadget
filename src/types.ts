import raw from './content.json';

export interface Link {
  label: string;
  href: string;
}

export interface Finish {
  name: string;
  /** Device body / frame colour. */
  body: string;
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
  music: { track: string; artist: string };
  health: { score: number; label: string; steps: string };
  events: { time: string; title: string }[];
}

export interface Content {
  meta: { title: string; description: string; themeColor: string; lang: string };
  brand: { name: string; product: string; logoMark: string };
  nav: { links: Link[]; cta: Link };
  hero: { eyebrow: string; title: string; subtitle: string; scrollHint: string };
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
  };
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
}

/** Typed view of src/content.json. Edit the JSON to rebrand; logic never hardcodes copy. */
export const content = raw as Content;
