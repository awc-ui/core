# Kestrel Private Bank — Wealth Management Console (Vue, single-page application)

The **client-routed SPA** build of the `wealth` showcase vertical. Every
framework build renders the same six screens from the same fixture; this one
ships one HTML document and one JavaScript entry, resolves its routes in the
browser, and is served at `awc-ui.dev/showcase/wealth/vue/`.

Vite, Vue 3, and a router written in this repo. No Nuxt, no meta-framework, no
server rendering — this vertical is SPA-only by design (an authenticated
internal console is the case where an SPA is the honest shape rather than a
compromise; see the kit's `FRAMEWORKS` note).

The **React build next door is the behavioural source of truth** for wealth;
the **credit-risk Vue build** is the structural source of truth for how a Vue
SPA lives in this repo. This app is the intersection: React's shell, screens
and traps, in credit-risk Vue's grooves (`v-awc`, the module-ref router, the
post-mount runtime import).

```bash
pnpm --filter @awc-ui/showcase-wealth-vue build    # -> dist/, then fan-out
pnpm --filter @awc-ui/showcase-wealth-vue dev      # vite, http://localhost:4338/showcase/wealth/vue/
pnpm --filter @awc-ui/showcase-wealth-vue serve    # serve dist/ at the real mount path
pnpm --filter @awc-ui/showcase-wealth-vue verify   # drive the built app in a browser
pnpm --filter @awc-ui/showcase-wealth-vue lint     # vue-tsc --noEmit
```

`build` runs `sync-runtime` first, which needs `packages/core/dist` to exist
(`pnpm --filter @awc-ui/core build`), and the app imports the kit's compiled
`dist` (`pnpm --filter @awc-ui/showcase-kit build`).

## Screens

| Route | Screen | Pages |
|---|---|---|
| `/` | Book overview — KPI tiles, allocation donut, growth chart, household book table, activity feed | 1 |
| `/holdings/` | Positions and instrument universe, filter bar, CSV export | 1 |
| `/households/[id]/` | One household — tabs for members/mandate/orders, org chart, settings sheet | 8 |
| `/proposals/` | Proposal pipeline and the four-step proposal builder | 1 |
| `/trade/` | Order ticket and blotter | 1 |
| `/planning/` | Goals, what-if scenario, projection chart | 1 |

13 addressable screens, six route patterns, one parameterised. The route shapes
come from `@awc-ui/showcase-kit/wealth`, so a link written once cannot drift
between ports.

> **Status:** the shell, router, dock bridge, bits vocabulary, skeleton system
> and all build/verify plumbing are final. The six screens are **stubs** —
> chrome plus an empty state — until the screens phase ports them from
> `../react/src/components/screens/`. Each stub file already has its final
> name, so that phase replaces file contents and touches nothing else.

The locale is **not** in the URL. `?lang=ro` and the dock's language menu
re-render the Vue tree through the translator and leave the path alone. Only
the `html` build routes the locale.

## How this differs from the credit-risk Vue build

- **The frame outlives navigation.** `App.vue` wraps the route outlet in ONE
  `AppFrame` (app bar, navigation rail, compact navigation bar, dock) instead
  of rendering a `Shell` inside every screen. A brand-new
  `md-navigation-rail` per navigation has nothing to animate FROM — the active
  indicator jumps instead of sliding — and the rail's expansion state would
  reset per click. `composables/useShell.ts` holds that state in a module ref.
- **Screen + skeleton system.** `Screen.vue` renders the trail row (always,
  even empty), the heading, the one `md-toolbar`, then a stage where the REAL
  children render from the first frame (hidden via `data-placeholder`) and a
  plain-div skeleton is absolutely overlaid for a 550ms once-per-screen beat.
  `?skeleton=hold` / `?skeleton=<ms>` are the inspection handles. Skeletons are
  divs, not `md-skeleton` — a lazily-hydrated placeholder pops open exactly
  like the content it hides.
- **Extra stylesheet.** `main.ts` imports `@awc-ui/core/css/pre-upgrade.css`
  (per-component pre-hydration size floors) which credit-risk predates.
- **Navigation surfaces.** The rail intercepts the NATIVE click via
  `composedPath()` (plain `@click` — `mdTabChange` does not fire on
  re-activating the current destination); the bar vetoes in the CAPTURE phase
  (`@click.capture` — `md-navigation-tab` reads `defaultPrevented` before it
  calls `location.assign`); the breadcrumbs veto `mdSelect` through `v-awc`.
- **The dock carries `label`.** Its heading falls back to the FIRST vertical's
  title, so an unlabelled dock here would announce "Credit Risk Console".

Everything else — the `v-awc` directive, the pushState router, the
`modulepreload` + post-mount runtime import (the property-vs-attribute race),
the `same()` guard in `useShowcase`, the fan-out, the no-fallback dist server —
is the credit-risk Vue arrangement verbatim; that build's README carries the
measurements behind each decision.

## Layout

```
index.html                       the one document; head order, BOTH icon faces with full axis lists, runtime preload
vite.config.ts                   base path, ~/* alias, isCustomElement, head template plugin, port 4338
env.d.ts                         vite/client types, and why there is no *.vue shim
src/main.ts                      3 CSS imports, dock registration, directive, mount, runtime import
src/App.vue                      AppFrame around the route outlet — six patterns to six screens
src/lib/router.ts                pushState, popstate, usePathname, useRouter, isPlainActivation
src/lib/routes.ts                createRoutes('vue') + kit re-exports (DESTINATIONS, crumbsFor, …)
src/lib/awc.ts                   the v-awc directive: object props + camelCase events
src/lib/types.ts                 ChartSeries / OrgNode (CrumbSpec comes from the kit)
src/composables/useShowcase.ts   the dock's state as a ref + callable translator
src/composables/useShell.ts      rail expansion — frame state that outlives screens
src/composables/useScreenReady.ts the 550ms once-per-pathname beat + ?skeleton override
src/components/                  AppFrame, AppBar, Rail, Bar, Breadcrumbs, Screen, Panel,
                                 EmptyState, Drill, Chart, Sparkline, DockBar
src/components/bits/             Money/Percent/Signed/…, 18 chips, 4 dots, 3 meters
src/components/skeletons/        plain-div Bar/Kpi/Panel/Table/Screen skeletons + SKELETON_MS
src/components/screens/          six screens (stubs), NotFoundScreen, trade/planning/snackbar.css
scripts/sync-runtime.mjs         copy Stencil's lazy build into public/awc-runtime/ (verbatim from ../react)
scripts/fan-out-routes.mjs       one index.html per route, after vite build
scripts/serve-dist.mjs           serve dist/ at the real mount path (port 4338)
scripts/verify-browser.mjs       SPA-behaviour assertions in a real browser (port 4355)
```
