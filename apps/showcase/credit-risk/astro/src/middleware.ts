import type { MiddlewareHandler } from 'astro';
import { renderToString } from '@awc-ui/core/hydrate';

/**
 * Server-render every `md-*` element into declarative shadow DOM.
 *
 * This is the thing that makes the Astro build worth having as a separate
 * entry in the framework switcher. The other builds ship inert custom-element
 * tags and let the runtime fill them in, so there is a moment — short, but
 * real, and longer on a cold cache or a slow connection — where the page is a
 * column of unstyled text. Here the shadow roots, and the components' own
 * styles with them, are already in the HTML.
 *
 * WITH ONE EXCEPTION, WHICH IS WORTH BEING PRECISE ABOUT. Tables, chips,
 * meters, cards, breadcrumbs and buttons server-render complete, content and
 * all — every figure on every screen is in the HTML. The CHARTS do not: they
 * draw into a `<canvas>`, and a canvas cannot be painted without a canvas
 * context, which does not exist here. What server-renders for a chart is its
 * frame — heading, subtitle, legend, and the accessible name and data-table
 * description a screen reader reads — with the plot itself appearing when the
 * runtime draws it. So with JavaScript off this page is a complete, readable
 * credit report with blank chart panels, not a finished dashboard. That is a
 * genuine and reasonable limit of canvas rendering, and overstating it would
 * be the easiest thing in the world to do in a file like this.
 *
 * Astro runs middleware for prerendered pages at BUILD time, so despite
 * `output: 'static'` this executes once per page during `astro build` and never
 * in production. The deployed artifact is plain HTML.
 *
 * The two `remove*: false` options matter. `removeScripts` would strip the
 * preboot IIFE and the runtime import — the page would render correctly once
 * and then never theme, never switch language and never gain a dock.
 * `removeHtmlComments` would strip Astro's own island markers.
 */
export const onRequest: MiddlewareHandler = async (_context, next) => {
  const response = await next();

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  // Nothing to hydrate: skip the parse rather than pay for it on a 404 page.
  if (!html.includes('<md-')) {
    return new Response(html, { status: response.status, headers: response.headers });
  }

  const { html: hydrated } = await renderToString(html, {
    fullDocument: html.includes('<html'),
    serializeShadowRoot: 'declarative-shadow-dom',
    removeScripts: false,
    removeHtmlComments: false,
  });

  return new Response(hydrated, { status: response.status, headers: response.headers });
};
