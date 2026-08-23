# Credit Risk Console — Astro build

The same six screens as every other framework build, served from
`/showcase/credit-risk/astro/`. What makes this one worth having as a separate
entry in the framework switcher is that it renders on the server: the shadow
roots are in the HTML, put there at build time.

```bash
pnpm --filter @awc-ui/core build          # the runtime this copies from
pnpm --filter @awc-ui/showcase-credit-risk-astro build
```

285 pages — 95 routes across three locales.

## What is different from the React build, and why

Everything here follows from one fact: this build renders once, on a server,
and has no client-side rendering to re-run. Each difference below is a
consequence of that, not a shortcut.

**The language is in the URL.** `/astro/` is English, `/astro/ro/` and
`/astro/ar/` are the others. React re-renders every string when the dock's
language changes; there is nothing to re-render here, because the strings are
already in the HTML. So the locale becomes part of the route and switching it
is a navigation. Each page is served with `lang` and `dir` already correct,
which makes it indexable and readable with JavaScript off — and it means
`<html data-locale-route>` has to tell the preboot script and the dock to leave
those attributes alone, or a stale locale in localStorage stamps `lang="ro"`
over English text.

**The rendered document is identical to the React build's, and `<template>` is
how.** Same page of ten counterparties, same pagination control, same single
stress scenario, same filtered rows. Six builds that render different documents
are not one application, and that is the only thing this showcase is for.

What is off screen ships in `<template>` elements, whose contents the parser
keeps out of the document tree — not rendered, not matched by
`querySelectorAll`, not in the accessibility tree. So the live page has exactly
React's elements while the file still holds the whole book, and the client
script pages, sorts and swaps scenarios by cloning from it rather than
refetching. With JavaScript off you get page one and the adverse scenario,
which is precisely what React's static export gives you with it off.

Sorting compares the `data-sort-*` values rather than the localised cell text:
"€1.2 md" and "٤٫٩٪" sort into an order that is wrong in a different way in each
of the three languages.

**Filters detach rows; they do not hide them.** A hidden row is still a row —
still in `querySelectorAll`, still in the accessibility tree, still counted. The
React build re-renders a shorter array, so this one removes the elements and
puts them back, in their original order, when the filter widens.
`pnpm verify:showcase-parity` at the repo root is what keeps all of this
honest: it diffs every screen's text and `md-*` census against React.

**Charts get their axes from a script.** Two reasons, in `src/lib/charts.ts`.
`valueFormatter` is a closure and could never travel in an attribute; and
`xAxis`/`yAxis` do not deserialise from their attributes the way `series` does
(reported upstream). This is free here specifically because a chart draws into
a `<canvas>`, which cannot be server-painted in *any* framework — so the plot
was already conditional on JavaScript. `series` deliberately stays on the
attribute, because that is what makes the component's accessible data table
render on the server.

## The honest limit

With JavaScript disabled this is a complete, readable credit report — every
figure, every table, every covenant meter — **with blank chart panels**. A
canvas cannot be painted without a canvas context. The charts' headings,
legends and screen-reader data tables are all there; only the plots wait for
the runtime.

## Size

Declarative shadow DOM inlines each component's styles into each shadow root,
so the overview page is 1.8 MB raw, of which 86% is `<style>` and 82% is
duplicate — fifteen distinct stylesheets repeated 384 times. Compression is
extremely good at exactly that shape: the same page is 124 KB gzipped and
**25 KB brotli**, which is what a host actually serves. The uncompressed build
artifact is large (158 MB across 285 pages); nothing that ships is.

## Verifying

```bash
pnpm --filter @awc-ui/docs exec astro preview --port 4350
pnpm --filter @awc-ui/showcase-credit-risk-astro verify
```

26 browser checks. One is expected to fail: hydrating over declarative shadow
DOM leaves a stale server-rendered `<canvas>` in every chart, a core bug
reported upstream. It is reported rather than asserted away so it stays visible
— currently harmless only because the stale node happens to sit first in tree
order.
