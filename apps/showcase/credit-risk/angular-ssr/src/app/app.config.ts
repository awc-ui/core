import {
  APP_INITIALIZER,
  type ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { PREBOOT_SCRIPT } from '@awc-ui/showcase-kit/preboot';
import { routes } from './app.routes';

/**
 * The preboot script and the component runtime, both injected at bootstrap.
 *
 * WHY NOT IN `index.html`. The preboot IIFE lives in the kit — one copy, shared
 * by all six builds — and pasting it into the template would fork it on the
 * first edit. The runtime URL needs the base href. So both are written here,
 * from the same values every other part of the app reads.
 *
 * WHY AN APP_INITIALIZER RATHER THAN AN IMPORT. Stencil's lazy build resolves
 * its sibling chunks relative to its OWN location. Let Angular's esbuild bundle
 * it and it hunts for entry chunks under the build's hashed output, where
 * nothing wrote them, and every element renders at zero height. So it is never
 * imported: it is fetched as a plain static file from `public/awc-runtime/` by
 * a `<script type="module">` this adds to `<head>`.
 * `scripts/sync-runtime.mjs` carries the full post-mortem.
 *
 * ON A SERVER-RENDERED PAGE NEITHER OF THESE RUNS, AND THAT IS THE POINT OF THE
 * TWO GUARDS. `src/server.ts` writes both tags into the head of every response,
 * carrying the same `data-awc-preboot` / `data-awc-runtime` markers the
 * `querySelector` calls below look for, so the preboot IIFE has already stamped
 * `lang`, `dir`, `data-theme` and `data-density` onto `<html>` before the first
 * paint rather than after the bundle downloads. What is left for this
 * initializer is the case the server cannot cover — `ng serve`, which renders
 * from memory and never goes through `server.ts` — and the dock import below,
 * which is a browser concern in every case.
 *
 * NO `provideClientHydration()`, deliberately. Angular's hydration walks the
 * server-rendered DOM and asserts it matches what the client renders; these
 * components attach shadow roots and rewrite their own internals the moment the
 * runtime lands, which is exactly the kind of third-party mutation hydration is
 * documented not to tolerate. Without it Angular re-renders the app on
 * bootstrap — the server's shadow roots are discarded and Stencil builds them
 * again — which costs a frame and buys certainty. The delivered HTML still does
 * its job: real rows and real figures, painted, for a reader with JavaScript
 * off and for anything reading the page without running it.
 */
function bootScripts() {
  return () => {
    if (typeof document === 'undefined') return;
    const base = document.querySelector('base')?.getAttribute('href') ?? '/';

    if (!document.querySelector('[data-awc-preboot]')) {
      const preboot = document.createElement('script');
      preboot.dataset['awcPreboot'] = '';
      preboot.textContent = PREBOOT_SCRIPT;
      document.head.appendChild(preboot);
    }

    if (!document.querySelector('[data-awc-runtime]')) {
      const runtime = document.createElement('script');
      runtime.type = 'module';
      runtime.dataset['awcRuntime'] = '';
      runtime.textContent =
        `import(${JSON.stringify(`${base}awc-runtime/md3/md3.esm.js`)})` +
        `.catch((e)=>console.error('[awc-ui] component registration failed',e));`;
      document.head.appendChild(runtime);
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
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    { provide: APP_INITIALIZER, useFactory: bootScripts, multi: true },
  ],
};
