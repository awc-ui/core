#!/usr/bin/env node
/**
 * emit-pre-upgrade-css.mjs — the pre-upgrade size floors.
 *
 * WHAT THIS SOLVES. The lazy `dist` output defines every tag at bootstrap and
 * only then fetches each component's chunk, so there is a window in which an
 * `md-*` element exists with NONE of its shadow CSS — no size, no display. A
 * component that occupies layout (a rail, a bar, a toolbar) is a 0-size inline
 * box for that window, and everything around it jumps when its chunk lands.
 * Consumers were closing this by hand-copying each component's private `--_*`
 * size defaults into their own stylesheets — copies that silently drift the
 * day a component changes.
 *
 * WHAT THIS EMITS. `dist/md3/pre-upgrade.css`: one rule per covered component,
 * gated on `:not(.hydrated)` — Stencil's per-element hydrated flag, which flips
 * exactly when the component's own `:host` rules take over. NOT `:not(:defined)`:
 * in the lazy build every tag is defined long before its styles exist, so that
 * gate evaporates while the element is still a 0×0 box (measured, and recorded
 * in showcase-kit's dock styles, which learned this the hard way).
 *
 * Two sections:
 *
 *  - GENERATED: parsed out of each whitelisted component's own bare `:host`
 *    block — the same declaration the component ships, so the floor cannot
 *    drift from the thing it is reserving for. Only size floors are taken
 *    (`inline-size`/`block-size`/`min-*`), re-emitted as `min-*` so the
 *    component's own equal-or-larger settled size simply satisfies them.
 *  - CURATED: the handful of components whose settled size is real but lives
 *    on an INNER element or has no public property, where parsing bare `:host`
 *    yields nothing. Each entry names its source so a change there is
 *    findable. These are reviewed by hand when the source expression changes —
 *    the build fails if the source file stops containing the expression.
 *
 * A WHITELIST, not all components, on purpose: a blanket second declaration of
 * every component's box is where other libraries' attempts died ("conflicts" —
 * Shoelace tried and reverted). This covers the components that occupy
 * persistent layout, where the shift is measured and material.
 *
 * `display` is emitted alongside the floors because an un-upgraded element is
 * `display: inline`, where width/height are inert. Mapped to the non-flex
 * equivalent (flex → block, inline-flex → inline-block): the floor only needs
 * the BOX, and the component's real display arrives with its styles.
 *
 * Consumption is OPT-IN, one import next to the token sheet:
 *
 *   import '@awc-ui/core/css/tokens.css';
 *   import '@awc-ui/core/css/pre-upgrade.css';
 *
 * Run: chained into packages/core's `build` after emit-tokens-css.mjs.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const COMPONENTS = join(ROOT, 'packages/core/src/components');
const OUT = join(ROOT, 'packages/core/dist/md3/pre-upgrade.css');

/* ------------------------------------------------------------- generated */

/**
 * Components whose settled size sits on the bare `:host` behind a public
 * `--md-*` property. The generator reads the component's own CSS; nothing
 * here states a number.
 */
const GENERATED = ['md-navigation-rail'];

/** Size properties worth flooring, and the `min-*` form each is emitted as. */
const SIZE_PROPS = {
  'inline-size': 'min-inline-size',
  'min-inline-size': 'min-inline-size',
  'block-size': 'min-block-size',
  'min-block-size': 'min-block-size',
};

const DISPLAY_MAP = {
  flex: 'block',
  'inline-flex': 'inline-block',
  grid: 'block',
  'inline-grid': 'inline-block',
  block: 'block',
  'inline-block': 'inline-block',
};

/** The first bare `:host {` block of a stylesheet, brace-balanced. */
function bareHostBlock(css) {
  const m = css.match(/(^|\n):host\s*\{/);
  if (!m) return null;
  let i = css.indexOf('{', m.index);
  let depth = 0;
  for (let j = i; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}' && --depth === 0) return css.slice(i + 1, j);
  }
  return null;
}

/** Top-level declarations of a block: `;`-separated outside parens, comments stripped. */
function declarations(block) {
  const clean = block.replace(/\/\*[\s\S]*?\*\//g, '');
  const decls = [];
  let buf = '';
  let paren = 0;
  for (const ch of clean) {
    if (ch === '(') paren++;
    if (ch === ')') paren--;
    if (ch === ';' && paren === 0) {
      if (buf.trim()) decls.push(buf.trim());
      buf = '';
    } else buf += ch;
  }
  if (buf.trim()) decls.push(buf.trim());
  return decls
    .map((d) => {
      const k = d.indexOf(':');
      return k < 0 ? null : { prop: d.slice(0, k).trim(), value: d.slice(k + 1).trim() };
    })
    .filter(Boolean);
}

/** Resolve `var(--_x)` one hop against declarations in the same block. */
function resolvePrivate(value, decls) {
  return value.replace(/var\((--_[\w-]+)\)/g, (whole, name) => {
    const local = decls.find((d) => d.prop === name);
    return local ? local.value : whole;
  });
}

function generateRule(tag) {
  const css = readFileSync(join(COMPONENTS, tag, `${tag}.css`), 'utf8');
  const block = bareHostBlock(css);
  if (!block) throw new Error(`[pre-upgrade] ${tag}: no bare :host block found`);
  const decls = declarations(block);

  const out = [];
  const display = decls.find((d) => d.prop === 'display');
  if (display && DISPLAY_MAP[display.value]) out.push(`display: ${DISPLAY_MAP[display.value]}`);

  const seen = new Set();
  for (const d of decls) {
    const emitted = SIZE_PROPS[d.prop];
    if (!emitted || seen.has(emitted)) continue;
    seen.add(emitted);
    out.push(`${emitted}: ${resolvePrivate(d.value, decls)}`);
  }
  if (!seen.size) {
    throw new Error(
      `[pre-upgrade] ${tag}: bare :host declares no size — remove it from GENERATED or fix the parser`,
    );
  }
  return { tag, decls: out };
}

/* --------------------------------------------------------------- curated */

/**
 * Sizes that are real but not on the bare `:host` — an inner element carries
 * them, or no public property exists. Each entry pins the SOURCE expression it
 * mirrors; the build fails if the source file no longer contains it, so a
 * change there cannot silently strand the floor.
 */
const CURATED = [
  {
    tag: 'md-toolbar',
    why:
      'the height token is declared on the bare :host but CONSUMED in the variant ' +
      'blocks. Both variants share the height; they differ in WIDTH, so the display ' +
      'split below is what varies. An author-written variant attribute is in the ' +
      'light DOM pre-upgrade; the docked default is not, so bare-tag means docked.',
    selector: "md-toolbar:not(.hydrated):not([variant='floating'])",
    sourceFile: 'md-toolbar/md-toolbar.css',
    sourceMustContain:
      '--_height: var(--md-toolbar-container-height, max(48px, calc(64px + var(--md-sys-density-scale, 0) * 4px)))',
    decls: [
      'display: block',
      'min-block-size: var(--md-toolbar-container-height, max(48px, calc(64px + var(--md-sys-density-scale, 0) * 4px)))',
    ],
  },
  {
    tag: 'md-toolbar',
    why:
      'the floating variant is an inline pill — same height floor, but ' +
      'inline-block so an un-upgraded pill does not stretch across its row',
    selector: "md-toolbar[variant='floating']:not(.hydrated)",
    sourceFile: 'md-toolbar/md-toolbar.css',
    sourceMustContain:
      '--_height: var(--md-toolbar-container-height, max(48px, calc(64px + var(--md-sys-density-scale, 0) * 4px)))',
    decls: [
      'display: inline-block',
      'min-block-size: var(--md-toolbar-container-height, max(48px, calc(64px + var(--md-sys-density-scale, 0) * 4px)))',
    ],
  },
  {
    tag: 'md-app-bar',
    why: 'host height is the sum of inner rows; --_row-height lives on .md-app-bar__row',
    sourceFile: 'md-app-bar/md-app-bar.css',
    sourceMustContain:
      '--_row-height: var(--md-app-bar-row-height, max(48px, calc(64px + var(--md-sys-density-scale, 0) * 4px)))',
    decls: [
      'display: block',
      'min-block-size: var(--md-app-bar-row-height, max(48px, calc(64px + var(--md-sys-density-scale, 0) * 4px)))',
    ],
  },
  {
    tag: 'md-navigation-bar',
    why: 'height lives on the inner .md-navigation-bar__container; the token is public on :host',
    sourceFile: 'md-navigation-bar/md-navigation-bar.css',
    sourceMustContain:
      'min-block-size: max(48px, calc(var(--_container-height) + var(--md-sys-density-scale, 0) * 4px))',
    decls: [
      'display: block',
      'min-block-size: max(48px, calc(var(--md-navigation-bar-container-height, 64px) + var(--md-sys-density-scale, 0) * 4px))',
    ],
  },
  {
    tag: 'md-fab',
    why: 'md-fab publishes no container-size property; expression mirrors :host(.md-fab--standard)',
    sourceFile: 'md-fab/md-fab.css',
    sourceMustContain: 'max(40px, calc(56px + var(--md-sys-density-scale, 0) * 4px))',
    decls: [
      'display: inline-block',
      'min-inline-size: max(40px, calc(56px + var(--md-sys-density-scale, 0) * 4px))',
      'min-block-size: max(40px, calc(56px + var(--md-sys-density-scale, 0) * 4px))',
    ],
  },
];

function curatedRule(entry) {
  const src = readFileSync(join(COMPONENTS, entry.sourceFile), 'utf8');
  if (!src.includes(entry.sourceMustContain)) {
    throw new Error(
      `[pre-upgrade] ${entry.tag}: source expression changed in ${entry.sourceFile} — ` +
        `update the curated entry to match (was mirroring: ${entry.sourceMustContain})`,
    );
  }
  return { tag: entry.tag, decls: entry.decls, why: entry.why, selector: entry.selector };
}

/* ------------------------------------------------------------------ emit */

const rules = [...GENERATED.map(generateRule), ...CURATED.map(curatedRule)];

const banner = `/* GENERATED by scripts/emit-pre-upgrade-css.mjs — do not edit.
 *
 * Pre-upgrade size floors for components that occupy persistent layout.
 * Gated on :not(.hydrated) — Stencil's per-element flag — so every rule
 * stops matching the instant the component's own styles take over. The
 * expressions are the components' own public properties and defaults, read
 * from (or pinned to) their source at build time, so they cannot drift.
 *
 * Opt-in: import '@awc-ui/core/css/pre-upgrade.css' beside the token sheet.
 */
`;

const body = rules
  .map(
    (r) =>
      `${r.why ? `/* ${r.tag}: ${r.why} */\n` : ''}${r.selector ?? `${r.tag}:not(.hydrated)`} {\n${r.decls
        .map((d) => `  ${d};`)
        .join('\n')}\n}`,
  )
  .join('\n\n');

writeFileSync(OUT, banner + '\n' + body + '\n');
console.log(
  `emit-pre-upgrade-css: ${rules.length} rules (${GENERATED.length} generated, ${CURATED.length} curated) -> ${OUT.replace(ROOT + '/', '')} (${(banner.length + body.length).toLocaleString()} B)`,
);
