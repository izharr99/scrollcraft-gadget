import type { Content, Stat } from './types';

/** Escape text before it goes into innerHTML. Content is author-controlled, but stay safe. */
const esc = (s: string | number): string =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

const stat = (s: Stat, cls: string) => `
  <li class="${cls}">
    <span class="${cls}__value">${esc(s.value)}<small>${esc(s.unit)}</small></span>
    <span class="${cls}__label">${esc(s.label)}</span>
  </li>`;

/** Builds the whole page from content.json. Animation code only reads data attributes and classes. */
export function renderPage(c: Content): string {
  const letters = [...c.hero.title].map((l, i) => `<span class="hero__letter" style="--i:${i}">${esc(l)}</span>`).join('');

  return `
  <header class="nav" data-nav>
    <a class="nav__brand" href="#top" aria-label="${esc(c.brand.name)} home">
      <span class="nav__mark" aria-hidden="true">${esc(c.brand.logoMark)}</span>${esc(c.brand.name)}
    </a>
    <nav aria-label="Primary">
      <ul class="nav__links">
        ${c.nav.links.map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join('')}
      </ul>
    </nav>
    <a class="btn btn--small" href="${esc(c.nav.cta.href)}">${esc(c.nav.cta.label)}</a>
  </header>

  <div class="stage" data-stage aria-hidden="true">
    <canvas class="stage__canvas" data-gl></canvas>
  </div>

  <main id="main">
    <section id="top" class="sec sec--hero" data-section="hero" aria-label="${esc(c.brand.product)}">
      <div class="sticky">
        <p class="eyebrow">${esc(c.hero.eyebrow)} ${esc(c.brand.name)} ${esc(c.brand.product)}</p>
        <h1 class="hero__title" aria-label="${esc(c.hero.title)}"><span aria-hidden="true">${letters}</span></h1>
        <p class="hero__subtitle">${esc(c.hero.subtitle)}</p>
        <span class="hero__hint" aria-hidden="true"><i></i>${esc(c.hero.scrollHint)}</span>
      </div>
    </section>

    <section id="screen" class="sec sec--screen" data-section="screen" aria-labelledby="screen-kicker">
      <div class="sticky">
        <div class="steps">
          <p class="kicker" id="screen-kicker">${esc(c.screen.kicker)}</p>
          ${c.screen.steps
            .map(
              (s, i) => `
            <article class="step" data-step="${i}">
              <span class="step__num">0${i + 1}</span>
              <h2 class="step__title">${esc(s.title)}</h2>
              <p class="step__body">${esc(s.body)}</p>
            </article>`,
            )
            .join('')}
          <div class="steps__bar" aria-hidden="true"><i data-steps-bar></i></div>
        </div>
      </div>
    </section>

    <section id="explode" class="sec sec--explode" data-section="explode" aria-labelledby="explode-heading">
      <div class="sticky">
        <div class="explode__intro">
          <p class="kicker">${esc(c.explode.kicker)}</p>
          <h2 id="explode-heading" class="h2">${esc(c.explode.heading)}</h2>
          <p class="lead">${esc(c.explode.body)}</p>
        </div>
        <svg class="callout-lines" data-callout-lines aria-hidden="true"></svg>
        <ul class="callouts" data-callouts>
          ${c.explode.layers
            .map(
              (l) => `
            <li class="callout" data-layer="${esc(l.id)}">
              <span class="callout__value"><span data-count="${l.value}" data-decimals="${l.decimals}">${esc(l.value.toFixed(l.decimals))}</span><small>${esc(l.unit)}</small></span>
              <span class="callout__label">${esc(l.label)}</span>
              <span class="callout__detail">${esc(l.detail)}</span>
            </li>`,
            )
            .join('')}
        </ul>
      </div>
    </section>

    <section id="specs" class="sec sec--specs" data-section="specs" aria-labelledby="specs-kicker">
      <div class="sticky">
        <p class="kicker" id="specs-kicker">${esc(c.specs.kicker)}</p>
        <ul class="specs__track" data-specs-track>
          ${c.specs.items.map((s) => stat(s, 'bigstat')).join('')}
        </ul>
      </div>
    </section>

    <section id="colors" class="sec sec--colors" data-section="colors" aria-labelledby="colors-heading">
      <div class="sticky">
        <div class="colors__panel">
          <p class="kicker">${esc(c.colors.kicker)}</p>
          <h2 id="colors-heading" class="h2">${esc(c.colors.heading)}</h2>
          <p class="lead">${esc(c.colors.body)}</p>
          <div class="swatches" role="radiogroup" aria-label="Device finish">
            ${c.colors.finishes
              .map(
                (f, i) => `
              <button type="button" class="swatch" role="radio" aria-checked="${i === 0}" data-finish="${i}"
                style="--swatch:${esc(f.body)}" aria-label="${esc(f.name)}">
                <span class="swatch__dot" aria-hidden="true"></span>
              </button>`,
              )
              .join('')}
          </div>
          <p class="colors__name" aria-live="polite" data-finish-name>${esc(c.colors.finishes[0]?.name ?? '')}</p>
        </div>
      </div>
    </section>

    <section id="camera" class="sec sec--camera" data-section="camera" aria-labelledby="camera-heading">
      <div class="sticky">
        <canvas class="camera__canvas" data-camera-canvas role="img"
          aria-label="Night city scene through the camera viewfinder, zooming in as you scroll"></canvas>
        <div class="viewfinder" aria-hidden="true">
          <span class="vf__corner vf__corner--tl"></span><span class="vf__corner vf__corner--tr"></span>
          <span class="vf__corner vf__corner--bl"></span><span class="vf__corner vf__corner--br"></span>
          <span class="vf__focus" data-vf-focus></span>
          <span class="vf__rec"><i></i>REC</span>
          <span class="vf__readout"><b data-zoom>1.0x</b> ${esc(c.camera.aperture)}</span>
          <span class="vf__scale"><i data-zoom-bar></i></span>
        </div>
        <div class="camera__copy">
          <p class="kicker">${esc(c.camera.kicker)}</p>
          <h2 id="camera-heading" class="h2">${esc(c.camera.heading)}</h2>
          <p class="lead">${esc(c.camera.body)}</p>
          <ul class="camstats">${c.camera.stats.map((s) => stat(s, 'camstat')).join('')}</ul>
        </div>
      </div>
    </section>

    <section id="compare" class="sec sec--compare" aria-labelledby="compare-heading">
      <p class="kicker">${esc(c.compare.kicker)}</p>
      <h2 id="compare-heading" class="h2">${esc(c.compare.heading)}</h2>
      <div class="models">
        ${c.compare.models
          .map(
            (m) => `
          <article class="model${m.highlight ? ' model--hl' : ''}" data-reveal>
            ${m.badge ? `<span class="model__badge">${esc(m.badge)}</span>` : ''}
            <h3 class="model__name">${esc(m.name)}</h3>
            <p class="model__price">${esc(m.price)}</p>
            <dl class="model__specs">
              ${m.specs.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}
            </dl>
          </article>`,
          )
          .join('')}
      </div>
    </section>

    <section id="preorder" class="sec sec--preorder" aria-labelledby="preorder-heading">
      <p class="kicker">${esc(c.preorder.kicker)}</p>
      <h2 id="preorder-heading" class="mega" aria-label="${esc(c.preorder.heading)}">${c.preorder.heading
        .split(' ')
        .map((w) => `<span class="mega__word" aria-hidden="true">${[...w].map((ch) => `<span class="mega__ch">${esc(ch)}</span>`).join('')}</span>`)
        .join(' ')}</h2>
      <p class="lead preorder__price">${esc(c.preorder.price)} <span data-finish-echo>${esc(c.colors.finishes[0]?.name ?? '')}</span></p>
      <div class="preorder__ctas">
        <a class="btn" href="${esc(c.preorder.cta.href)}">${esc(c.preorder.cta.label)}</a>
        <a class="btn btn--ghost" href="${esc(c.preorder.secondary.href)}">${esc(c.preorder.secondary.label)}</a>
      </div>
      <p class="fine">${esc(c.preorder.finePrint)}</p>
    </section>
  </main>

  <footer class="footer">
    <span>&copy; ${new Date().getFullYear()} ${esc(c.brand.name)}. ${esc(c.footer.note)}</span>
    <ul>${c.footer.links.map((l) => `<li><a href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a></li>`).join('')}</ul>
  </footer>`;
}
