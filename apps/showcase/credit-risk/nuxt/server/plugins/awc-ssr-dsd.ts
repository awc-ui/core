/**
 * SERVER-RENDER THE COMPONENTS, PER REQUEST — and say so, checkably.
 *
 * Two jobs, deliberately in one file, because the second is only meaningful
 * next to the first.
 *
 * 1. DECLARATIVE SHADOW DOM. Nuxt renders the Vue tree to a string of `md-*`
 *    tags. A custom element is only ever upgraded by a BROWSER, so what leaves
 *    a stock Nuxt server is `<md-card class="panel">…</md-card>` — an inert tag
 *    with no shadow root, and a first paint of unstyled text until Stencil's
 *    runtime arrives and builds every shadow root client-side.
 *    `@awc-ui/core/hydrate` takes that HTML string and gives it back with a
 *    `<template shadowrootmode="open">` — markup, styles and all — inside every
 *    component. The browser's parser turns those into real shadow roots before
 *    a single byte of JavaScript runs.
 *
 *    WITH ONE EXCEPTION, WHICH IS WORTH BEING PRECISE ABOUT. Tables, chips,
 *    meters, cards, breadcrumbs and buttons server-render complete, content and
 *    all — every figure on every screen is in the HTML. The CHARTS do not: they
 *    draw into a `<canvas>`, and a canvas cannot be painted without a canvas
 *    context, which does not exist here. What server-renders for a chart is its
 *    frame — heading, subtitle, legend, and the accessible name and data-table
 *    description a screen reader reads — with the plot itself appearing when the
 *    runtime draws it. With JavaScript off this page is a complete, readable
 *    credit report with blank chart panels, not a finished dashboard.
 *
 * 2. THE RENDER STAMP. The fixture is frozen at `REPORTING_DATE` with no clock
 *    and no randomness anywhere, which is exactly what let this build be
 *    prerendered and still look identical to a live one. That is good for
 *    parity and useless as proof: you cannot tell which one served you. So one
 *    value is read at render time, and two requests to the same URL disagree —
 *    which they can only do if the HTML was built for each of them.
 *    `scripts/verify-ssr.mjs` at the repo root fetches a page twice and fails
 *    the build if the markers match, and fails it just as hard if there is no
 *    marker at all, on the grounds that silence is not evidence. The names are
 *    the harness's, not ours.
 *
 * WHY `render:html` AND NOT `render:response`. Both hooks can see a finished
 * document; `render:html` sees it in pieces, before Nuxt concatenates them, and
 * the pieces are what we want. The transform runs over `html.body` alone, so
 * the `<head>` Nuxt and `preboot.ts` assembled is never re-parsed and never
 * re-ordered — the preboot IIFE stays first, and the meta tags below stay
 * exactly as written. It is also the seam `starters/nuxt` and
 * `apps/example-nuxt` already use, so there is one Nuxt answer in this repo
 * rather than two.
 *
 * THE OPTIONS ARE NOT DEFAULTS, and each one has cost a debugging session
 * somewhere in this repo:
 *
 * - `removeScripts: false` — stripping scripts takes out the preboot IIFE and
 *   the runtime import, leaving a page that renders once beautifully and then
 *   never themes, never switches language and never gains a dock.
 * - `removeHtmlComments: false` — Vue's SSR fragment markers (`<!--[-->`,
 *   `<!--]-->`) and its `v-if` placeholders (`<!---->`) ARE comments. Remove
 *   them and client hydration walks a tree it does not recognise.
 * - `maxHydrateCount: 10_000` — the default is 300 and these screens go well
 *   past it (the counterparty and facility tables alone are hundreds of
 *   `md-table-cell`s). The limit is silent: components past it are left as
 *   inert tags, so the page looks half server-rendered and nothing says why.
 * - `clientHydrateAnnotations: true` — Stencil writes `s-id`/`c-id` attributes
 *   and `<!--r.N-->` marker comments so its own runtime can ADOPT the shadow
 *   root the parser built from the server's `<template shadowrootmode>` instead
 *   of rendering a second copy into it. This was `false` for a while, to keep
 *   the markers out of Vue's light DOM, and the cost was not what the comment
 *   here claimed: without `s-id` the runtime does not rebuild the shadow root,
 *   it APPENDS to it, so every component on every screen rendered its content
 *   twice. See `stripLightDomAnnotations` below, which is how both ends are had
 *   at once.
 * - `fullDocument: false` — the input is a body fragment, not a document.
 *
 * A failed transform must not cost the reader the page: the untransformed HTML
 * is still a working document, with the components building their shadow roots
 * client-side exactly as they did before this file existed. So the error is
 * logged, the body is left alone, and the `x-awc-ssr` header is simply absent.
 */
import { renderToString } from '@awc-ui/core/hydrate';

const HYDRATE_OPTIONS = {
  serializeShadowRoot: 'declarative-shadow-dom',
  removeScripts: false,
  removeHtmlComments: false,
  removeUnusedStyles: false,
  clientHydrateAnnotations: true,
  maxHydrateCount: 10_000,
  fullDocument: false,
} as const;

const TEMPLATE_OPEN = '<template';
const TEMPLATE_CLOSE = '</template>';

/**
 * Stencil's hydrate marker comments: `<!--r.1572-->` for a host's content
 * reference, `<!--t.1572.0.1-->` before a slotted text node. Both are pure
 * bookkeeping and both are matched by their prefix-plus-digits shape, which
 * nothing else in this document has. Vue's own comments — `<!--[-->`,
 * `<!--]-->` for a fragment and a bare `<!---->` for a false `v-if` — do not
 * match, and MUST NOT: they are the markers Vue itself hydrates against.
 */
const STENCIL_MARKER = /<!--[rt]\.[\d.]+-->/g;

/**
 * The shadow DOM is Stencil's. The light DOM is Vue's. Keep each one's
 * bookkeeping out of the other's tree.
 *
 * THE TWO BUGS THIS SITS BETWEEN, because fixing either one naively causes the
 * other and this build has now shipped both.
 *
 * 1. DUPLICATED CONTENT. Stencil's client runtime only ADOPTS a server-rendered
 *    shadow root when the host carries the `s-id` attribute it wrote there —
 *    that is what `clientHydrateAnnotations` emits. Turn annotations off and the
 *    runtime does not recognise the declarative shadow root the parser already
 *    built, takes its cold path, and renders a SECOND copy of the component into
 *    the same shadow root. It does not replace the first. Measured on the
 *    overview screen: every `md-button` ended up with two `<a>` anchors and
 *    every `md-chip` with two labels, so the nav read "Overview" twice, 154px
 *    wide where every other build in the vertical draws 118px, with two
 *    focusable anchors per button for a keyboard and two announcements for a
 *    screen reader. Nothing in this app's own harness looked, because none of
 *    its assertions counts what is inside a shadow root.
 *
 * 2. HYDRATION MISMATCH. With annotations on, Stencil also writes marker
 *    COMMENTS — a content reference as the host's first child, and one before
 *    each slotted text node. Those land in the LIGHT DOM, and the light DOM is
 *    what Vue hydrates. Vue's walker, unlike React's, does not skip comment
 *    nodes: it finds a comment where its render function said text, calls a
 *    mismatch on essentially every component, tears each one's children down and
 *    re-creates them, and logs `Hydration completed but contains mismatches.` —
 *    in production, not only in dev.
 *
 * So the annotations stay ON, which is what buys the adoption and what
 * `apps/showcase/credit-risk/astro/src/middleware.ts` has always done, and the
 * markers are removed FROM THE LIGHT DOM ONLY. Inside a shadow root every
 * annotation is left exactly as written: Vue never walks in there, and the
 * runtime needs `s-id`, `c-id` and the marker comments intact to take the
 * server's vdom rather than rebuild it. The `s-id`/`c-id` ATTRIBUTES on
 * light-DOM elements are left alone too — an unexpected attribute is not a
 * structural mismatch, and Vue in production ignores it.
 *
 * WHY A NESTING WALK AND NOT A REGEX OVER THE WHOLE STRING: the same marker
 * text appears in both trees, so the only thing that distinguishes them is
 * position. This tracks `<template>` depth and rewrites a run of HTML only when
 * it is at depth zero — Vue's side of the boundary.
 */
function stripLightDomAnnotations(html: string): string {
  /*
   * Depth of `<template>` nesting. Depth 0 is the light DOM — the only place
   * anything is rewritten. Every `<template>` counts, not only the shadow roots:
   * a plain one is inert content Vue does not hydrate either, so the markers
   * inside it are equally none of our business.
   */
  let depth = 0;
  let out = '';
  let i = 0;

  /** Append `chunk`, dropping Stencil's markers only when this is Vue's tree. */
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

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:html', async (html, { event }) => {
    /*
     * Stamped here rather than at module scope, which is the whole point: a
     * module-scope constant would be the time the SERVER booted and would be
     * identical on every request, which is indistinguishable from a
     * prerender — the exact failure this is meant to rule out.
     */
    html.head.push(
      '<meta name="awc-render-mode" content="ssr">',
      `<meta name="awc-rendered-at" content="${new Date().toISOString()}">`,
    );

    const body = html.body.join('');
    // Nothing to hydrate — a 404 page. Skip the parse rather than pay for it.
    if (!body.includes('<md-')) return;

    try {
      const { html: hydrated, diagnostics } = await renderToString(body, HYDRATE_OPTIONS);
      const errors = (diagnostics ?? []).filter((d) => d.level === 'error');
      if (errors.length) throw new Error(errors.map((d) => d.messageText).join(' | '));

      html.body = [stripLightDomAnnotations(hydrated)];
      event.context.awcSsr = true;
    } catch (error) {
      console.error('[awc-ssr] shadow-root injection failed, serving raw HTML:', error);
    }
  });

  /**
   * Say it in the headers too.
   *
   * `x-awc-ssr` makes "did the transform actually run?" a question `curl -I`
   * can answer without reading the body. `no-store` is the other half of "no
   * full-page caching": nothing about these documents may be kept and replayed,
   * or the second request stops being a second render. It is set here, on the
   * rendered response only, rather than as a `/**` route rule — a route rule
   * would also land on `_nuxt/` and `awc-runtime/`, which are content-hashed
   * and want the opposite.
   */
  nitro.hooks.hook('render:response', (response, { event }) => {
    response.headers = {
      ...response.headers,
      'cache-control': 'no-store',
      ...(event.context.awcSsr ? { 'x-awc-ssr': 'declarative-shadow-dom' } : {}),
    };
  });
});
