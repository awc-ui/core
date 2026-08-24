/**
 * The single entry point. One HTML document, one JS graph, routing in the
 * browser — that is the whole claim this build exists to make.
 *
 * WHAT NUXT USED TO DO, AND WHERE IT WENT
 *
 * Everything that had to be in `<head>` is now literal markup in `index.html`,
 * because there is no server to compose it: the preboot IIFE, the reporting-date
 * meta, the fonts, the title, and the `<script>` that loads Stencil's lazy
 * runtime from an absolute URL. `app.head` in `nuxt.config.ts` and the `useHead`
 * call in `app.vue` are both gone; `vite.config.ts` interpolates the values that
 * come from the kit so `index.html` stays a template rather than a second copy
 * of the dictionary. The ordering rationale is in `index.html` itself.
 *
 * The two stylesheets were `css: [...]` in the Nuxt config and are now plain
 * imports — they are the one thing that SHOULD go through the bundler. Vite
 * emits them as a `<link>` in `<head>` at build time, so they are still
 * render-blocking stylesheets rather than a flash of unstyled content injected
 * by JavaScript.
 *
 * The two Nuxt plugins collapse into the two statements below. `plugins/awc.ts`
 * registered the `v-awc` directive through `nuxtApp.vueApp`; it is now a plain
 * directive object handed to `app.directive()`. `plugins/dock.client.ts` was a
 * bare import with an empty plugin around it — the import IS the registration,
 * so only the import survives.
 *
 * ORDER MATTERS IN ONE PLACE ONLY: `startRouter()` reads `location.pathname`
 * into the router's ref before `mount()`, so the first render is already the
 * right screen. Mounting first would render the overview and then swap.
 */

import { createApp } from 'vue';
import '@awc-ui/core/css/tokens.css';
import '@awc-ui/showcase-kit/credit-risk/app.css';
// The bare import registers `<awc-showcase-dock>` and, on the client, stamps the
// persisted/URL state onto <html>. Nothing here listens for
// `awc-showcase-change`: `composables/useShowcase.ts` owns the one subscription,
// and a second listener would re-render every screen twice per change.
import '@awc-ui/showcase-kit/dock';
import App from '~/App.vue';
import { awcDirective } from '~/lib/awc';
import { startRouter } from '~/lib/router';

const container = document.getElementById('root');
if (!container) throw new Error('[showcase] #root is missing from index.html');

const app = createApp(App);
app.directive('awc', awcDirective);
startRouter();
app.mount(container);

/**
 * THE COMPONENT RUNTIME, executed after the first render — deliberately, and
 * this is the one ordering in the app that is load-bearing rather than
 * incidental.
 *
 * Vue picks property-versus-attribute per binding on a custom element by testing
 * `key in el`. Mount first and `md-button` is still an unknown element, so
 * `variant` and `icon` go out as ATTRIBUTES and Stencil reads them when it
 * upgrades — which is the DOM every sibling build produces and the DOM
 * `scripts/verify-showcase-parity.mjs` fingerprints. Let the runtime win the
 * race instead and Vue writes properties, no attributes are ever set, and the
 * fingerprint silently loses `variant=tonal` on half its elements. Measured
 * before this line moved out of `index.html`: ten cold loads of identical bytes,
 * two different fingerprints, five each.
 *
 * Nothing is lost from the critical path — `index.html` carries a
 * `modulepreload` for this exact URL, so the bytes are already fetched and
 * compiled by the time this runs, and the full rationale is in that comment.
 *
 * `@vite-ignore` on a runtime-built specifier: Vite must not follow this import,
 * or it bundles Stencil's entry and the lazy chunks are looked for beside the
 * app bundle, where nothing was written. Building the URL from a variable is
 * what keeps it opaque to the analyser.
 */
const runtimeUrl = `${import.meta.env.BASE_URL}awc-runtime/md3/md3.esm.js`;
import(/* @vite-ignore */ runtimeUrl).catch((error: unknown) => {
  console.error('[awc-ui] component registration failed', runtimeUrl, error);
});
