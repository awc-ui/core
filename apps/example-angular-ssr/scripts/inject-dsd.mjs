// Postbuild: Angular prerenders the app to inert <md-*> tags. Run the AWC UI
// hydrate module over each built HTML file to inject Declarative Shadow DOM —
// the same primitive as the Nuxt/SvelteKit/Astro hooks, applied to Angular's
// prerendered output.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { renderToString } = await import('@awc-ui/core/hydrate');

const browserDir = join(here, '..', 'dist', 'browser');
let touched = 0;
for (const f of readdirSync(browserDir)) {
  if (!f.endsWith('.html')) continue;
  const p = join(browserDir, f);
  const html = readFileSync(p, 'utf8');
  if (!html.includes('<md-')) continue;
  const { html: hydrated } = await renderToString(html, {
    fullDocument: html.includes('<html'),
    serializeShadowRoot: 'declarative-shadow-dom',
    removeScripts: false,
    removeHtmlComments: false,
  });
  writeFileSync(p, hydrated);
  touched += 1;
}
console.log(`inject-dsd: rewrote ${touched} prerendered HTML file(s) with Declarative Shadow DOM.`);
