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
import { assertSsrResult } from './lib/ssr-validation.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const coreRoot = join(here, '..');

const { renderToString } = await import(join(coreRoot, 'hydrate/index.mjs'));

/** Every `md-*` custom-element tag declared in src/components (derived, not hard-coded). */
function collectTags() {
  const root = join(coreRoot, 'src/components');
  const tags = new Map();
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.tsx')) {
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/@Component\(\{([\s\S]*?)\}\)/g)) {
          const tag = m[1].match(/tag:\s*'(md-[a-z0-9-]+)'/)?.[1];
          if (tag) tags.set(tag, /shadow:\s*(?:true|\{)/.test(m[1]));
        }
      }
    }
  };
  walk(root);
  return [...tags].sort(([a], [b]) => a.localeCompare(b));
}

const tags = collectTags();
console.log(`SSR smoke: rendering ${tags.length} components through @awc-ui/core/hydrate\n`);

const threw = [];

let ok = 0;

for (const [tag, expectsShadow] of tags) {
  try {
    const { html, diagnostics } = await renderToString(`<${tag}></${tag}>`, {
      fullDocument: false,
      serializeShadowRoot: 'declarative-shadow-dom',
    });
    assertSsrResult(tag, { html, diagnostics }, expectsShadow);
    ok += 1;
  } catch (err) {
    threw.push({ tag, err: err?.message ?? String(err) });
  }
}

console.log(`  rendered without throwing : ${ok}/${tags.length}`);
console.log(`  validated shadow expectations: ${ok}/${tags.length}`);

if (threw.length) {
  console.error(`\n✗ ${threw.length} component(s) FAILED SSR render:`);
  for (const { tag, err } of threw) console.error(`    ${tag}: ${err}`);
  process.exit(1);
}
console.log('\n✓ All components render server-side without throwing.');
