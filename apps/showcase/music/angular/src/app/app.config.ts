import { APP_BASE_HREF, LocationStrategy, PathLocationStrategy } from '@angular/common';
import {
  APP_INITIALIZER,
  type ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { PREBOOT_SCRIPT } from '@awc-ui/showcase-kit/preboot';
import { routes } from './app.routes';
import { BASE_PATH } from './lib/routes';

/**
 * The whole application configuration. There is no server half of this file —
 * this build renders in the browser and nowhere else, and unlike the
 * credit-risk vertical there is no server-rendered twin either.
 *
 * WHERE THE MOUNT IS DECLARED. `APP_BASE_HREF` is the router's copy of it, and
 * it is derived from `lib/routes.ts` rather than read out of the `<base>` tag,
 * so the router cannot end up on a different base from the one every link is
 * built with. The `<base href>` in `src/index.html` is still needed and still
 * has to match — it is what makes `main.js`, `styles.css` and the runtime
 * resolve from a document served at `…/angular/households/hh-01/index.html`
 * rather than from that directory. `PathLocationStrategy` is Angular's default,
 * named here because a hash strategy would put every route behind a `#` and the
 * 13 files `scripts/fan-out-routes.mjs` writes would then address nothing.
 *
 * THE PREBOOT SCRIPT, and why it is here twice.
 *
 * ~800 bytes of synchronous IIFE from the kit that reads the showcase state out
 * of the URL (or localStorage) and stamps `lang` / `dir` / `data-theme` /
 * `data-density` onto `<html>`. It has to run BEFORE the stylesheet paints, or a
 * reader who chose the dark theme gets a white page — and one who chose Arabic
 * gets an LTR one — for as long as `main.js` takes to arrive.
 *
 * That is too early for anything Angular does, so the shipped copy is written
 * into `<head>` at BUILD time by `scripts/inject-head.mjs`, which reads the same
 * `PREBOOT_SCRIPT` constant this file imports. What is left for the initializer
 * below is the one case that build step cannot cover: `ng serve`, which composes
 * the document from `src/index.html` in memory and never goes through it. The
 * `[data-awc-preboot]` guard is what makes the two composable — in a real build
 * the tag is already in the head the browser parsed, so this adds nothing.
 *
 * THE COMPONENT RUNTIME IS NOT HERE AT ALL. It is a plain
 * `<script type="module">` in `src/index.html`, pointing at `public/`, for the
 * reason `scripts/sync-runtime.mjs` sets out at length: Stencil's lazy build
 * resolves its sibling chunks relative to its own URL, so it must not go through
 * a bundler. Having it in the document rather than in an initializer also means
 * the browser requests it while it is still parsing `<head>`, in parallel with
 * `main.js`, instead of after Angular has booted.
 */
function bootScripts() {
  return () => {
    // No `typeof document` guard: there is no render here that does not happen
    // in a browser.
    if (!document.querySelector('[data-awc-preboot]')) {
      const preboot = document.createElement('script');
      preboot.dataset['awcPreboot'] = '';
      preboot.textContent = PREBOOT_SCRIPT;
      document.head.appendChild(preboot);
    }

    // The dock, unlike the component runtime, IS safe to bundle: it is plain
    // TypeScript with no lazy chunk resolution of its own. The bare import is
    // the registration — it defines `<awc-showcase-dock>` and stamps the
    // persisted state onto <html>. Nothing here listens for
    // `awc-showcase-change`; `ShowcaseService` owns the single subscription.
    void import('@awc-ui/showcase-kit/dock');
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    /*
     * `withComponentInputBinding()` maps a route parameter straight onto an
     * `@Input()` of the same name, so the drill screens declare `slug`,
     * `handle` and `trackId` and receive them without touching
     * `ActivatedRoute`. Without it those inputs stay undefined and every drill
     * renders its not-found guard — which looks exactly like a bad URL.
     */
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    { provide: LocationStrategy, useClass: PathLocationStrategy },
    { provide: APP_BASE_HREF, useValue: `${BASE_PATH}/` },
    { provide: APP_INITIALIZER, useFactory: bootScripts, multi: true },
  ],
};
