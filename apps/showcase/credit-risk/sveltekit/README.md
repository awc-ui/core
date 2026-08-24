# Aurelia Bank — Credit Risk Console (SvelteKit)

The SvelteKit build of the `credit-risk` showcase vertical. Every framework
build renders the same six screens from the same fixture; this one renders them
**on the server, per request**, with the components' shadow DOM already in the
response, and is served at `awc-ui.dev/showcase/credit-risk/sveltekit/`.

It used to be `@sveltejs/adapter-static` with `prerender = true`: 95 HTML files
written once and served by anything that can read a directory. It is now
`@sveltejs/adapter-node` with prerendering off everywhere, and the entry in the
framework switcher moved from `svelte` to `sveltekit` with it.

```bash
pnpm --filter @awc-ui/showcase-credit-risk-sveltekit build   # -> build/
pnpm --filter @awc-ui/showcase-credit-risk-sveltekit start   # the real server, :4612
pnpm --filter @awc-ui/showcase-credit-risk-sveltekit verify  # 19 checks in a real browser
node scripts/verify-ssr.mjs sveltekit                        # from the repo root
```

`build` runs `sync-runtime` first, which needs `packages/core/dist` to exist
(`pnpm --filter @awc-ui/core build`). `start` honours `$PORT` and defaults to
4612, which is the port the SSR harness expects.

## Screens

| Route | Screen |
|---|---|
| `/` | Portfolio overview — KPI tiles with sparklines, sector bars, rating distribution, exposure trend by rating band, the counterparty book |
| `/sectors/[sector]/` | Concentration and utilisation meters, sector EL/RWA trend, the sector's counterparties (7 sectors) |
| `/counterparties/[id]/` | Obligor header, then tabs for facilities, rating history and group structure (24 obligors) |
| `/facilities/[id]/` | Terms, covenant headroom meters, collateral net of haircuts, balance schedule to maturity (61 lines) |
| `/watchlist/` | Early-warning signals, filtered by severity and sector |
| `/stress/` | Baseline / adverse / severe, EL and RWA comparison charts, per-sector impact |

95 routes, none of them written ahead of time. An id that is not in the fixture
is a real 404, raised in the route's `load` — the answer the static host used to
give by having no file there.

## What makes it a real SSR build

Two independent claims, and `scripts/verify-ssr.mjs` at the repo root checks
both, because the obvious test proves the wrong thing: fetch a page, find the
markup, and a prerendered file passes just as happily as a live server.

**The markup arrives without a browser.** `src/hooks.server.ts` runs the
finished document through `renderToString` from `@awc-ui/core/hydrate` — the
same framework-agnostic primitive Astro's middleware and Nuxt's Nitro hook use —
so the response already contains `<template shadowrootmode="open">` for every
`md-*` element. Fetched with `fetch`, which runs no JavaScript, the page is
styled and readable.

**It was rendered for that request.** The same hook stamps
`<meta name="awc-render-mode" content="ssr">` and
`<meta name="awc-rendered-at" content="…">` into `<head>`, the timestamp read as
the response is assembled. Two requests a second apart therefore return
different documents. Without a marker there would be nothing to compare, and the
harness fails a silent app rather than giving it the benefit of the doubt.

**The charts are the honest exception.** They draw into a `<canvas>`, and a
canvas cannot be painted without a canvas context. What server-renders for a
chart is its frame — heading, subtitle, legend, accessible name, data-table
description — with the plot appearing when the runtime draws it. With JavaScript
off this is a complete, readable credit report with blank chart panels, not a
finished dashboard.

## The decisions worth knowing

**`transformPageChunk` is per chunk, not per page.** It is the right seam for
this, and the trap is in the name: hand `renderToString` a fragment and it will
parse it as a document and quietly return something reshaped. The hook buffers
and transforms once, on `done`. Today SvelteKit passes the whole document in a
single call — this app returns no promises from `load`, so nothing streams — but
that is a fact about the version we build against, not a guarantee.

**The language still changes in place.** The dock's locale is client state:
`$lib/showcase.ts` turns `subscribeShowcaseState` into a Svelte store and every
visible string is `$t('…')`, so switching to Romanian re-renders the whole app
without a navigation. The server renders in the default locale (en / ltr) on
both sides of hydration so the first client render matches the HTML exactly —
the locale lives in a query param and in localStorage, neither of which the
server can see. The preboot script corrects `lang`/`dir` before the first paint.

**Object props go through an action, custom events do not.** `series`, `nodes`,
`data` and `valueFormatter` have no attribute form, so `use:objectProps` assigns
them to the element instance — and re-assigns on every change, which is what
keeps a chart's axis labels in the page's current language rather than the one
it first drew in. Events need nothing: Svelte's `on:mdSortChange` is a real
`addEventListener`, not a mapped React-style prop, so the library's `md*` events
just work. Their TYPES need declaring, which is what `src/app.d.ts` is for.

**The components are not bundled, and the hydrate app is not either.** Stencil's
lazy runtime is copied into `static/awc-runtime/` by `scripts/sync-runtime.mjs`
and loaded from a static absolute URL by a module script that `hooks.server.ts`
transforms into `<head>`; putting it through Vite makes it resolve its entry
chunks under `_app/`, where the build never wrote them, and every element renders
at zero height. On the server side, `vite.config.js` externalises
`@awc-ui/core/hydrate` — 3.8 MB of prebuilt Node code that has no business being
inlined into the server bundle and then re-bundled by adapter-node.

**Three a11y warnings are silenced, and only on the library's elements.**
Svelte's linter reasons about the tag it can see and cannot see into a shadow
root, so it is wrong about `scope` on `<md-table-cell head>` (which forwards it
onto a real `<th>`) and about a click handler on `<md-button>` (which renders a
real `<button>`). `svelte.config.js` suppresses those codes only when the frame
shows an `md-*` or `awc-*` tag, so the same warning on a real `<td>` or a real
`<div on:click>` still fails the build.

**`server.mjs` exists for the front door.** `paths.base` means SvelteKit answers
404 at `/`, which is correct behind a shared host and useless when you open the
port the server just printed — and `scripts/verify-ssr.mjs` probes `/` as its
readiness check. So the bare root, and only the bare root, is redirected onto the
mount; everything else keeps SvelteKit's own 404. The rest of the request goes
straight to `build/handler.js`, which is `adapter-node`'s own server as a
middleware.

## Checking it

`pnpm verify` starts the real server and drives a real browser: the response
carries shadow roots and real numbers with JavaScript disabled, two requests
come back as two renders, every component upgrades and every chart paints, the
dock's language picker re-renders every string without reloading the document,
and sorting, paging and drill links all work.

One thing that verification taught: row identity has to be read as a
**property**, not an attribute. Svelte sets data on an upgraded custom element
through its property when one exists, so a row that arrived from the server
carries `value="cp-01"` in the markup while a row created after a sort carries
only the property. Both reach the component identically — but an attribute-only
assertion reports a working table as `cp-21 → null` and looks like a pass.
