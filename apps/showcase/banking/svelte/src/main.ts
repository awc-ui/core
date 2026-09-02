/**
 * The single entry point. One HTML document, one JS graph, routing in the
 * browser — that is the whole claim this build makes.
 *
 * Everything that had to be in `<head>` is literal markup in `index.html`,
 * because there is no server to compose it: the preboot IIFE, the
 * reporting-date meta, the render-mode marker, the fonts, and the script that
 * loads Stencil's lazy runtime from an absolute URL. `vite.config.ts`
 * interpolates the values that come from the kit so `index.html` stays a
 * template rather than a second copy of the dictionary. The ordering rationale
 * is in `index.html` itself.
 *
 * The three stylesheets stay in the module graph — they are the one thing that
 * SHOULD go through the bundler. Vite emits them as a `<link>` in `<head>` at
 * build time, so they are still render-blocking stylesheets rather than a
 * flash of unstyled content injected by JS.
 */

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
// rule self-retires on `.hydrated`. The credit-risk Svelte build predates this
// sheet; the wealth React build imports it, so this port does too.
import '@awc-ui/core/css/pre-upgrade.css';
import '@awc-ui/showcase-kit/banking/app.css';
import App from './App.svelte';

const target = document.getElementById('root');
if (!target) throw new Error('[showcase] #root is missing from index.html');

export default new App({ target });
