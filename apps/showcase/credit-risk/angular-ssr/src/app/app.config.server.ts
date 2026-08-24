import { mergeApplicationConfig, type ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';

/**
 * The per-request render. Everything the browser config provides, plus
 * Angular's server renderer.
 *
 * `APP_BASE_HREF` is NOT here. It is a fact about the request being served, so
 * `src/server.ts` passes it in that call's `providers`, next to the URL it
 * belongs to.
 *
 * Nothing about the component runtime appears here either, and for the same
 * reason it never did: it is a browser module and there is no DOM to register
 * it against. What Angular emits is the inert `md-*` markup with every figure
 * already in it — see `components/element.md` for why every string prop is an
 * ATTRIBUTE binding rather than a property one, which is what makes that true.
 * `src/server.ts` then gives each of those tags its shadow root, and writes the
 * runtime's own `<script>` into the head it sends.
 */
export const serverConfig: ApplicationConfig = mergeApplicationConfig(appConfig, {
  providers: [provideServerRendering()],
});
