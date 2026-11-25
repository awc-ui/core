import { preserveSsrClasses } from '@awc-ui/core/ssr/classes';
import { ApplicationConfig, APP_INITIALIZER, APP_BOOTSTRAP_LISTENER, ApplicationRef, NgZone } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';

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

// Register the elements used by this template so they adopt the prerendered DSD.
function registerElements() {
  return async () => {
    if (typeof window === 'undefined') return;
    finishSsrClasses = preserveSsrClasses();
    const components = await Promise.all([
      import('@awc-ui/core/components/md-badge'),
      import('@awc-ui/core/components/md-button'),
      import('@awc-ui/core/components/md-card'),
      import('@awc-ui/core/components/md-checkbox'),
    ]);
    for (const component of components) component.defineCustomElement();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(),
    { provide: APP_BOOTSTRAP_LISTENER, useFactory: finishClassesAfterStability, deps: [ApplicationRef, NgZone], multi: true },
    { provide: APP_INITIALIZER, useFactory: registerElements, multi: true },
  ],
};
