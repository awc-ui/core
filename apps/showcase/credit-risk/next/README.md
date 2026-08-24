# Aurelia Bank — Credit Risk Console (Next.js, server-rendered)

The **runtime server-rendered** build of the `credit-risk` showcase vertical.
Every framework build renders the same six screens from the same fixture; this
one renders them per request and is served at
`awc-ui.dev/showcase/credit-risk/next/`.

It used to live at `/react/` and ship `output: 'export'` — a static export
wearing React's name. `/react/` is now a genuine React SPA; this is the entry
that actually demonstrates SSR.

```bash
pnpm --filter @awc-ui/showcase-credit-risk-next build   # -> .next/ (+ public/)
pnpm --filter @awc-ui/showcase-credit-risk-next start   # node server.mjs, default port 4610
node server.mjs 4610                                    # same thing, explicit port
node server.mjs --dev 4610                              # dev
```

`build` runs `sync-runtime` first, which needs `packages/core/dist` to exist
(`pnpm --filter @awc-ui/core build`), and the app imports the kit's compiled
`dist` (`pnpm --filter @awc-ui/showcase-kit build`).

`pnpm verify:ssr next` (from the repo root) builds this app, starts it, and
proves both halves of the claim: declarative shadow DOM in a response fetched
without a browser, and a per-request marker that differs across two requests.

**This build has no output directory to stage.** It is a server, not a folder of
HTML. `.next/` is a build artifact that only `server.mjs` can serve, and `next
start` alone is not enough — see below.

## Screens

| Route | Screen |
|---|---|
| `/` | Portfolio overview — KPI tiles with sparklines, sector bars, rating distribution, exposure trend by rating band, largest exposures |
| `/sectors/[sector]/` | Concentration and utilisation meters, sector EL/RWA trend, the sector's counterparties (7 sectors) |
| `/counterparties/[id]/` | Obligor header, then tabs for facilities, rating history and group structure (24 obligors) |
| `/facilities/[id]/` | Terms, covenant headroom meters, collateral net of haircuts, balance schedule to maturity (61 lines) |
| `/watchlist/` | Early-warning signals, filtered by severity and sector |
| `/stress/` | Baseline / adverse / severe, EL and RWA comparison charts, per-sector impact |

The same 95 addressable screens as before — six route patterns, three of them
parameterised — but nothing is enumerated at build time any more. `next build`
reports all six as `ƒ (Dynamic) server-rendered on demand`.

## The four decisions worth knowing

**Rendering happens per request.** Every `page.tsx` declares
`dynamic = 'force-dynamic'`. Without it Next notices that these pages have no
request-dependent input, prerenders each one during `next build` and marks it
`○ (Static)` — which would be the old static export under a new name. The half
of `dynamicParams = false` that still matters, "an unknown id is a 404", is now
a `notFound()` guard reading the same fixture selector that used to feed
`generateStaticParams`.

**`server.mjs` is what makes the components server-rendered.** Next renders the
React tree, but React can only emit `<md-card class="panel">` — a bare
custom-element tag. A custom element is upgraded by a browser, so `next start`
on its own ships inert tags and the first paint is unstyled until Stencil's
runtime builds every shadow root client-side. `server.mjs` buffers each HTML
response and runs it through `@awc-ui/core/hydrate`, which injects
`<template shadowrootmode="open">` for every `md-*`. Measured on `/`: 174 bare
tags and 0 shadow roots through `next start`, 206 elements and 206 shadow roots
through `server.mjs`.

This is the same framework-agnostic primitive as
`starters/astro/src/middleware.ts`, `starters/nuxt/server/plugins/awc-ssr-dsd.ts`
and `starters/sveltekit/src/hooks.server.ts` — those hang it off their
framework's response hook. Next 14 has no such hook (middleware is Edge-only;
Node middleware landed in 15.2), so the hook is the server. `starters/next` uses
`@awc-ui/react/server` instead, which is cleaner and not available here — see
the header comment in `server.mjs`.

**Compression belongs to `server.mjs`, not to Next.** Next compresses inside the
handler, so the bytes reaching the transform would be gzip and every test of
them — "is this HTML?", "does it contain `<md-`?" — would be run against binary
and quietly answer no. The first version of this server did exactly that and
served shadow-DOM-free pages to anything sending `Accept-Encoding`: curl does
not by default, `fetch` always does, so it looked right by hand and failed
`verify:ssr`. `accept-encoding` is now stripped from the request before Next
sees it and the finished bytes are gzipped here instead (1.12 MB → 77 kB on `/`).

**The components are not bundled.** Stencil's lazy runtime is copied into
`public/awc-runtime/` by `scripts/sync-runtime.mjs` and loaded from a static
absolute URL by a module script in `app/layout.tsx`. Putting it through a
bundler makes it resolve its entry chunks under `/_next/static/`, where nothing
was ever written, and every element renders at zero height. That is a
browser-graph problem, so server rendering does not change it. The full
post-mortem is in that script, and originally in
`apps/docs/src/components/Head.astro`. `@awc-ui/react` is not used for the same
reason — the wrappers import `@awc-ui/core` and put the loader straight back
into the graph. Object-valued props are assigned through refs instead; see
`components/elements.tsx`.

**Every screen is still a client component.** The dock changes the locale at
runtime and the whole page has to re-render in the new language, which a server
component cannot do. Each `page.tsx` is a thin server wrapper holding the route
config; the screen underneath owns the render. `'use client'` under a running
server means "SSR to HTML, then hydrate", which is exactly what is wanted: the
fixture selectors are pure and synchronous, so the HTML that leaves the server
carries real rows and real numbers, and the browser takes over from there.
Locale is still client-side state in a query param — no `/ro/` path segment,
which is why `<title>` and `<html lang>` stay English.

**Nothing is invented.** The fixture is frozen at 2026-03-31 with no clock and
no randomness anywhere, which is what lets a static build and a live render
produce identical screens. The one exception is deliberate: `app/layout.tsx`
stamps `<meta name="awc-rendered-at">` at render time, so two requests to the
same URL disagree on exactly one value. It is the evidence that the page was
built for the request rather than read off a disk, and it is a `<meta>` so that
nothing inside `.shell` — text, `md-*` fingerprint, row counts, measured gaps —
is affected by it.
