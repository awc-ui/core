/**
 * The generated-artwork engine, shared by the fixture generators that need
 * pictures — Lyra's and Corvus's.
 *
 * WHY IT IS A MODULE AND NOT COPIED. It is 250 lines of SVG drawing, and the
 * second vertical that wanted pictures would have had to either duplicate it or
 * do without. Duplicated, the two would agree until the first time one of them
 * was corrected.
 *
 * WHY IT TAKES `rnd` RATHER THAN OWNING ONE. Each fixture is generated from a
 * single seeded stream, and every draw here advances it. If this module held
 * its own PRNG the artwork would be independent of the fixture's seed, which
 * would make one of the two streams reproducible and the other only accidentally
 * so. Passing the caller's `rnd` in keeps ONE stream per fixture — and it is
 * why the extraction was verified by re-running Lyra's generator and diffing
 * `generated.ts`, which came back empty: the call order is unchanged.
 *
 * There is no default export and no module state. `createArtwork(rnd)` returns
 * the two things a generator needs: the family list, and the function that
 * turns an aspect, a hue and a family into a data URI.
 */

/**
 * @param {() => number} rnd  the caller's seeded stream
 */
export function createArtwork(rnd) {
  const uf = (min, max) => min + rnd() * (max - min);
  const ui = (min, max) => Math.floor(uf(min, max + 1));


  /**
   * Ten shape families. Each takes two hues and a seeded PRNG, and returns the
   * BODY of an SVG — the caller wraps it.
   *
   * WHY TEN AND NOT ONE PARAMETERISED FAMILY. The alt text names the family, and
   * "abstract artwork" repeated sixty times tells a screen-reader user nothing at
   * all. Ten families with real names — arcs, dunes, orbits — give a caption that
   * distinguishes one post from another, which is the whole job of alt text on an
   * image that IS the content.
   *
   * Every family is written to be legible at 96px (the explore grid's smallest
   * cell) and at 640px (the post drill). That rules out fine detail: a dot grid
   * at 96px is a grey square. Everything here is large shapes and long gradients.
   */
  const FAMILIES = ['arcs', 'dunes', 'orbits', 'prism', 'bloom', 'ridge', 'halo', 'tide', 'facet', 'strata'];

  /** `hsl()` with no spaces — every byte counts inside a data URI. */
  const rawHsl = (h, s, l, a) =>
    a === undefined ? `hsl(${h},${s}%,${l}%)` : `hsla(${h},${s}%,${l}%,${a})`;

  /**
   * A MOOD, and it is the difference between this reading as artwork and reading
   * as a colour test card.
   *
   * Every family drawn at full saturation produces a grid that is a rainbow —
   * every tile shouting, none of them belonging beside the next. A real feed is
   * mostly muted with a few loud frames, because photographs are. So each artwork
   * draws a saturation scale and a lightness shift once, and every colour in it
   * goes through them: roughly half the fixture lands desaturated and dim, a
   * third mid, and a handful stay vivid.
   *
   * The hue relationships inside a family are untouched — that is what keeps the
   * shapes legible against their own background.
   */
  function mood() {
    const roll = rnd();
    const sat = roll < 0.45 ? uf(0.3, 0.55) : roll < 0.8 ? uf(0.55, 0.8) : uf(0.85, 1.05);
    const light = roll < 0.45 ? uf(-10, 2) : roll < 0.8 ? uf(-4, 6) : uf(0, 10);
    return (h, s, l, a) =>
      rawHsl(
        Math.round(h) % 360,
        Math.max(4, Math.round(s * sat)),
        Math.max(6, Math.min(94, Math.round(l + light))),
        a,
      );
  }

  const n2 = (v) => Number(v.toFixed(1));

  function drawArcs(w, h, h1, h2, hsl) {
    const cx = n2(w * uf(0.2, 0.8));
    const cy = n2(h * uf(0.55, 0.95));
    let out = '';
    for (let i = 4; i >= 1; i -= 1) {
      const radius = n2((Math.min(w, h) * i) / 4.2);
      out += `<circle cx='${cx}' cy='${cy}' r='${radius}' fill='none' stroke='${hsl(
        h1 + i * 8,
        70,
        62 - i * 4,
        0.85,
      )}' stroke-width='${n2(radius / 7)}'/>`;
    }
    return out;
  }

  function drawDunes(w, h, h1, h2, hsl) {
    let out = '';
    for (let i = 0; i < 4; i += 1) {
      const y = n2(h * (0.35 + i * 0.17));
      const lift = n2(h * uf(0.08, 0.2));
      out +=
        `<path d='M0 ${y} Q ${n2(w * 0.3)} ${n2(y - lift)} ${n2(w * 0.55)} ${y} ` +
        `T ${w} ${n2(y - lift * 0.4)} L ${w} ${h} L 0 ${h} Z' fill='${hsl(
          h1 + i * 12,
          62,
          30 + i * 12,
          0.92,
        )}'/>`;
    }
    return out;
  }

  function drawOrbits(w, h, h1, h2, hsl) {
    const cx = n2(w / 2);
    const cy = n2(h / 2);
    const ring = n2(Math.min(w, h) * 0.32);
    let out = `<circle cx='${cx}' cy='${cy}' r='${ring}' fill='none' stroke='${hsl(h2, 55, 78, 0.5)}' stroke-width='2'/>`;
    const count = ui(4, 6);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + uf(0, 0.5);
      out += `<circle cx='${n2(cx + Math.cos(angle) * ring)}' cy='${n2(
        cy + Math.sin(angle) * ring,
      )}' r='${n2(Math.min(w, h) * uf(0.05, 0.11))}' fill='${hsl(h1 + i * 14, 72, 60, 0.9)}'/>`;
    }
    return out;
  }

  function drawPrism(w, h, h1, h2, hsl) {
    let out = '';
    for (let i = 0; i < 3; i += 1) {
      const x = n2(w * uf(0.05, 0.55));
      const y = n2(h * uf(0.05, 0.5));
      const size = n2(Math.min(w, h) * uf(0.35, 0.6));
      out += `<polygon points='${x},${n2(y + size)} ${n2(x + size / 2)},${y} ${n2(
        x + size,
      )},${n2(y + size)}' fill='${hsl(h1 + i * 26, 74, 58, 0.62)}'/>`;
    }
    return out;
  }

  function drawBloom(w, h, h1, h2, hsl) {
    let out = '';
    for (let i = 0; i < 4; i += 1) {
      out += `<circle cx='${n2(w * uf(0.15, 0.85))}' cy='${n2(h * uf(0.15, 0.85))}' r='${n2(
        Math.min(w, h) * uf(0.16, 0.34),
      )}' fill='${hsl(h1 + i * 18, 76, 62, 0.45)}'/>`;
    }
    return out;
  }

  function drawRidge(w, h, h1, h2, hsl) {
    let out = '';
    const step = n2(w / 7);
    for (let i = 0; i < 8; i += 1) {
      const x = n2(i * step - w * 0.25);
      out += `<polygon points='${x},${h} ${n2(x + step * 0.6)},${h} ${n2(
        x + step * 1.5,
      )},0 ${n2(x + step * 0.9)},0' fill='${hsl(h1 + i * 7, 66, 42 + i * 5, 0.8)}'/>`;
    }
    return out;
  }

  function drawHalo(w, h, h1, h2, hsl) {
    const cx = n2(w / 2);
    const cy = n2(h * uf(0.38, 0.58));
    const r = n2(Math.min(w, h) * 0.3);
    return (
      `<circle cx='${cx}' cy='${cy}' r='${n2(r * 1.6)}' fill='${hsl(h2, 80, 60, 0.22)}'/>` +
      `<circle cx='${cx}' cy='${cy}' r='${n2(r * 1.25)}' fill='${hsl(h2, 80, 62, 0.3)}'/>` +
      `<circle cx='${cx}' cy='${cy}' r='${r}' fill='${hsl(h1, 78, 66, 0.95)}'/>`
    );
  }

  function drawTide(w, h, h1, h2, hsl) {
    let out = '';
    for (let i = 0; i < 5; i += 1) {
      const y = n2(h * (0.18 + i * 0.16));
      out +=
        `<path d='M0 ${y} C ${n2(w * 0.25)} ${n2(y - h * 0.09)} ${n2(w * 0.6)} ${n2(
          y + h * 0.09,
        )} ${w} ${y}' fill='none' stroke='${hsl(h1 + i * 10, 68, 58, 0.8)}' ` +
        `stroke-width='${n2(h * 0.045)}' stroke-linecap='round'/>`;
    }
    return out;
  }

  function drawFacet(w, h, h1, h2, hsl) {
    let out = '';
    for (let i = 0; i < 5; i += 1) {
      const x = n2(w * uf(0, 0.7));
      const y = n2(h * uf(0, 0.7));
      out += `<polygon points='${x},${y} ${n2(x + w * uf(0.15, 0.4))},${n2(
        y + h * uf(-0.1, 0.2),
      )} ${n2(x + w * uf(0.1, 0.35))},${n2(y + h * uf(0.2, 0.45))}' fill='${hsl(
        h1 + i * 22,
        70,
        55,
        0.55,
      )}'/>`;
    }
    return out;
  }

  function drawStrata(w, h, h1, h2, hsl) {
    let out = '';
    let y = 0;
    for (let i = 0; i < 6 && y < h; i += 1) {
      const band = n2(h * uf(0.1, 0.24));
      out += `<rect x='0' y='${n2(y)}' width='${w}' height='${band}' fill='${hsl(
        h1 + i * 11,
        58,
        34 + i * 9,
        0.95,
      )}'/>`;
      y += band;
    }
    return out;
  }

  const DRAW = {
    arcs: drawArcs,
    dunes: drawDunes,
    orbits: drawOrbits,
    prism: drawPrism,
    bloom: drawBloom,
    ridge: drawRidge,
    halo: drawHalo,
    tide: drawTide,
    facet: drawFacet,
    strata: drawStrata,
  };

  const SIZE = {
    square: [600, 600],
    portrait: [600, 750],
    landscape: [640, 360],
    /* Corvus only. A cover banner and a link-preview thumbnail are not
       pictures the reader looks AT, they are a band of colour behind a
       headline, and 2:1 is the proportion that reads as a banner rather than
       as a photograph. Lyra never asks for it. */
    wide: [800, 400],
  };

  /**
   * One artwork, as a `data:image/svg+xml` URI.
   *
   * MINIMAL PERCENT-ENCODING, not `encodeURIComponent`. The latter escapes every
   * space, slash and comma too, which on sixty images is several kilobytes of
   * `%20` for no benefit — a data URI only genuinely needs `#` (it would start a
   * fragment), `%` (it introduces an escape) and the angle brackets and quotes
   * that some parsers object to inside an unquoted attribute value. Single quotes
   * are used throughout the SVG so double quotes never appear at all.
   */
  function artwork(aspect, hue, family) {
    const [w, h] = SIZE[aspect];
    const h1 = hue;
    const h2 = (hue + ui(40, 120)) % 360;
    const hsl = mood();
    const body = DRAW[family](w, h, h1, h2, hsl);
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' width='${w}' height='${h}'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='${hsl(h1, 64, 22)}'/>` +
      `<stop offset='1' stop-color='${hsl(h2, 58, 46)}'/>` +
      `</linearGradient></defs>` +
      `<rect width='${w}' height='${h}' fill='url(%23g)'/>` +
      body +
      `</svg>`;

    const encoded = svg
      .replace(/%(?!23)/g, '%25')
      .replace(/#/g, '%23')
      .replace(/</g, '%3C')
      .replace(/>/g, '%3E')
      .replace(/"/g, '%22');

    return `data:image/svg+xml,${encoded}`;
  }

  return { FAMILIES, SIZE, artwork };
}
