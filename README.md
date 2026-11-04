# ScrollCraft: Gadget Launch

A free, open-source **scroll-driven product launch template** for phones and gadgets. Scroll is the
playhead: a studio-lit 3D phone rises and turns on paper, its screen runs a live mini OS, it
explodes into six layers with counting spec callouts, recolours itself, and hands off to a camera
section where scrolling is the zoom ring.

**Live demo:** https://scrollcraft-gadget.vercel.app

![Exploded view](public/og.png)

> Veyra and Flux are fictional. No real brand, product or logo is used or imitated.

## Art direction

Swiss industrial product design, in daylight: warm paper (`#efede8`), near-black ink and a single
accent that is always the selected finish colour. A visible 12-column hairline grid (4 on mobile),
numbered chapters, JetBrains Mono spec labels with tabular numbers, tight Inter Tight display type.
Motion is precise and mechanical: short power4/expo eases, clipped wipes, ticking counters.

## Features

- **Studio-lit 3D phone** (Three.js): metal frame, satin etched-glass back, side buttons, sapphire
  lenses, all with physically based materials, reflecting a real studio HDRI (Poly Haven) under ACES
  tone mapping. A soft PCF shadow falls on an invisible paper backdrop like a product shot.
- **Real, crisp on-device UI**: the screen is a 1170 x 2532 canvas (a real 3x panel; DPR-capped on
  mobile) uploaded with mipmaps and max anisotropy. Photo lock screen, status bar with vector
  icons, weather, health dial, calendar, now-playing, a photo gallery widget, app grid and dock.
  It repaints only when something visible changes, and the feed scrolls in sync with the page.
- **Exploded view**: glass, display, logic board, battery, camera module and frame separate along
  the depth axis; mono spec callouts with leader lines wipe in and count up.
- **Spec filmstrip**: giant ink numbers run past on a pinned, scrubbed track and tick up as they enter.
- **Scroll-driven finish picker**: the section pins and each slice of scroll selects the next finish
  (counter `01 / 04`, swatch, code and progress update; the phone and the whole page accent
  recolour). After the last finish the pin releases. Clicking a swatch scrolls to that finish.
  With reduced motion it is a plain click-to-select radio group.
- **Camera section with real photographs**: scrolling zooms into a sharp night skyline, pulls focus
  through a blurred copy and lands on a real optical-bokeh photo. Pure opacity/transform layers.
- **Compare models** and a **pre-order** finale with masked mega type.
- **Lenis** smooth scroll + **GSAP ScrollTrigger**, one pose track that maps scroll to the phone's
  position, rotation, explode amount and screen state.
- **Mobile-first**: 4-column grid, separate mobile poses, lower pixel ratio and shadow map size.
  Tested at 390px wide.
- **Reduced motion**: no smooth scroll, pinning or scrubbing; a calm static layout.
- **Fast first paint**: Three.js is lazy-loaded after the text renders. Photos are WebP, lazy-loaded.

## Customise (rebrand in one file)

Everything you can read on the page lives in [`src/content.json`](src/content.json):

| Key | What it controls |
| --- | --- |
| `meta` | `<title>`, description, theme colour, language (injected into `index.html` at build) |
| `brand` | Brand name, product name, logo letter |
| `nav` | Nav links and CTA |
| `hero` | Eyebrow, the giant title word (each letter animates), subtitle |
| `screen.steps` | The copy steps shown while the in-device feed scrolls |
| `screen.ui` | What the phone's screen shows: time, date, greeting, weather, music (with cover `art`), health, events, gallery `photos`, lock screen `wallpaper` |
| `explode.layers` | Six spec callouts. `id` must be one of `glass`, `display`, `chip`, `battery`, `camera`, `back`. List them front to back: the first half goes in the left column. `value` + `decimals` drive the counter. |
| `specs.items` | The giant filmstrip numbers |
| `colors.finishes` | Device finishes: `body` is the metal colour, `accent` re-themes the whole page |
| `camera` | Copy, max zoom readout, aperture label, stats, and `images` (sharp photo, blurred copy, bokeh photo) |
| `environment.hdri` | Equirectangular `.hdr` used for reflections on the phone |
| `compare.models` | Model cards; `highlight: true` adds the glow and `badge` |
| `preorder`, `footer` | Finale copy, CTAs, fine print |

Want to go further?

- **Motion**: `src/scene/poses.ts` holds the phone's journey as keyframes anchored to sections
  (`['explode', 0.7]` means 70% through the explode section). Add a `mobile` override per keyframe.
- **Section lengths**: the `height` of each `.sec--*` in `src/style.css` sets how long it stays pinned.
- **Model**: `src/scene/Phone.ts` (dimensions in `DIM`, materials, layer explode distances).
- **Screen UI**: `src/scene/screenUI.ts` draws the OS with the 2D canvas API.

## Run

```bash
pnpm install
pnpm dev        # local dev server
pnpm build      # type-check + production build into dist/
pnpm preview    # serve the production build
```

Deploys as a static site anywhere (Vercel, Netlify, GitHub Pages). On Vercel the Vite preset is
detected automatically.

## Project structure

```
src/
  content.json        all copy, prices, colours (edit this)
  types.ts            typed view of content.json
  render.ts           builds semantic HTML from content
  main.ts             Lenis, ScrollTrigger choreography, wiring
  scene/
    Stage.ts          renderer, lights, environment, frame loop
    Phone.ts          procedural six-layer phone
    poses.ts          scroll -> pose keyframe track
    screenUI.ts       live on-device UI drawn to a canvas texture
  sections/
    explode.ts        projected spec callouts + counters
    colors.ts         accessible finish picker with colour tweening
    camera.ts         photo zoom + focus-pull layers
```

## Credits

- [Three.js](https://threejs.org) (MIT), [GSAP + ScrollTrigger](https://gsap.com) (free standard
  license), [Lenis](https://github.com/darkroomengineering/lenis) (MIT), [Vite](https://vite.dev) (MIT).
- Fonts via Fontsource, SIL Open Font License: [Inter Tight](https://fonts.google.com/specimen/Inter+Tight)
  and [JetBrains Mono](https://www.jetbrains.com/lp/mono/).
- HDRI: [Studio Small 09](https://polyhaven.com/a/studio_small_09) by Sergej Majboroda, Poly Haven, CC0.
- Photographs from [Pexels](https://www.pexels.com), used under the
  [Pexels License](https://www.pexels.com/license/) (free for commercial use, no attribution
  required; credited anyway). Resized and converted to WebP in `public/img/`:
  - `night-city.webp`, `night-city-bokeh.webp`, `thumb-6.webp`: [Night skyline](https://www.pexels.com/photo/stunning-night-skyline-of-a-modern-city-35889296/)
  - `bokeh-lights.webp`, `thumb-5.webp`: [Bokeh city lights](https://www.pexels.com/photo/bokeh-photography-of-city-lights-at-night-11297768/)
  - `wallpaper.webp`, `thumb-1.webp`: [Mountain and lake](https://www.pexels.com/photo/mountain-and-lake-1526713/)
  - `thumb-2.webp`: [Lake surrounded with mountain](https://www.pexels.com/photo/lake-surrounded-with-mountain-629161/)
  - `thumb-3.webp`: [City lighting at night](https://www.pexels.com/photo/city-lighting-at-night-18834566/)
  - `thumb-4.webp`: [City skyline at night](https://www.pexels.com/photo/city-lights-night-stars-57641/)
- The 3D phone and all UI are modelled and drawn in code for this template. Veyra and Flux are fictional.

## License

[MIT](LICENSE). Use it for anything, credit appreciated.
