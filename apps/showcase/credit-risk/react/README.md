# Aurelia Bank — Credit Risk Console (React, single-page application)

The **client-routed SPA** build of the `credit-risk` showcase vertical. Every
framework build renders the same six screens from the same fixture; this one
ships one HTML document and one JavaScript entry, resolves its routes in the
browser, and is served at `awc-ui.dev/showcase/credit-risk/react/`.

Vite, React 18, and a router written in this repo. No meta-framework, no server
rendering, no build-time page generation. Until now `/react/` was a Next.js
static export wearing React's name; that build moved to
[`../next/`](../next/README.md), where it renders per request and is the entry
that demonstrates SSR.

```bash
pnpm --filter @awc-ui/showcase-credit-risk-react build    # -> dist/
pnpm --filter @awc-ui/showcase-credit-risk-react dev      # vite, http://localhost:4327/showcase/credit-risk/react/
pnpm --filter @awc-ui/showcase-credit-risk-react serve    # serve dist/ at the real mount path
pnpm --filter @awc-ui/showcase-credit-risk-react verify   # build it, then drive it in a browser
pnpm --filter @awc-ui/showcase-credit-risk-react lint     # tsc --noEmit
```

`build` runs `sync-runtime` first, which needs `packages/core/dist` to exist
(`pnpm --filter @awc-ui/core build`), and the app imports the kit's compiled
`dist` (`pnpm --filter @awc-ui/showcase-kit build`).

## Screens

| Route | Screen | Pages |
|---|---|---|
| `/` | Portfolio overview — KPI tiles with sparklines, sector bars, rating distribution, exposure trend by rating band, largest exposures | 1 |
| `/watchlist/` | Early-warning signals, filtered by severity and sector | 1 |
| `/stress/` | Baseline / adverse / severe, EL and RWA comparison charts, per-sector impact | 1 |
| `/sectors/[sector]/` | Concentration and utilisation meters, sector EL/RWA trend, the sector's counterparties | 7 |
| `/counterparties/[id]/` | Obligor header, then tabs for facilities, rating history and group structure | 24 |
| `/facilities/[id]/` | Terms, covenant headroom meters, collateral net of haircuts, balance schedule to maturity | 61 |

95 addressable screens, six route patterns, three of them parameterised — the
same set as every sibling build. The route shapes come from
`@awc-ui/showcase-kit/credit-risk`, so a link written once cannot drift between
ports.

The locale is **not** in the URL. `?lang=ro` and the dock's language menu
re-render the React tree through the translator and leave the path alone, which
is the same arrangement as the `next`, `vue`, `angular` and `svelte` builds. Only
`html` and `astro` route the locale (`/astro/ro/`).

## The five decisions worth knowing

**The build still emits 95 HTML files, and that is not a contradiction.**
"Single-page application" here means one document, one JS entry and routing in
the browser — not one file on disk. A cold request for
`/showcase/credit-risk/react/facilities/fac-001/` reaches the host before any of
this app is running, and a static host answers it with a 404. So
`scripts/fan-out-routes.mjs` copies `dist/index.html` into every route
directory; all 95 are byte-identical, because the router reads
`location.pathname`. The list is enumerated from the same fixture selectors
(`getSectors`, `getCounterparties`, `getFacilities`) that fed
`generateStaticParams()` in the build this replaced, so adding a fixture row
still adds a page with no second edit.

A host rewrite is the other half of the answer and is worth having as well:

```
/showcase/credit-risk/react/*  /showcase/credit-risk/react/index.html  200
```

It costs nothing where a real file exists (a `200` rewrite is shadowed by
matching files) and it makes a typo'd or newly-added route land in this app's
own not-found screen rather than the host's. It cannot replace the fan-out: the
repo's own verifiers — `scripts/verify-showcase-parity.mjs` and
`scripts/verify-showcase-a11y.mjs` — serve the staged tree with a dumb file
server that has no rewrite hook, and this build is the reference the other five
are measured against.

**The router is sixty lines, on purpose.** `src/lib/router.tsx` is
`history.pushState` plus a `popstate` listener plus a path match. It exposes
`usePathname()`, `useRouter().push()` and `<Link href>` — Next's names, because
every screen was ported verbatim from the Next build and the parity check
compares the two trees element by element; keeping the three call sites in
`Shell.tsx` and `OverviewScreen.tsx` unchanged means a divergence can only come
from the router. Paths crossing the router's surface are unprefixed
(`/sectors/energy/`); the mount is added on the way to the DOM and stripped on
the way back from `location`, which is what `basePath` used to do.

Two things a router library would not have supplied anyway: the section nav and
the breadcrumb trail are `md-button[href]` and `md-breadcrumb-item[href]` —
custom elements containing real anchors — so they are routed by vetoing their
`mdClick` / `mdSelect` events, not by a `<Link>` component.

**It renders no wrapper element.** `RouterProvider` is a context provider,
`App` returns the matched screen directly, and `#root` in `index.html` carries
`style="display: contents"`. `verify-showcase-parity.mjs` measures the vertical
gaps between `.shell`'s children; a real `<div>` around the route output becomes
one of those children and shifts every gap. That is the bug its header records
against the `html` and `astro` builds, and it is why the mount point has no box.

**The components are not bundled.** `@awc-ui/react` and `@awc-ui/core/loader`
are deliberately never imported: Stencil's lazy runtime resolves its chunks
relative to its own location, so bundling it makes it hunt for entry files under
`/showcase/credit-risk/react/assets/`, where Vite never wrote them, and every
element renders at zero height. `scripts/sync-runtime.mjs` copies the minified
lazy build into `public/awc-runtime/` and `index.html` loads it from an absolute
URL — through a **classic** inline script that appends a module `<script>`,
because Vite follows the imports inside an inline `type="module"` block and
would either fail the build or fold the runtime into the app's entry chunk,
delaying it behind 367 kB of application JavaScript.

Only `@awc-ui/core/css/tokens.css` is imported from the library, plus the shared
`@awc-ui/showcase-kit/credit-risk/app.css`. Those two are the one thing that
should go through the bundler.

**The state query survives an in-app navigation**, which the Next build did not
do. The dock keeps theme, locale, direction, density and accent in the URL so
state can travel — including across the framework switcher, which lands on
another origin in dev where `localStorage` does not follow. `router.push()` there
dropped the query on every click; a link copied after two navigations reverted
to defaults on someone else's machine. Here the params ride along.

## Verification

`pnpm verify` starts `scripts/serve-dist.mjs` — deliberately without a history
fallback, so "the deep link works" means the files are really on disk — and
drives 31 assertions in a real browser: every route resolves on a cold load, the
`md-*` elements have shadow roots (so the runtime loaded from the right URL),
the section nav and the drill anchors and the back button all route without
tearing down the document, the dock switches locale in place without touching
the path, the state query survives a hop, and the dock renders exactly once with
all seven framework ids.

At the repo root, `pnpm verify:showcase-parity` compares the other five builds
against this one on visible text, an ordered `md-*` fingerprint, the element
census, live table rows, document height and block gaps. **A change to this
build's DOM is not one failure, it is five.**

## Layout

```
index.html                     the one document; head order is documented in it
vite.config.ts                 base path, the @/* alias, and the head template plugin
src/main.tsx                   CSS imports, providers, createRoot
src/App.tsx                    the route table — six patterns to six screens
src/lib/router.tsx             pushState, popstate, Link, usePathname, useRouter
src/lib/routes.ts              this build's binding of the kit's shared route table
src/lib/showcase.tsx           the dock's state as a React context + translator
src/components/                Shell, Dock, tables, chart wrappers, KPI bits
src/components/screens/        the six screens, plus the not-found screen
scripts/sync-runtime.mjs       copy Stencil's lazy build into public/awc-runtime/
scripts/fan-out-routes.mjs     one index.html per route, after vite build
scripts/serve-dist.mjs         serve dist/ at the real mount path
scripts/verify-browser.mjs     the browser assertions above
```
