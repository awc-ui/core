import { mergeApplicationConfig, type ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';

/**
 * The prerender pass. Everything the browser config provides, plus Angular's
 * server renderer.
 *
 * Nothing about the component runtime appears here on purpose: it is a browser
 * module and there is no DOM to register it against. What the prerender emits is
 * the inert `md-*` markup with every figure already in it — see
 * `components/element.ts` for why every string prop is an ATTRIBUTE binding
 * rather than a property one, which is what makes that true.
 */
export const serverConfig: ApplicationConfig = mergeApplicationConfig(appConfig, {
  providers: [provideServerRendering()],
});
