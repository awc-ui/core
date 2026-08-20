/**
 * SSR smoke gate — renders every component through the hydrate output and asserts
 * `renderToString` (a) never throws and (b) emits Declarative Shadow DOM.
 *
 * This is the Phase-1 safety net from the SSR audit: server rendering can regress
 * silently (an unguarded browser API sneaks into render/willLoad), so gate it in CI.
 * Run:  pnpm --filter @awc-ui/core test:ssr   (after a build)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const coreRoot = join(here, '..');

const { renderToString } = await import(join(coreRoot, 'hydrate/index.mjs'));

/** Every `md-*` custom-element tag declared in src/components (derived, not hard-coded). */
function collectTags() {
  const root = join(coreRoot, 'src/components');
  const tags = new Set();
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.tsx')) {
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/tag:\s*'(md-[a-z0-9-]+)'/g)) tags.add(m[1]);
      }
    }
  };
  walk(root);
  return [...tags].sort();
}

const tags = collectTags();
console.log(`SSR smoke: rendering ${tags.length} components through @awc-ui/core/hydrate\n`);

const threw = [];
const noDsd = [];
let ok = 0;

for (const tag of tags) {
  try {
    const { html, diagnostics } = await renderToString(`<${tag}></${tag}>`, {
      fullDocument: false,
      serializeShadowRoot: 'declarative-shadow-dom',
    });
    const fatal = (diagnostics ?? []).filter((d) => d.level === 'error');
    if (fatal.length) throw new Error(fatal.map((d) => d.messageText).join(' | '));
    if (!html || !html.includes(`<${tag}`)) throw new Error('output missing the element');
    if (!/shadowrootmode|<template/.test(html)) noDsd.push(tag); // shadow comps should emit DSD
    ok += 1;
  } catch (err) {
    threw.push({ tag, err: err?.message ?? String(err) });
  }
}

console.log(`  rendered without throwing : ${ok}/${tags.length}`);
console.log(`  emitted Declarative SDOM  : ${ok - noDsd.length}/${ok}`);
if (noDsd.length) console.log(`  (no DSD — expected only for non-shadow comps): ${noDsd.join(', ')}`);

if (threw.length) {
  console.error(`\n✗ ${threw.length} component(s) FAILED SSR render:`);
  for (const { tag, err } of threw) console.error(`    ${tag}: ${err}`);
  process.exit(1);
}
console.log('\n✓ All components render server-side without throwing.');
