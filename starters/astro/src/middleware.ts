import type { MiddlewareHandler } from 'astro';
// Astro middleware runs for every page — including prerendered pages at build
// time. Post-process the rendered HTML with the AWC UI hydrate module to inject
// Declarative Shadow DOM for each <md-*> element, so the first paint is styled
// with no flash of inert tags.
import { renderToString } from '@awc-ui/core/hydrate';

export const onRequest: MiddlewareHandler = async (_context, next) => {
  const response = await next();
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return response;
  const html = await response.text();
  if (!html.includes('<md-')) return new Response(html, { status: response.status, headers: response.headers });
  const { html: hydrated } = await renderToString(html, {
    fullDocument: html.includes('<html'),
    serializeShadowRoot: 'declarative-shadow-dom',
    removeScripts: false,
    removeHtmlComments: false,
  });
  return new Response(hydrated, { status: response.status, headers: response.headers });
};
