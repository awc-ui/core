import { preserveSsrClasses } from '@awc-ui/core/ssr/classes';
import {
  APP_INITIALIZER,
  APP_BOOTSTRAP_LISTENER,
  ApplicationRef,
  NgZone,
  type ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
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
 */
let finishSsrClasses = () => {};


// Root bootstrap can precede initial route hydration. Wait for Angular's real
// stability boundary outside its zone so this completion does not schedule CD.
function finishClassesAfterStability(app: ApplicationRef, zone: NgZone) {
  return () => {
    if (typeof window === 'undefined') return;
    zone.runOutsideAngular(() => {
      void app.whenStable().then(() => finishSsrClasses());
    });
  };
}

function bootScripts() {
  return () => {
    if (typeof document === 'undefined') return;
    finishSsrClasses = preserveSsrClasses();
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

/**
 * HYDRATION, AND WHY THIS ONE LINE IS THE WHOLE POINT OF THE BUILD.
 *
 * This was absent for a long time, with a comment saying it was absent on
 * purpose because Stencil's components "rewrite their own internals" and
 * hydration is documented not to tolerate third-party mutation. That reasoning
 * was wrong in a way that cost the build everything it advertises.
 *
 * WHAT NOT HAVING IT ACTUALLY DID. Without `provideClientHydration()` Angular
 * does not adopt anything: `bootstrapApplication` empties `<awc-root>` and
 * renders the app from scratch. The server's 206 `<template shadowrootmode>`
 * shadow roots are torn out of the document along with the elements holding
 * them, and Stencil then builds all 206 again in the browser. Nothing LOOKED
 * wrong — that is exactly why it survived: the replacement render is correct,
 * so no screenshot, no text assertion and no element count could see it. What
 * it cost was the claim. Measured with the runtime request blocked, so only
 * Angular's own hydration is observed, `md-badge` came back carrying one
 * attribute — `value`, the one Angular's own template sets — with `class`,
 * `role`, `aria-label`, `variant`, `density` and `s-id` gone and no shadow root
 * at all. `s-id` is the marker Stencil writes on every host it server-rendered
 * and the only thing its client runtime uses to ADOPT that render instead of
 * repeating it. Zero hosts kept it. The server render was real for one paint
 * and then thrown away.
 *
 * WITH IT, Angular retains the existing hosts and their declarative shadow
 * roots. Unknown adoption annotations such as `s-id` survive, but a template's
 * explicit class binding can still replace the entire class attribute. That
 * removes Stencil's `hydrated` and appearance classes even though the shadow
 * root remains styled. The class-preservation handoff above protects those
 * classes until both initial route hydration and component adoption finish.
 *
 * THE ONE THING THAT HAD TO CHANGE FOR THIS TO BE SAFE is in `src/server.ts`,
 * not here. Stencil's hydrate pass writes positional marker comments, and one
 * of them — `<!--r.N-->`, a content reference — lands as the FIRST CHILD of
 * every host, in the LIGHT DOM, which is the tree Angular hydrates. Angular
 * locates a first child with `parent.firstChild` and, in a production build,
 * does not validate what it finds: it would claim that comment as the text node
 * the template says is there and write the label into it, leaving the real text
 * beside it as an orphan no binding ever updates again. So `server.ts` strips
 * those markers from the light DOM only, leaving every annotation inside the
 * shadow roots exactly as written. See `stripLightDomAnnotations` there.
 *
 * Stencil adopts the shadow roots, which Angular does not walk. Host
 * attributes are shared: Angular owns its bindings and Stencil owns its
 * component state, so the initial class handoff preserves that boundary.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideClientHydration(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // Router's bootstrap listener must start initial navigation before this
    // listener subscribes to application stability.
    { provide: APP_BOOTSTRAP_LISTENER, useFactory: finishClassesAfterStability, deps: [ApplicationRef, NgZone], multi: true },
    { provide: APP_INITIALIZER, useFactory: bootScripts, multi: true },
  ],
};
