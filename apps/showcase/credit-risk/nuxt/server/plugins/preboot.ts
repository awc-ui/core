/**
 * Put the preboot script FIRST in `<head>`, on every rendered page.
 *
 * It is a synchronous IIFE that reads the showcase state from the URL, or
 * localStorage, and stamps `lang`, `dir`, `data-theme` and `data-density` onto
 * <html> before the first paint. Placed after a stylesheet it would still run
 * before paint, but the browser blocks it on the CSS download first — hence
 * `unshift` rather than `push`, and hence a Nitro hook rather than `app.head`
 * in the config, which cannot promise a position relative to Nuxt's own tags.
 *
 * It does NOT apply the accent preset: that is ~2.8 kB of palette per seed and
 * would blow the preboot budget, so `plugins/dock.client.ts` injects it a
 * moment later. A non-default accent therefore has a brief default-violet frame
 * on a cold load. Documented trade, made in the kit.
 *
 * The runtime import goes in the same pass, straight after, because it needs
 * the base path — see `nuxt.config.ts` for why the components are never
 * bundled. It still matters now that the server paints the components' shadow
 * roots into the response: the runtime is what makes them INTERACTIVE, and it
 * adopts the server's declarative shadow roots rather than rebuilding them.
 *
 * The per-request evidence that this is a live render lives one file over, in
 * `awc-ssr-dsd.ts`, beside the transform it is evidence of.
 */
import { PREBOOT_SCRIPT } from '@awc-ui/showcase-kit/preboot';
import { REPORTING_DATE } from '@awc-ui/showcase-kit/data';
import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const { basePath } = createRoutes('nuxt');
const runtimeUrl = `${basePath}/awc-runtime/md3/md3.esm.js`;

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:html', (html) => {
    html.head.unshift(
      `<script>${PREBOOT_SCRIPT}</script>`,
      `<meta name="awc-reporting-date" content="${REPORTING_DATE}">`,
      `<script type="module">import(${JSON.stringify(runtimeUrl)})` +
        `.catch((e)=>console.error('[awc-ui] component registration failed',e));</script>`,
    );
  });
});
