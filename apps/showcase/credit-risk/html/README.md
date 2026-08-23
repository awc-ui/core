# Aurelia Bank — Credit Risk Console (plain HTML)

The no-framework build of the `credit-risk` showcase vertical. Six framework
builds render the same six screens from the same fixture; this one is written
out as static HTML files at build time and served at
`awc-ui.dev/showcase/credit-risk/html/`.

```bash
pnpm --filter @awc-ui/showcase-credit-risk-html build    # -> dist/
pnpm --filter @awc-ui/showcase-credit-risk-html serve    # dist/ at the real mount path
pnpm --filter @awc-ui/showcase-credit-risk-html verify   # 21 checks in a real browser
```

`build` runs `sync-runtime` first, which needs `packages/core/dist` to exist
(`pnpm --filter @awc-ui/core build`).

## Screens

| Route | Screen |
|---|---|
| `/` | Portfolio overview — KPI tiles with sparklines, sector bars, rating distribution, exposure trend by rating band, the counterparty book |
| `/sectors/[sector]/` | Concentration and utilisation meters, sector EL/RWA trend, the sector's counterparties (7 pages) |
| `/counterparties/[id]/` | Obligor header, then tabs for facilities, rating history and group structure (24 pages) |
| `/facilities/[id]/` | Terms, covenant headroom meters, collateral net of haircuts, balance schedule to maturity (61 pages) |
| `/watchlist/` | Early-warning signals, filtered by severity and sector |
| `/stress/` | Baseline / adverse / severe, EL and RWA comparison charts, per-sector impact |

95 screens × 3 locales = **285 static files**, plus one 77 kB client bundle and
two stylesheets.

## The four decisions worth knowing

**There is no framework, and the templating is nine lines.** `src/lib/html.mjs`
is a tagged template that escapes every interpolation unless it is itself the
result of `html` — the same rule JSX follows, written down once because nothing
else here enforces it. Legal names, relationship managers and signal owners come
out of the fixture and go straight into markup, so it genuinely earns its keep.

**The language is in the URL, not in client state.** There is no client-side
rendering to re-run, so the strings inside a file are already in a language:
`/html/` is English, `/html/ro/` Romanian, `/html/ar/` Arabic and right-to-left.
The default locale stays unprefixed so the entry URL matches the other five
builds. `<awc-showcase-dock locale-route="en">` makes the dock's language picker
navigate rather than fire a state change nothing would re-render for, and
`data-locale-route` on `<html>` stops a stale locale in localStorage from
stamping the wrong `lang` over a page written in another language. Theme,
density and accent are pure CSS and still come from storage.

**The rendered document is identical to the React build's, and `<template>` is
how.** This build renders the same page of ten counterparties, the same
pagination control and the same single stress scenario React does — because six
builds that render different documents are not one application, which is the
only thing this showcase is for. The rows and panels that are not on screen ship
in `<template>` elements, whose contents the parser keeps out of the document
tree: not rendered, not matched by `querySelectorAll`, not in the accessibility
tree. So the live page has exactly React's elements, while the file still holds
the whole book for the client script to page and sort through without
refetching anything or bundling the fixture.

`pnpm verify:showcase-parity` at the repo root is what keeps that true — it
diffs every screen's text and `md-*` census against React.

**JavaScript only adds behaviour.** The client bundle carries the dock and four
progressive enhancements — sorting and paging, the watchlist filters, the
scenario switch and the sector-bar drill. With it off you get page one and the
adverse scenario, which is precisely what React's static export gives you with
it off. The one honest limit is the charts: they draw into a `<canvas>`, which
cannot be pre-painted, so their panels are frames until the runtime lands. Their
`series` still ships in the markup, which is what makes the components'
accessible data tables readable with JavaScript off.

**The components are not bundled.** Stencil's lazy runtime is copied into
`public/awc-runtime/` by `scripts/sync-runtime.mjs` and loaded from a static
absolute URL. Putting it through a bundler makes it resolve its entry chunks
under the bundler's own paths, where the build never wrote them, and every
element renders at zero height. `esbuild` builds the client bundle only, and
declares `@awc-ui/core` external so nothing can quietly put the loader back into
the graph.

## Checking it

`pnpm lint` is the stand-in for the type-check the other five builds get: it
imports every module (a stray backtick inside an `html` template silently ends
it) and renders all 95 screens in all three locales, failing on `undefined`,
`[object Object]` or an unresolved dictionary key in the output.

`pnpm verify` starts a server and drives a real browser: content readable with
JavaScript disabled, every component upgraded, every chart painted, all four
enhancements firing, only ever one stress scenario live, filtered rows actually
leaving the DOM rather than being hidden, the Arabic tree translated and
right-to-left, and a stale locale in storage losing to the language the page is
written in.
