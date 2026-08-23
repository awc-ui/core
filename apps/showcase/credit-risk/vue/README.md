# Aurelia Bank — Credit Risk Console (Nuxt)

The Nuxt build of the `credit-risk` showcase vertical. Six framework builds
render the same six screens from the same fixture; this one generates every
route to static HTML and hydrates, and is served at
`awc-ui.dev/showcase/credit-risk/vue/`.

```bash
pnpm --filter @awc-ui/showcase-credit-risk-vue build    # -> .output/public/
pnpm --filter @awc-ui/showcase-credit-risk-vue serve    # at the real mount path
pnpm --filter @awc-ui/showcase-credit-risk-vue verify   # 15 checks in a real browser
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

95 routes, all prerendered by Nitro.

## The four decisions worth knowing

**`@mdSortChange` does not work, and it fails silently.** This is the one thing
about Vue and these components worth knowing before you write a line. Vue's
runtime parses a listener key as `hyphenate(key.slice(2))`, so the template's
`@mdSortChange` compiles to `onMdSortChange` and the runtime listens for
`md-sort-change` — an event the library never emits. Nothing warns; the table
simply never sorts. So every custom-event listener goes through the `v-awc`
directive (`plugins/awc.ts`) instead, which also carries the object-valued props
(`series`, `nodes`, `data`, `valueFormatter`) that have no attribute form at
all. One directive, both problems, explained in one place:

```vue
<md-table v-awc="{ on: { mdSortChange: onSortChange } }" />
<md-bar-chart v-awc="{ props: { series, xAxis, valueFormatter } }" />
```

Props are re-assigned on every update, which is what a locale switch needs — a
chart whose `valueFormatter` is not re-assigned keeps labelling its axis in the
previous language.

**The language changes in place.** Like the React and Svelte builds and unlike
the two server-rendered ones, the dock's locale is client state:
`composables/useShowcase.ts` turns `subscribeShowcaseState` into a ref — one
subscription for the whole app, not one per component — and every visible string
goes through `t`. The prerender is written in the default locale (en / ltr) on
both sides of hydration so the first client render matches the HTML exactly.

**The components are not bundled.** Stencil's lazy runtime is copied into
`public/awc-runtime/` by `scripts/sync-runtime.mjs` and loaded from a static
absolute URL by a module script that `server/plugins/preboot.ts` unshifts into
`<head>` — a Nitro hook rather than `app.head`, because only the hook can
promise a position relative to Nuxt's own tags, and the preboot IIFE has to come
first. Putting the runtime through Vite makes it resolve its entry chunks under
`_nuxt/`, where the build never wrote them, and every element renders at zero
height. The full post-mortem is in that script.

**`pnpm lint` filters third-party parse errors, and says so.** TypeScript 5.4 —
which this repo pins for every package — cannot PARSE the declaration files that
Nuxt 3.21 pulls in through `@nuxt/schema` (`@vitejs/plugin-vue-jsx` uses an
arbitrary-string export name). Those are syntax errors, so `skipLibCheck` does
not suppress them, and there is no way to keep Nuxt's auto-import and route
types while dropping that reference. `scripts/typecheck.mjs` runs the real check
and fails on any diagnostic in this app's own files, warning about the
`node_modules` ones every run rather than hiding them. Bumping the workspace
TypeScript past 5.5 fixes it in one line and lets that script be deleted.

## Checking it

`pnpm verify` starts a server and drives a real browser: the prerendered HTML
carries real rows and real numbers with JavaScript disabled, every component
upgrades, every chart paints, the dock's language picker re-renders every string
without reloading the document, and sorting, paging and drill links all work.

Row identity is read as a **property**, not an attribute: Vue sets data on an
upgraded custom element through its property when one exists, so a row from the
prerender carries `value="cp-01"` in the markup while a row created after a sort
may carry only the property. Both reach the component identically — an
attribute-only assertion would report a working table as broken.
