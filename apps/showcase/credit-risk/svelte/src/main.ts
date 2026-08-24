/**
 * The single entry point. One HTML document, one JS graph, routing in the
 * browser — that is the whole claim this build exists to make.
 *
 * WHAT `src/routes/+layout.svelte` AND `src/app.html` USED TO DO, AND WHERE IT WENT
 *
 * Everything that had to be in `<head>` is now literal markup in `index.html`,
 * because there is no server to compose it: the preboot IIFE, the reporting-date
 * meta, the render-mode marker, the fonts, and the script that loads Stencil's
 * lazy runtime from an absolute URL. `vite.config.ts` interpolates the values
 * that come from the kit so `index.html` stays a template rather than a second
 * copy of the dictionary. The ordering rationale is in `index.html` itself.
 *
 * The two stylesheets stayed in the module graph — they are the one thing that
 * SHOULD go through the bundler, exactly as they did from the layout. Vite emits
 * them as a `<link>` in `<head>` at build time, so they are still render-blocking
 * stylesheets rather than a flash of unstyled content injected by JS.
 *
 * NO HYDRATION. `new App({ target })` and not `hydrate: true`: the shell that
 * arrives from the host is empty, so there is nothing to adopt. That is the
 * difference this build exists to demonstrate against its SSR twin, and it is
 * one constructor option wide.
 */

import '@awc-ui/core/css/tokens.css';
import '@awc-ui/showcase-kit/credit-risk/app.css';
import App from './App.svelte';

const target = document.getElementById('root');
if (!target) throw new Error('[showcase] #root is missing from index.html');

export default new App({ target });
