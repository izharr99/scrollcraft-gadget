import type { Content, Stat } from './types';

/** Escape text before it goes into innerHTML. Content is author-controlled, but stay safe. */
const esc = (s: string | number): string =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Numbered chapter rule shown at the top of every section. */
const chapter = (n: number, label: string, meta = '') => `
  <div class="chapter" aria-hidden="true">
    <span class="chapter__num">${pad2(n)}</span>
    <span class="chapter__label">${esc(label)}</span>
    <span class="chapter__meta">${esc(meta)}</span>
  </div>`;

const stat = (s: Stat, cls: string, i: number) => `
  <li class="${cls}">
    <span class="${cls}__index">[${pad2(i + 1)}]</span>
    <span class="${cls}__value">${esc(s.value)}<small>${esc(s.unit)}</small></span>
    <span class="${cls}__label">${esc(s.label)}</span>
  </li>`;

/** Builds the whole page from content.json. Animation code only reads data attributes and classes. */
export function renderPage(c: Content): string {
  const letters = [...c.hero.title]
    .map((l, i) => `<span class="hero__mask"><span class="hero__letter" style="--i:${i}">${esc(l)}</span></span>`)
    .join('');
  const total = c.colors.finishes.length;
  const first = c.colors.finishes[0];

  return `
  <div class="grid-overlay" aria-hidden="true">${'<i></i>'.repeat(12)}</div>

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
        ${chapter(0, c.hero.eyebrow, `${c.brand.name} ${c.brand.product}`)}
        <ul class="hero__specs" aria-label="Key specs">
          ${c.specs.items
            .slice(0, 3)
            .map((s) => `<li><span>${esc(s.label)}</span><b>${esc(s.value)}${s.unit ? ` ${esc(s.unit)}` : ''}</b></li>`)
            .join('')}
        </ul>
        <p class="hero__subtitle">${esc(c.hero.subtitle)}</p>
        <h1 class="hero__title" aria-label="${esc(c.brand.name)} ${esc(c.hero.title)}"><span aria-hidden="true">${letters}</span></h1>
        <span class="hero__hint" aria-hidden="true">${esc(c.hero.scrollHint)} <i></i></span>
      </div>
    </section>

    <section id="screen" class="sec sec--screen" data-section="screen" aria-labelledby="screen-title">
      <div class="sticky">
        ${chapter(1, c.screen.kicker, 'Software')}
        <h2 id="screen-title" class="sr-only">${esc(c.screen.kicker)}</h2>
        <div class="steps">
          ${c.screen.steps
            .map(
              (s, i) => `
            <article class="step" data-step="${i}">
              <span class="step__num">${pad2(i + 1)} / ${pad2(c.screen.steps.length)}</span>
              <h3 class="step__title">${esc(s.title)}</h3>
              <p class="step__body">${esc(s.body)}</p>
            </article>`,
            )
            .join('')}
          <div class="ticks" aria-hidden="true">${c.screen.steps.map(() => '<i data-tick></i>').join('')}</div>
        </div>
      </div>
    </section>

    <section id="explode" class="sec sec--explode" data-section="explode" aria-labelledby="explode-heading">
      <div class="sticky">
        ${chapter(2, c.explode.kicker, 'Hardware')}
        <div class="explode__intro">
          <h2 id="explode-heading" class="h2">${esc(c.explode.heading)}</h2>
          <p class="lead">${esc(c.explode.body)}</p>
        </div>
        <svg class="callout-lines" data-callout-lines aria-hidden="true"></svg>
        <ul class="callouts" data-callouts>
          ${c.explode.layers
            .map(
              (l, i) => `
            <li class="callout" data-layer="${esc(l.id)}">
              <span class="callout__label"><i>${pad2(i + 1)}</i> ${esc(l.label)}</span>
              <span class="callout__value"><span data-count="${l.value}" data-decimals="${l.decimals}">${esc(l.value.toFixed(l.decimals))}</span><small>${esc(l.unit)}</small></span>
              <span class="callout__detail">${esc(l.detail)}</span>
            </li>`,
            )
            .join('')}
        </ul>
      </div>
    </section>

    <section id="specs" class="sec sec--specs" data-section="specs" aria-labelledby="specs-title">
      <div class="sticky">
        ${chapter(3, c.specs.kicker, 'Specification')}
        <h2 id="specs-title" class="sr-only">${esc(c.specs.kicker)}</h2>
        <ul class="specs__track" data-specs-track>
          ${c.specs.items.map((s, i) => stat(s, 'bigstat', i)).join('')}
        </ul>
      </div>
    </section>

    <section id="colors" class="sec sec--colors" data-section="colors" aria-labelledby="colors-heading">
      <div class="sticky">
        ${chapter(4, c.colors.kicker, 'Finish')}
        <div class="colors__panel">
          <h2 id="colors-heading" class="h2">${esc(c.colors.heading)}</h2>
          <p class="lead">${esc(c.colors.body)}</p>
          <div class="colors__readout" aria-live="polite">
            <span class="colors__count"><b data-finish-index>01</b> / ${pad2(total)}</span>
            <span class="colors__name" data-finish-name>${esc(first?.name ?? '')}</span>
            <span class="colors__code" data-finish-code>${esc(first?.code ?? '')}</span>
          </div>
          <div class="swatches" role="radiogroup" aria-label="Device finish">
            ${c.colors.finishes
              .map(
                (f, i) => `
              <button type="button" class="swatch" role="radio" aria-checked="${i === 0}" data-finish="${i}"
                style="--swatch:${esc(f.body)}" aria-label="${esc(f.name)}">
                <span class="swatch__chip" aria-hidden="true"></span>
                <span class="swatch__idx" aria-hidden="true">${pad2(i + 1)}</span>
              </button>`,
              )
              .join('')}
          </div>
          <div class="colors__progress" aria-hidden="true"><i data-colors-bar></i></div>
        </div>
      </div>
    </section>

    <section id="camera" class="sec sec--camera" data-section="camera" aria-labelledby="camera-heading">
      <div class="sticky">
        ${chapter(5, c.camera.kicker, 'Optics')}
        <figure class="plate">
          <div class="camera__photo" data-camera-photo role="img" aria-label="${esc(c.camera.images.alt)}">
            <img data-cam="sharp" src="${esc(c.camera.images.sharp)}" alt="" loading="lazy" decoding="async" width="2000" height="1333" />
            <img data-cam="soft" src="${esc(c.camera.images.soft)}" alt="" loading="lazy" decoding="async" width="1000" height="667" />
            <img data-cam="bokeh" src="${esc(c.camera.images.bokeh)}" alt="" loading="lazy" decoding="async" width="2000" height="1125" />
          </div>
          <div class="viewfinder" aria-hidden="true">
            <span class="vf__corner vf__corner--tl"></span><span class="vf__corner vf__corner--tr"></span>
            <span class="vf__corner vf__corner--bl"></span><span class="vf__corner vf__corner--br"></span>
            <span class="vf__focus" data-vf-focus></span>
            <span class="vf__rec"><i></i>REC</span>
            <span class="vf__readout"><b data-zoom>1.0x</b> ${esc(c.camera.aperture)}</span>
            <span class="vf__scale"><i data-zoom-bar></i></span>
          </div>
        </figure>
        <div class="camera__copy">
          <h2 id="camera-heading" class="h2">${esc(c.camera.heading)}</h2>
          <p class="lead">${esc(c.camera.body)}</p>
          <ul class="camstats">${c.camera.stats.map((s, i) => stat(s, 'camstat', i)).join('')}</ul>
        </div>
      </div>
    </section>

    <section id="compare" class="sec sec--compare" aria-labelledby="compare-heading">
      ${chapter(6, c.compare.kicker, 'Line-up')}
      <h2 id="compare-heading" class="h2">${esc(c.compare.heading)}</h2>
      <div class="models">
        ${c.compare.models
          .map(
            (m, mi) => `
          <article class="model${m.highlight ? ' model--hl' : ''}" data-reveal>
            <header class="model__head">
              <span class="model__idx">${pad2(mi + 1)}</span>
              ${m.badge ? `<span class="model__badge">${esc(m.badge)}</span>` : ''}
            </header>
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
      ${chapter(7, c.preorder.kicker, 'Order')}
      <h2 id="preorder-heading" class="mega" aria-label="${esc(c.preorder.heading)}">${c.preorder.heading
        .split(' ')
        .map((w) => `<span class="mega__word" aria-hidden="true">${[...w].map((ch) => `<span class="mega__ch">${esc(ch)}</span>`).join('')}</span>`)
        .join(' ')}</h2>
      <div class="preorder__row">
        <p class="preorder__price">${esc(c.preorder.price)} <span data-finish-echo>${esc(first?.name ?? '')}</span></p>
        <div class="preorder__ctas">
          <a class="btn" href="${esc(c.preorder.cta.href)}">${esc(c.preorder.cta.label)}</a>
          <a class="btn btn--ghost" href="${esc(c.preorder.secondary.href)}">${esc(c.preorder.secondary.label)}</a>
        </div>
      </div>
      <p class="fine">${esc(c.preorder.finePrint)}</p>
    </section>
  </main>

  <footer class="footer">
    <span>&copy; ${new Date().getFullYear()} ${esc(c.brand.name)}. ${esc(c.footer.note)}</span>
    <ul>${c.footer.links.map((l) => `<li><a href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a></li>`).join('')}</ul>
  </footer>`;
}
