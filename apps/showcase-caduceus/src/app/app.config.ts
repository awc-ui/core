import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// Client-only: register the custom elements so the prerendered DSD hydrates.
// Use the self-contained dist-custom-elements build (auto-defines on import) — the
// lazy /loader doesn't bundle cleanly under Angular's esbuild (its computed
// entry-chunk imports + .map refs), whereas the custom-elements build does.
function registerElements() {
  return async () => {
    if (typeof window === 'undefined') return;
    await import('@awc-ui/core/dist/components');
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(),
    { provide: APP_INITIALIZER, useFactory: registerElements, multi: true },
  ],
};
