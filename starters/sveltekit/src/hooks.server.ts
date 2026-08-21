import type { Handle } from '@sveltejs/kit';
// Server hook: post-process the rendered page with the AWC UI hydrate module to
// inject Declarative Shadow DOM for every <md-*> element (same framework-agnostic
// primitive as the Nuxt Nitro hook and the Astro middleware). renderToString
// preserves the surrounding document — head, %sveltekit.head% assets, and
// hydration scripts.
import { renderToString } from '@awc-ui/core/hydrate';

export const handle: Handle = async ({ event, resolve }) => {
  return resolve(event, {
    transformPageChunk: async ({ html }) => {
      if (!html.includes('<md-')) return html;
      const { html: hydrated } = await renderToString(html, {
        fullDocument: html.includes('<html'),
        serializeShadowRoot: 'declarative-shadow-dom',
        removeScripts: false,
        removeHtmlComments: false,
      });
      return hydrated;
    },
  });
};
