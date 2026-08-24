# Aurelia Bank — Credit Risk Console (Svelte, single-page application)

The **client-routed SPA** build of the `credit-risk` showcase vertical. Every
framework build renders the same six screens from the same fixture; this one
ships one HTML document and one JavaScript entry, resolves its routes in the
browser, and is served at `awc-ui.dev/showcase/credit-risk/svelte/`.

Vite, Svelte 4, and a router written in this repo. No SvelteKit, no server
rendering, no build-time page generation. Until now `/svelte/` was a SvelteKit
static export wearing Svelte's name; that build moved to
[`../sveltekit/`](../sveltekit/README.md), where it renders per request and is
the entry that demonstrates SSR. **The two differ in exactly one thing: where
the first render happens.** Same screens, same components, same kit, same DOM.

```bash
pnpm --filter @awc-ui/showcase-credit-risk-svelte build    # -> dist/
pnpm --filter @awc-ui/showcase-credit-risk-svelte dev      # vite, http://localhost:4330/showcase/credit-risk/svelte/
pnpm --filter @awc-ui/showcase-credit-risk-svelte serve    # serve dist/ at the real mount path
pnpm --filter @awc-ui/showcase-credit-risk-svelte verify   # build it, then drive it in a browser
pnpm --filter @awc-ui/showcase-credit-risk-svelte lint     # svelte-check
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
re-render the Svelte tree through the translator and leave the path alone, the
same arrangement as every client-rendered build here. Only `html` and `astro`
route the locale (`/astro/ro/`).

## What makes this build an SPA rather than a prerender

With JavaScript disabled the page is blank. That is the claim, and
`scripts/verify-browser.mjs` asserts it first, before anything else: the raw
response contains no `.shell`, no `md-*` element, no `shadowrootmode`, an empty
`<div id="root">`, and `<meta name="awc-render-mode" content="spa">` with **no**
`awc-rendered-at` — because there is no moment of rendering to record. The same
bytes come back for `/` and for `/facilities/fac-001/`, and the same bytes come
back a second later.

The SvelteKit twin asserts the exact opposite: ~200 declarative shadow roots in
the response and two different timestamps 1.1 s apart. Neither build can pass
the other's check, which is the point of shipping both.

## The five decisions worth knowing

**The build still emits 95 HTML files, and that is not a contradiction.**
"Single-page application" here means one document, one JS entry and routing in
the browser — not one file on disk. A cold request for
`/showcase/credit-risk/svelte/facilities/fac-001/` reaches the host before any
of this app is running, and a static host answers it with a 404. So
`scripts/fan-out-routes.mjs` copies `dist/index.html` into every route
directory; all 95 are **byte-identical**, because the router reads
`location.pathname`. Nothing per-route is computed into any of them — what the
fan-out replaces is the host's rewrite rule, not a render. The list is
enumerated from the same fixture selectors (`getSectors`, `getCounterparties`,
`getFacilities`) that fed the `entries()` exports the SvelteKit build used while
it prerendered, so adding a fixture row still adds a page with no second edit.

A host rewrite is the other half of the answer and is worth having as well:

```
/showcase/credit-risk/svelte/*  /showcase/credit-risk/svelte/index.html  200
```

It costs nothing where a real file exists (a `200` rewrite is shadowed by
matching files) and it makes a typo'd or newly-added route land in this app's
own not-found screen rather than the host's. It cannot replace the fan-out: the
repo's own verifiers — `scripts/verify-showcase-parity.mjs` and
`scripts/verify-showcase-a11y.mjs` — serve the staged tree with a dumb file
server that has no rewrite hook.

**The router is a store and `pushState`.** `src/lib/router.ts` is a writable
store, a `popstate` listener and a path match. It exposes `$pathname` and
`navigate()` — standing in for `$page.url.pathname` and `goto()`, because every
screen was copied verbatim out of the SvelteKit build and the parity check
compares the two trees element by element. Keeping the call sites in
`Shell.svelte`, `Drill.svelte` and `OverviewScreen.svelte` to a one-line swap
means a divergence in the DOM can only come from the router.

Paths crossing the router's surface are unprefixed (`/sectors/energy/`); the
mount is added on the way to the DOM and stripped on the way back from
`location`, which is what `paths.base` used to do. `navigate()` accepts a
prefixed path too, because two of its three callers hand it one — the
`mdClick` / `mdSelect` detail carries a real anchor's `href`.

Two things a router library would not have supplied anyway: the section nav and
the breadcrumb trail are `md-button[href]` and `md-breadcrumb-item[href]` —
custom elements containing real anchors — so they are routed by vetoing their
`mdClick` / `mdSelect` events, not by a `<Link>` component.

**The screens were copied across untouched, and the 404 is why.**
`SectorScreen`, `CounterpartyScreen` and `FacilityScreen` each do
`getXById(id) as X` and would dereference `undefined` on a bogus segment. In the
SvelteKit build the guard was a `throw error(404)` in each dynamic `+page.ts`;
here it is three lookups in `src/App.svelte`, which is the same layer — the
routing call site. Putting it there rather than inside each screen is what let
all six screens, both tables, all eight bits and the shell come across as
copies, with only `$app/*` imports replaced.

**It renders no wrapper element.** Svelte's `{#if}` emits no DOM of its own, and
`#root` in `index.html` carries `style="display: contents"`, so `.shell` and
`<awc-showcase-dock>` are laid out exactly as if the mount point were not there.
`verify-showcase-parity.mjs` measures the vertical gaps between `.shell`'s
children; a real `<div>` anywhere in that chain becomes one of those children
and shifts every gap.

**The components are not bundled.** `@awc-ui/core/loader` and the wrapper
packages are deliberately never imported: Stencil's lazy runtime resolves its
chunks relative to its own location, so bundling it makes it hunt for entry
files under `/showcase/credit-risk/svelte/assets/`, where Vite never wrote them,
and every element renders at zero height. `scripts/sync-runtime.mjs` copies the
minified lazy build into `public/awc-runtime/` and `index.html` loads it from an
absolute URL — through a **classic** inline script that appends a module
`<script>`, because Vite follows the imports inside an inline `type="module"`
block and would either fail the build or fold the runtime into the app's entry
chunk, delaying it behind the whole application bundle.

Only `@awc-ui/core/css/tokens.css` is imported from the library, plus the shared
`@awc-ui/showcase-kit/credit-risk/app.css`. Those two are the one thing that
should go through the bundler.

## Verification

`pnpm verify` starts `scripts/serve-dist.mjs` — deliberately without a history
fallback, so "the deep link works" means the files are really on disk — and
drives the assertions above in a real browser: the response is an empty shell
and identical at every route, every route resolves on a cold load, an unknown id
lands in the app's own empty state, the `md-*` elements have shadow roots (so the
runtime loaded from the right URL), the section nav and the drill anchors and the
back button all route without tearing down the document, the dock switches locale
in place without touching the path, the state query survives a hop, and the dock
renders exactly once with every framework id the kit lists.

At the repo root, `pnpm verify:showcase-parity` compares the builds against each
other on visible text, an ordered `md-*` fingerprint, the element census, live
table rows, document height and block gaps.

## Layout

```
index.html                     the one document; head order is documented in it
vite.config.ts                 base path, the $lib alias, and the head template plugin
svelte.config.js               vitePreprocess + the a11y onwarn filter. No `kit` block.
src/main.ts                    CSS imports, then `new App({ target })`
src/App.svelte                 the route table — six patterns to six screens
src/lib/router.ts              pushState, popstate, $pathname, navigate
src/lib/routes.ts              this build's binding of the kit's shared route table
src/lib/showcase.ts            the dock's state as a Svelte store + translator
src/lib/elements.ts            the objectProps action for props with no attribute form
src/lib/components/            Shell, Dock, Drill, tables, chart wrappers
src/lib/bits/                  KPI tiles, meters, chips, dots
src/lib/screens/               the six screens, plus the not-found screen
src/types/                     md-* element typings and Vite's ambient types
scripts/sync-runtime.mjs       copy Stencil's lazy build into public/awc-runtime/
scripts/fan-out-routes.mjs     one index.html per route, after vite build
scripts/serve-dist.mjs         serve dist/ at the real mount path
scripts/verify-browser.mjs     the browser assertions above
```
