/**
 * Register `<awc-showcase-dock>`.
 *
 * The bare import is the registration: the module defines the element and,
 * on the client, immediately stamps the persisted/URL state onto <html>. It is
 * a no-op in Node, so a `.client` plugin is not strictly necessary — but naming
 * the file `.client` says out loud that nothing about the HTML the server sends
 * depends on it.
 *
 * Nothing here listens for `awc-showcase-change`; `composables/useShowcase.ts`
 * owns the single subscription, and a second listener would re-render every
 * screen twice per change.
 */
import '@awc-ui/showcase-kit/dock';

export default defineNuxtPlugin(() => {});
