/**
 * The one place `@awc-ui/core/hydrate` is called.
 *
 * This app now has TWO server targets and they must not disagree about what
 * "server-rendered" means:
 *
 *   - `server.mjs`, the long-lived Node server. `pnpm start`, port 4610, the
 *     thing `scripts/verify-ssr.mjs` and `scripts/verify-ssr-adoption.mjs`
 *     drive. It buffers each response and calls in here.
 *   - `app/awc-dsd/route.ts`, a Node route handler. Netlify's Next runtime has
 *     no long-lived process to hold a port and does not run `server.mjs`, so on
 *     that target `middleware.ts` rewrites every document request into the
 *     route handler, which fetches the page and calls in here.
 *
 * Both paths therefore produce byte-identical component markup, because the
 * options below — especially `maxHydrateCount` — are declared once. They were
 * previously inline in `server.mjs`; a second copy in the route handler would
 * have been correct on the day it was written and silently wrong on the first
 * day someone tuned one of them.
 */

import { renderToString } from '@awc-ui/core/hydrate';

export {
  DSD_HEADER,
  DSD_HEADER_VALUE,
  DSD_ROUTE,
  PATH_HEADER,
  PATH_PARAM,
  RAW_HEADER,
  RAW_PARAM,
  RSC_HEADERS,
  needsShadowRoots,
} from './dsd-protocol.mjs';

/**
 * Options copied from the sibling starters, plus one.
 *
 * `maxHydrateCount` defaults to 300. These screens go well past that — the
 * facility and counterparty tables alone are hundreds of `md-table-cell`s — and
 * the limit is silent: components past it are left as inert tags, so the page
 * looks half server-rendered and nothing says why.
 */
export const HYDRATE_OPTIONS = {
  serializeShadowRoot: 'declarative-shadow-dom',
  removeScripts: false,
  removeHtmlComments: false,
  removeUnusedStyles: false,
  maxHydrateCount: 10_000,
};

/** Inject Declarative Shadow DOM for every `md-*` element in a rendered page. */
export async function injectShadowRoots(html) {
  const { html: hydrated, diagnostics } = await renderToString(html, {
    ...HYDRATE_OPTIONS,
    fullDocument: html.includes('<html'),
  });
  const errors = (diagnostics ?? []).filter((d) => d.level === 'error');
  if (errors.length) {
    throw new Error(errors.map((d) => d.messageText).join(' | '));
  }
  return hydrated;
}
