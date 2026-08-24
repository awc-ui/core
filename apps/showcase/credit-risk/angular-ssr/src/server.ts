/**
 * The runtime server for the `angular-ssr` showcase build.
 *
 *   node dist/server/server.mjs        # after `pnpm build`
 *   PORT=4613 node dist/server/server.mjs
 *
 * `angular.json` points `ssr.entry` here, so the Angular builder compiles this
 * file with the rest of the app and emits it as `dist/server/server.mjs`, with
 * `import './polyfills.server.mjs'` (zone.js/node and
 * `@angular/platform-server/init`) prepended by the builder. `pnpm start` runs
 * that one file.
 *
 * WHAT THIS FILE IS FOR, IN ORDER OF WHY IT EXISTS
 *
 * 1. IT RENDERS PER REQUEST. This build used to prerender all 95 routes to
 *    static files at build time. `CommonEngine.render()` is now called for
 *    every request, and the two `<meta>` markers below say so in a way that can
 *    be checked from outside — see `stampRenderMarkers`.
 * 2. IT INJECTS DECLARATIVE SHADOW DOM. Angular's renderer emits
 *    `<md-card class="panel">…</md-card>` — a bare custom-element tag with no
 *    shadow root, because a custom element is only ever upgraded by a browser.
 *    `renderToString` from `@awc-ui/core/hydrate` takes the finished HTML string
 *    and gives every `md-*` element the shadow root and the styles it would
 *    have had in a browser. The canonical use of that module is
 *    `apps/showcase/credit-risk/astro/src/middleware.ts`; this is the same eight
 *    lines hung off Angular's response instead of Astro's.
 * 3. IT PUTS THE PREBOOT SCRIPT AND THE COMPONENT RUNTIME IN THE HEAD IT SENDS.
 *    Prerendering could not: `bootScripts()` in `app/app.config.ts` needs a
 *    `document`, and there is no global one in a Node render, so both script
 *    tags were only ever added in the browser once `main.js` had run. That was
 *    survivable when the first paint was already unstyled. It is not now — a
 *    page that arrives fully painted in the wrong theme, and in the wrong
 *    direction for Arabic, until a bundle downloads is worse than one that
 *    arrives unpainted. So the server writes both tags itself, carrying the
 *    same `data-awc-preboot` / `data-awc-runtime` markers `bootScripts()` looks
 *    for, which is what stops the client adding a second copy.
 *
 * WHAT SERVER RENDERING DOES NOT DO, AND THIS IS NOT A DEFECT TO BE FIXED:
 * charts draw into a `<canvas>`, and a canvas cannot be painted without a
 * canvas context. What arrives for a chart is its FRAME — heading, subtitle,
 * legend, accessible name and the data-table description a screen reader reads
 * — with the plot appearing when the runtime draws it. Every other figure on
 * every screen, tables and meters and chips included, is in the HTML.
 */

import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToString } from '@awc-ui/core/hydrate';
import { REPORTING_DATE } from '@awc-ui/showcase-kit/data';
import { PREBOOT_SCRIPT } from '@awc-ui/showcase-kit/preboot';
import bootstrap from './main.server';
import { BASE_PATH } from './app/lib/routes';

/**
 * `/showcase/credit-risk/angular-ssr/`, with the trailing slash Angular's
 * `APP_BASE_HREF` wants. `BASE_PATH` comes from `app/lib/routes.ts`, which
 * builds it from the kit's `SHOWCASE_BASE` and this build's framework id, and
 * has no trailing slash; it is the same string `angular.json` writes into
 * `<base href>`, derived rather than typed a third time.
 */
const BASE_HREF = `${BASE_PATH}/`;

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = join(serverDistFolder, 'index.server.html');

const port = Number(process.env['PORT']) || 4613;
const host = process.env['HOST'] ?? 'localhost';

/**
 * Options copied from the sibling builds, plus one.
 *
 * `maxHydrateCount` defaults to 300. These screens go well past it — the
 * facility and counterparty tables alone are hundreds of `md-table-cell`s — and
 * the limit is SILENT: components past it are left as inert tags, so the page
 * looks half server-rendered and nothing says why.
 *
 * The two `remove*: false` are the ones `astro/src/middleware.ts` records.
 * `removeScripts` would strip the preboot IIFE and the runtime import that
 * `injectHead` just added, leaving a page that paints once and then never
 * themes, never switches language and never gains a dock.
 * `removeHtmlComments` now has a second job as well: Angular's hydration
 * anchors ARE comments — `<!--container-->`, `<!--ngetn-->`, `<!--ngtns-->` —
 * and stripping them would leave the client walking a tree it cannot map.
 *
 * `clientHydrateAnnotations` is Stencil's default and is written out here
 * because everything below depends on it. It is what puts `s-id` on each host
 * and `c-id` on the shadow children, and `s-id` is the only signal Stencil's
 * client runtime has that this shadow root was already rendered. Turn it off
 * and the runtime does not rebuild the shadow root — it APPENDS a second copy
 * to it, and every component on every screen renders twice. It also emits
 * marker COMMENTS, one of which lands in Angular's tree; `injectShadowRoots`
 * takes those back out again, and only there. See `stripLightDomAnnotations`.
 */
const HYDRATE_OPTIONS = {
  serializeShadowRoot: 'declarative-shadow-dom',
  removeScripts: false,
  removeHtmlComments: false,
  removeUnusedStyles: false,
  clientHydrateAnnotations: true,
  maxHydrateCount: 10_000,
} as const;

const RUNTIME_IMPORT =
  `import(${JSON.stringify(`${BASE_HREF}awc-runtime/md3/md3.esm.js`)})` +
  `.catch((e)=>console.error('[awc-ui] component registration failed',e));`;

/**
 * Insert a fragment at the top of `<head>`, after the charset declaration.
 *
 * After it, because `<meta charset>` has to stay inside the first 1024 bytes
 * and putting anything of ours in front of it is a needless way to spend that
 * budget. Before everything else, because the preboot script is synchronous and
 * a browser will not run it until the stylesheets in front of it have
 * downloaded — which is precisely the wait it exists to avoid.
 */
function injectHead(html: string, fragment: string): string {
  const charset = /<meta\s+charset=["']?[\w-]+["']?\s*\/?>/i.exec(html);
  if (charset) {
    const at = charset.index + charset[0].length;
    return html.slice(0, at) + fragment + html.slice(at);
  }
  const head = /<head(?:\s[^>]*)?>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + fragment + html.slice(at);
  }
  return fragment + html;
}

/**
 * The two markers `scripts/verify-ssr.mjs` reads, and the reason they are
 * added AFTER the hydrate pass rather than before it.
 *
 * The harness fetches a page twice, 1.1 s apart, and fails the build if the
 * timestamps match — a prerendered file returns byte-identical HTML — and fails
 * it just as hard if there is no timestamp at all, on the stated grounds that
 * silence is not evidence. So the marker must survive everything, including a
 * hydrate pass that threw and left us serving the raw Angular output. Stamping
 * last is what makes that true by construction rather than by hoping the
 * serializer preserves a `<meta>`.
 *
 * `renderedAt` is taken by the caller before Angular starts rendering, so it
 * dates the REQUEST rather than the moment the last byte was assembled.
 */
function stampRenderMarkers(html: string, renderedAt: string): string {
  return injectHead(
    html,
    '<meta name="awc-render-mode" content="ssr">' +
      `<meta name="awc-rendered-at" content="${renderedAt}">`,
  );
}

const TEMPLATE_OPEN = '<template';
const TEMPLATE_CLOSE = '</template>';

/**
 * Stencil's positional marker comments: `<!--r.6133-->` for a host's content
 * reference, `<!--t.6133.0.1-->` before a slotted text node. Matched by their
 * shape — a short lowercase tag, a dot, then digits and dots — which nothing
 * else in this document has. Angular's own bookkeeping comments are words:
 * `<!--container-->`, `<!--ngetn-->`, `<!--ngtns-->`, `<!--ng-container-->`.
 * None of them match, and none of them MUST: they are the anchors Angular
 * hydrates against, and removing one would break the very thing this protects.
 *
 * Today only `r.` actually reaches the light DOM — every component here is
 * shadow, so there is no slot relocation and no light-DOM `c-id`. The pattern
 * covers the family anyway: a marker Angular does not expect is SILENT damage
 * in a production build, and widening a regex is the cheap end of that trade.
 */
const STENCIL_MARKER = /<!--[a-z]+\.[\d.]+-->/g;

/**
 * The shadow DOM is Stencil's. The light DOM is Angular's. Keep each one's
 * bookkeeping out of the other's tree.
 *
 * WHY THIS EXISTS. `clientHydrateAnnotations` — on by default, and the reason
 * `s-id` reaches the browser at all — makes Stencil write marker COMMENTS as
 * well as `s-id`/`c-id` attributes. The attributes are harmless: Angular's
 * hydration never enumerates attributes it did not put there, which is exactly
 * why `s-id` survives and the runtime can adopt the server's shadow roots. The
 * comments are not. The content reference is written as the first child of
 * every host:
 *
 *     <md-button … s-id="6133"><!--r.6133--> Overview </md-button>
 *
 * and the light DOM is the tree `provideClientHydration()` walks. Angular
 * resolves a first child as `parent.firstChild` and validates the result only
 * under `ngDevMode` — in the production build shipped here there is no check at
 * all. It would claim that comment as the text node its template says is there,
 * write " Overview " into the comment on the first change-detection pass, and
 * leave the real text beside it as an orphan no binding ever touches again: a
 * label that looks right and then never changes language. Every following
 * sibling in that view is off by one node for the same reason.
 *
 * So the annotations stay ON, which is what buys the adoption, and the markers
 * are removed FROM THE LIGHT DOM ONLY. Inside a shadow root every annotation is
 * left exactly as written — Angular never walks in there, and Stencil's runtime
 * needs `s-id`, `c-id` and the marker comments intact to take the server's vdom
 * instead of rebuilding it.
 *
 * WHY A NESTING WALK AND NOT A REGEX OVER THE WHOLE STRING: the same marker
 * text appears in both trees, so the only thing telling them apart is position.
 * This tracks `<template>` depth and rewrites a run of HTML only at depth zero —
 * Angular's side of the boundary.
 *
 * `apps/showcase/credit-risk/nuxt/server/plugins/awc-ssr-dsd.ts` carries the
 * same walk for the same reason. Vue's hydration fails loudly (a logged
 * mismatch and a re-created subtree) and Angular's fails silently, but the
 * boundary being crossed is the same one.
 */
function stripLightDomAnnotations(html: string): string {
  /*
   * Depth of `<template>` nesting. Depth 0 is the light DOM — the only place
   * anything is rewritten. Every `<template>` counts, not only the shadow
   * roots: a plain one is inert content Angular does not hydrate either, so the
   * markers inside it are equally none of our business.
   */
  let depth = 0;
  let out = '';
  let i = 0;

  /** Append `chunk`, dropping Stencil's markers only when this is Angular's tree. */
  const emit = (chunk: string) => {
    out += depth === 0 ? chunk.replace(STENCIL_MARKER, '') : chunk;
  };

  for (;;) {
    const open = html.indexOf(TEMPLATE_OPEN, i);
    const close = html.indexOf(TEMPLATE_CLOSE, i);
    if (close < 0) {
      emit(html.slice(i));
      return out;
    }

    if (open >= 0 && open < close) {
      // Everything up to and including `<template` is still at the OUTER depth.
      emit(html.slice(i, open + TEMPLATE_OPEN.length));
      i = open + TEMPLATE_OPEN.length;
      depth++;
      continue;
    }

    // …and everything up to and including `</template>` is at the INNER depth,
    // so it is emitted before the depth drops rather than after.
    emit(html.slice(i, close + TEMPLATE_CLOSE.length));
    i = close + TEMPLATE_CLOSE.length;
    depth = Math.max(0, depth - 1);
  }
}

/**
 * Give every `md-*` element in a rendered page its declarative shadow root,
 * then hand the light DOM back to Angular unannotated.
 */
async function injectShadowRoots(html: string): Promise<string> {
  const { html: hydrated, diagnostics } = await renderToString(html, {
    ...HYDRATE_OPTIONS,
    fullDocument: html.includes('<html'),
  });
  const errors = (diagnostics ?? []).filter((d) => d.level === 'error');
  if (errors.length) throw new Error(errors.map((d) => d.messageText).join(' | '));
  // `html` is nullable on `HydrateResults` — a parse that produced no document
  // reports itself this way rather than by throwing. Treat it as the failure it
  // is; the caller serves the untransformed HTML.
  if (hydrated === null) throw new Error('hydrate produced no document');
  return stripLightDomAnnotations(hydrated);
}

const commonEngine = new CommonEngine();

export function app(): express.Express {
  const server = express();
  server.disable('x-powered-by');
  // Every rendered document is `no-store` and carries a timestamp that differs
  // from the last one, so an entity tag can never match. Computing one is a
  // hash over a megabyte of HTML in exchange for nothing.
  server.disable('etag');

  /**
   * `/showcase/credit-risk/angular-ssr` and `/showcase/credit-risk/angular-ssr/`
   * are DIFFERENT paths here, and they have to be: with Express's default loose
   * routing a route declared for the first also matches the second, so the
   * redirect below would answer the mount itself and send it to itself. The
   * routes are ordered so the render wins in any case; this makes the two
   * spellings distinct rather than merely ordered.
   */
  server.set('strict routing', true);

  /**
   * The build's own files: `main.js`, the lazy chunks, the two stylesheets, and
   * `awc-runtime/md3/` — Stencil's lazy browser build, copied into `public/` by
   * `scripts/sync-runtime.mjs` and served from a static URL so it can resolve
   * its sibling chunks relative to itself.
   *
   * `index: false` is load-bearing. With SSR on and prerendering off the
   * builder still writes ONE `index.html` into `dist/browser/` — the
   * client-side-render shell, an empty `<awc-root>` with the critical CSS
   * inlined. `express.static` would happily serve it for `/…/angular-ssr/` and
   * every check in `verify-ssr.mjs` would fail against an empty document that
   * looks, from the outside, exactly like a server that is not rendering.
   */
  server.use(BASE_PATH, express.static(browserDistFolder, { index: false, redirect: false }));

  /** The six screens, and the 95 URLs they answer on. */
  server.get(`${BASE_PATH}/*`, (req, res, next) => {
    // Before the render, not after: this dates the request.
    const renderedAt = new Date().toISOString();
    const { protocol, originalUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        /**
         * NO `publicPath`, DELIBERATELY, and it is the strongest guarantee in
         * this file. `CommonEngine.render()` starts by looking for
         * `<publicPath>/<pathname>/index.html` and, if it finds one carrying
         * `ng-server-context="ssg"`, returns THAT FILE instead of rendering.
         * Sensible for an app that prerenders some routes and renders the rest;
         * here it is the one behaviour that could quietly turn this build back
         * into the static one it replaced — a stale `dist/` from before the
         * conversion would be enough. Omitting `publicPath` makes the lookup
         * return early every time, so there is no path through this server that
         * serves a page it did not just render.
         *
         * `inlineCriticalCss: false` follows from it: Critters needs a
         * directory to resolve stylesheets against and `publicPath` was it. It
         * is not a loss. Inlining critical CSS means running Critters over a
         * full document on every request, and the two stylesheets here are
         * design tokens and page furniture that the components do not wait on.
         */
        inlineCriticalCss: false,
        /**
         * The router's own base. Angular's scaffold passes express's `req.baseUrl`
         * here, which is `''` for a server that is not mounted behind a router —
         * and an empty base means the router tries to match
         * `/showcase/credit-risk/angular-ssr/watchlist` as a route and matches
         * nothing. The base is a fact about this build, so it comes from the
         * kit.
         */
        providers: [{ provide: APP_BASE_HREF, useValue: BASE_HREF }],
      })
      .then(async (rendered) => {
        let html = rendered;

        // Nothing to hydrate — a screen that failed to match a route. Skip the
        // parse rather than pay for it on a page with no components in it.
        if (html.includes('<md-')) {
          html = injectHead(
            html,
            `<script data-awc-preboot>${PREBOOT_SCRIPT}</script>` +
              `<meta name="awc-reporting-date" content="${REPORTING_DATE}">` +
              `<script type="module" data-awc-runtime>${RUNTIME_IMPORT}</script>`,
          );
          try {
            html = await injectShadowRoots(html);
            res.setHeader('x-awc-ssr', 'declarative-shadow-dom');
          } catch (error) {
            // A failed transform must not cost the reader the page. The
            // untransformed HTML is still a working document — the components
            // build their shadow roots client-side, exactly as they did before
            // this server existed.
            console.error('[awc-ssr] shadow-root injection failed, serving raw HTML:', error);
          }
        }

        res.setHeader('content-type', 'text/html; charset=utf-8');
        // Rendered for this request and for nobody else. A cache in front of
        // this would make the render marker lie.
        res.setHeader('cache-control', 'no-store');
        res.send(stampRenderMarkers(html, renderedAt));
      })
      .catch((error) => next(error));
  });

  /**
   * THE FRONT DOOR. This build is compiled against an absolute base and only
   * answers under it — correct in production, where it is one of several builds
   * behind a shared host, and useless when the server is run on its own: you
   * start it, open the port it printed, and get a 404 from your own app.
   * `scripts/verify-ssr.mjs` hits `/` for exactly that reason, as a readiness
   * check.
   *
   * Only the bare root and the mount without its trailing slash redirect.
   * Anything else outside the mount is a genuine wrong address and gets a 404
   * rather than being quietly rewritten.
   */
  server.get('/', (_req, res) => res.redirect(308, BASE_HREF));
  server.get(BASE_PATH, (_req, res) => res.redirect(308, BASE_HREF));

  server.use((_req, res) => {
    res.status(404).type('text/plain; charset=utf-8').send(`outside ${BASE_HREF}`);
  });

  return server;
}

const server = app();
server.listen(port, () => {
  console.log(`[awc-ssr] http://${host}:${port}${BASE_HREF}`);
});
