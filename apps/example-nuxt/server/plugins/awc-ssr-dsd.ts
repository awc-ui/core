// Nitro server plugin: after Nuxt renders the page, run the AWC UI hydrate module
// over the body HTML to inject Declarative Shadow DOM (+ shadow styles) for every
// <md-*> element. Framework-agnostic — the same primitive works in SvelteKit/Astro.
import { renderToString } from '@awc-ui/core/hydrate';

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', async (html) => {
    const body = html.body.join('');
    if (!body.includes('<md-')) return;
    const { html: hydrated } = await renderToString(body, {
      fullDocument: false,
      serializeShadowRoot: 'declarative-shadow-dom',
      removeScripts: false,
      removeHtmlComments: false,
    });
    html.body = [hydrated];
  });
});
