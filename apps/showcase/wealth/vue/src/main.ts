/**
 * The single entry point. One HTML document, one JS graph, routing in the
 * browser — that is the whole claim this build exists to make.
 *
 * Everything that had to be in `<head>` is literal markup in `index.html`,
 * because there is no server to compose it: the preboot IIFE, the reporting-date
 * meta, the fonts, and the `modulepreload` for Stencil's lazy runtime.
 * `vite.config.ts` interpolates the values that come from the kit so
 * `index.html` stays a template rather than a second copy of the dictionary.
 *
 * The three stylesheets are plain imports — they are the one thing that SHOULD
 * go through the bundler. Vite emits them as a `<link>` in `<head>` at build
 * time, so they are still render-blocking stylesheets rather than a flash of
 * unstyled content injected by JavaScript.
 *
 * ORDER MATTERS IN ONE PLACE ONLY: `startRouter()` reads `location.pathname`
 * into the router's ref before `mount()`, so the first render is already the
 * right screen. Mounting first would render the overview and then swap.
 */

import { createApp } from 'vue';
/*
 * THE FONTS, SELF-HOSTED — see the note in index.html for why they are not
 * `<link>`s any more. `material-symbols` ships the same variable face Google
 * serves with its axes intact, verified against the FILL axis the icons depend
 * on. Only the Outlined cut: the kit's `app.css` asks for Rounded but never wins
 * it (tokens.css sets the same property on `:root`, app.css on `html`), so
 * self-hosting Rounded would emit ~4.9 MB nobody renders.
 */
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import 'material-symbols/outlined.css';
import '@awc-ui/core/css/tokens.css';
// The library's pre-upgrade size floors: every layout-critical `md-*` holds its
// settled box from the FIRST frame, before its lazy chunk arrives, and each
// rule self-retires on `.hydrated`. The credit-risk twin predates this sheet;
// the wealth React build imports it, so this port does too.
import '@awc-ui/core/css/pre-upgrade.css';
import '@awc-ui/showcase-kit/wealth/app.css';
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
 * `key in el`. Mount first and `md-chip` is still an unknown element, so
 * `variant` and `icon` go out as ATTRIBUTES and Stencil reads them when it
 * upgrades — which is the DOM every sibling build produces and the DOM
 * `scripts/verify-showcase-parity.mjs` fingerprints. Let the runtime win the
 * race instead and Vue writes properties, no attributes are ever set, and the
 * fingerprint silently loses `variant=` on half its elements. Measured on the
 * credit-risk twin before this line moved out of `index.html`: ten cold loads
 * of identical bytes, two different fingerprints, five each.
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
