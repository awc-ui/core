# Aurelia Bank — Credit Risk Console (Vue, single-page application)

The **client-routed SPA** build of the `credit-risk` showcase vertical. Every
framework build renders the same six screens from the same fixture; this one
ships one HTML document and one JavaScript entry, resolves its routes in the
browser, and is served at `awc-ui.dev/showcase/credit-risk/vue/`.

Vite, Vue 3, and a router written in this repo. No Nuxt, no meta-framework, no
server rendering, no build-time page generation. Until now `/vue/` was a Nuxt
static export wearing Vue's name; that build moved to
[`../nuxt/`](../nuxt/README.md), where it renders per request and is the entry
that demonstrates SSR. **The two differ only in where the first render happens** —
same screens, same components, same kit — which is the whole reason the pair
exists.

```bash
pnpm --filter @awc-ui/showcase-credit-risk-vue build    # -> dist/
pnpm --filter @awc-ui/showcase-credit-risk-vue dev      # vite, http://localhost:4328/showcase/credit-risk/vue/
pnpm --filter @awc-ui/showcase-credit-risk-vue serve    # serve dist/ at the real mount path
pnpm --filter @awc-ui/showcase-credit-risk-vue verify   # drive the built app in a browser
pnpm --filter @awc-ui/showcase-credit-risk-vue lint     # vue-tsc --noEmit
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
re-render the Vue tree through the translator and leave the path alone, which is
the same arrangement as the `nuxt`, `react`, `angular` and `svelte` builds. Only
`html` and `astro` route the locale (`/astro/ro/`).

## The five decisions worth knowing

**The build still emits 95 HTML files, and that is not a contradiction.**
"Single-page application" here means one document, one JS entry and routing in
the browser — not one file on disk. A cold request for
`/showcase/credit-risk/vue/facilities/fac-001/` reaches the host before any of
this app is running, and a static host answers it with a 404. So
`scripts/fan-out-routes.mjs` copies `dist/index.html` into every route directory;
all 95 are **byte-identical**, because the router reads `location.pathname`. The
list is enumerated from the same fixture selectors (`getSectors`,
`getCounterparties`, `getFacilities`) that fed the twin's `nitro.prerender` list
back when it was a `nuxi generate` build, so adding a fixture row still adds a
page with no second edit.

`pnpm verify` asserts the byte-identity directly, because it is the property that
separates this from a prerender: it fetches `/` and `/facilities/fac-057/` and
requires the two documents to be the same bytes, with no `.shell`, no `<h1>` and
no `<template shadowrootmode>` in either. With JavaScript off, both are empty.

A host rewrite is the other half of the answer and is worth having as well:

```
/showcase/credit-risk/vue/*  /showcase/credit-risk/vue/index.html  200
```

It costs nothing where a real file exists (a `200` rewrite is shadowed by
matching files) and it makes a typo'd or newly-added route land in this app's own
not-found screen rather than the host's. It cannot replace the fan-out: the
repo's own verifiers — `scripts/verify-showcase-parity.mjs` and
`scripts/verify-showcase-a11y.mjs` — serve the staged tree with a dumb file
server that has no rewrite hook.

**The router is a ref and a `popstate` listener.** `src/lib/router.ts` is
`history.pushState` plus a path match, with the current path in a module-level
`ref` — there is one router per document and it outlives every component, so a
provider component would only add a wrapper for the renderer to walk. It exposes
`useRouter().push()` and `usePathname()`. The first keeps its Nuxt name and
signature so the two call sites in `Shell.vue` and `OverviewScreen.vue` are
unchanged from the twin; the second replaces `useRoute().path`, which is the one
shape that had to change, because there is no reactive route object here to hand
back. Paths crossing the router's surface are unprefixed (`/sectors/energy/`);
the mount is added on the way to the DOM and stripped on the way back from
`location`, which is what `app.baseURL` used to do.

Two things Vue Router would not have supplied anyway: the section nav and the
breadcrumb trail are `md-button[href]` and `md-breadcrumb-item[href]` — custom
elements containing real anchors — so they are routed by vetoing their `mdClick`
/ `mdSelect` events, not by a `<RouterLink>`.

**It renders no wrapper element.** `App.vue` is a bare `<component :is>` and
`#root` in `index.html` carries `style="display: contents"`, so `.shell` and
`<awc-showcase-dock>` are laid out exactly as if the mount point were not there.
`verify-showcase-parity.mjs` measures the vertical gaps between `.shell`'s
children; a real `<div>` around the route output becomes one of those children
and shifts every gap. That is the bug its header records against the `html` and
`astro` builds.

**The components are not bundled.** `@awc-ui/vue` and `@awc-ui/core/loader` are
deliberately never imported: Stencil's lazy runtime resolves its chunks relative
to its own location, so bundling it makes it hunt for entry files under
`/showcase/credit-risk/vue/assets/`, where Vite never wrote them, and every
element renders at zero height. `scripts/sync-runtime.mjs` copies the minified
lazy build into `public/awc-runtime/`, `index.html` preloads it from an absolute
URL, and `src/main.ts` executes it with a dynamic `import()` after the app
mounts. The specifier is built from a variable and marked `@vite-ignore` so the
bundler cannot follow it — see the next section for why the *timing* is not
negotiable.

Because the elements are plain custom elements rather than Vue components, object
props and camelCase events go through the `v-awc` directive
(`src/lib/awc.ts`) — `chart.series` has no attribute form, and `@mdSortChange`
compiles to a listener for `md-sort-change`, an event the library never emits.
`isCustomElement` is set in `vite.config.ts`, where the SFC compiler is
configured; get it wrong and Vue warns once per tag per render while everything
still looks fine, which is why `pnpm verify` asserts a silent console.

Only `@awc-ui/core/css/tokens.css` is imported from the library, plus the shared
`@awc-ui/showcase-kit/credit-risk/app.css`. Those two are the one thing that
should go through the bundler.

**The state query survives an in-app navigation**, which the Nuxt build did not
do. The dock keeps theme, locale, direction, density and accent in the URL so
state can travel — including across the framework switcher, which lands on
another origin in dev where `localStorage` does not follow. `router.push()` there
dropped the query on every click; a link copied after two navigations reverted to
defaults on someone else's machine. Here the params ride along.

## One place this build does more than its twin

The three drill screens guard against an id the fixture does not know. The Nuxt
versions cast the lookup's `undefined` away and dereferenced it, so
`/sectors/banana/` threw inside the render — on a server, where the blast radius
is the one request that asked. Here the render is the browser's: the same throw
takes down the masthead, the nav and the dock along with the screen. So
`SectorScreen`, `CounterpartyScreen` and `FacilityScreen` each render
`MissingScreen` on a miss, inside `Shell`, so an unknown id is still somewhere
you can leave from. Verified on all three, plus an unmatched path.

## The Vue-specific trap, and why `main.ts` loads the runtime

**Vue decides per binding whether to write a DOM property or an HTML attribute
on a custom element, and the test is `key in el`.** If `md-button` is already
defined when Vue creates it, `variant` and `icon` are on the instance, so Vue
writes properties and *no attribute is ever set*. If it is not yet defined, Vue
writes attributes and Stencil reads them on upgrade. Both render identically —
Stencil reads the property either way, and the `md-button--tonal` class and
`aria-current` are correct in both.

The catch is that `scripts/verify-showcase-parity.mjs` fingerprints this build on
exactly those attributes (`variant`, `icon`, `label`, `color`, …), against
siblings that always have them. React 18 sets unknown props on custom elements as
attributes unconditionally; the `html` and `astro` builds ship them in the markup;
the Nuxt twin server-renders them and hydration leaves them alone. **This build was
the only one where it came down to a race** — between the app bundle and the
component runtime, both starting from `<head>`.

Measured: ten cold loads of identical bytes produced **two different parity
fingerprints, five each** — `md-button[variant=tonal,icon=dashboard]` on one and
a bare `md-button` on the other.

Two changes fixed it, and both are load-bearing:

1. `index.html` **preloads** the runtime (`<link rel="modulepreload">`) and
   `src/main.ts` `import()`s it *after* `app.mount()`. The first render therefore
   always happens before the elements are defined, so the attributes are always
   written. The bytes still leave the head on the same request, so nothing moves
   off the critical path.
2. `composables/useShowcase.ts` **skips the state update when nothing changed.**
   `subscribeShowcaseState` fires immediately with a fresh object holding the
   same five values, and assigning it re-rendered every screen on every cold
   load — converting those freshly written attributes straight back into
   properties.

After both: one fingerprint per route across eight cold loads each, on `/`,
`/watchlist/` and `/counterparties/cp-01/`. `pnpm verify` asserts it so the
arrangement cannot be undone by accident.

A related consequence remains and is *not* a bug: after an in-app navigation the
elements are upgraded, so re-renders write properties and the attributes go. Any
assertion about a Vue-rendered custom element has to read the property, the host
class or an `aria-*` attribute — never `getAttribute()` on a Stencil prop.
`scripts/verify-browser.mjs` does exactly that, and says why at each site.

## Verification

`pnpm verify` starts `scripts/serve-dist.mjs` — deliberately without a history
fallback, so "the deep link works" means the files are really on disk — and
drives **48 assertions** in a real browser: every route resolves on a cold load,
the shipped HTML is an empty shell on every route and byte-identical across them,
the `md-*` elements have shadow roots (so the runtime loaded from the right URL),
Vue logs nothing, two cold loads produce the same parity fingerprint with its
attributes intact, the section nav and the drill anchors and the back button all
route without tearing down the document, the dock switches locale in place
without touching the path, the state query survives a hop, and the dock renders
exactly once with all seven framework ids.

At the repo root, `pnpm verify:showcase-parity` compares the sibling builds
against each other on visible text, an ordered `md-*` fingerprint, the element
census, live table rows, document height and block gaps.

## Layout

```
index.html                       the one document; head order and the runtime preload
vite.config.ts                   base path, the ~/* alias, isCustomElement, head template plugin
env.d.ts                         vite/client types, and why there is no *.vue shim
src/main.ts                      CSS imports, dock registration, directive, mount, runtime
src/App.vue                      the route table — six patterns to six screens
src/lib/router.ts                pushState, popstate, usePathname, useRouter
src/lib/routes.ts                this build's binding of the kit's shared route table
src/lib/awc.ts                   the v-awc directive: object props + camelCase events
src/lib/types.ts                 shapes two SFCs have to agree on
src/composables/useShowcase.ts   the dock's state as a ref + translator
src/components/                  Shell, DockBar, Drill, tables, chart wrappers, KPI bits
src/components/screens/          the six screens, plus not-found and the missing-id state
scripts/sync-runtime.mjs         copy Stencil's lazy build into public/awc-runtime/
scripts/fan-out-routes.mjs       one index.html per route, after vite build
scripts/serve-dist.mjs           serve dist/ at the real mount path
scripts/verify-browser.mjs       the browser assertions above
```
