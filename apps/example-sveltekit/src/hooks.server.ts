import type { Handle } from '@sveltejs/kit';
import { renderToString } from '@awc-ui/core/hydrate';
import { createPageTransform } from '@awc-ui/core/ssr/sveltekit';

export const handle: Handle = ({ event, resolve }) => resolve(event, {
  // One buffer per request: chunks are not necessarily well-formed HTML.
  transformPageChunk: createPageTransform(async (html) => {
    if (!html.includes('<md-')) return html;
    const result = await renderToString(html, {
      fullDocument: true,
      serializeShadowRoot: 'declarative-shadow-dom',
      removeScripts: false,
      removeHtmlComments: false,
    });
    const errors = result.diagnostics.filter((d) => d.level === 'error');
    if (errors.length) throw new Error(errors.map((d) => d.messageText).join(' | '));
    if (!result.html) throw new Error('AWC SSR returned no HTML');
    return result.html;
  }),
});
