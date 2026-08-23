# Aurelia Bank — Credit Risk Console (SvelteKit)

The SvelteKit build of the `credit-risk` showcase vertical. Six framework builds
render the same six screens from the same fixture; this one prerenders every
route to static HTML and hydrates, and is served at
`awc-ui.dev/showcase/credit-risk/svelte/`.

```bash
pnpm --filter @awc-ui/showcase-credit-risk-svelte build    # -> build/
pnpm --filter @awc-ui/showcase-credit-risk-svelte serve    # build/ at the real mount path
pnpm --filter @awc-ui/showcase-credit-risk-svelte verify   # 15 checks in a real browser
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

95 routes, all prerendered.

## The four decisions worth knowing

**The language changes in place.** Like the React build and unlike the two
server-rendered ones, the dock's locale is client state: `$lib/showcase.ts`
turns `subscribeShowcaseState` into a Svelte store, and every visible string is
`$t('…')`, so switching to Romanian re-renders the whole app without a
navigation. The prerender is written in the default locale (en / ltr) on both
sides of hydration so the first client render matches the HTML exactly; the real
locale arrives from the URL or localStorage immediately after.

**Object props go through an action, custom events do not.** `series`, `nodes`,
`data` and `valueFormatter` have no attribute form, so `use:objectProps` assigns
them to the element instance — and re-assigns on every change, which is what
keeps a chart's axis labels in the page's current language rather than the one
it first drew in. Events need nothing: Svelte's `on:mdSortChange` is a real
`addEventListener`, not a mapped React-style prop, so the library's `md*` events
just work. Their TYPES need declaring, which is what `src/app.d.ts` is for.

**The components are not bundled.** Stencil's lazy runtime is copied into
`static/awc-runtime/` by `scripts/sync-runtime.mjs` and loaded from a static
absolute URL by a module script that `hooks.server.ts` transforms into `<head>`.
Putting it through Vite makes it resolve its entry chunks under `_app/`, where
the build never wrote them, and every element renders at zero height. The full
post-mortem is in that script. `@awc-ui/svelte` is not used for the same reason
— the wrappers import `@awc-ui/core` and put the loader straight back into the
graph.

**Three a11y warnings are silenced, and only on the library's elements.**
Svelte's linter reasons about the tag it can see and cannot see into a shadow
root, so it is wrong about `scope` on `<md-table-cell head>` (which forwards it
onto a real `<th>`) and about a click handler on `<md-button>` (which renders a
real `<button>`). `svelte.config.js` suppresses those codes only when the frame
shows an `md-*` or `awc-*` tag, so the same warning on a real `<td>` or a real
`<div on:click>` still fails the build.

## Checking it

`pnpm verify` starts a server and drives a real browser: the prerendered HTML
carries real rows and real numbers with JavaScript disabled, every component
upgrades, every chart paints, the dock's language picker re-renders every string
without reloading the document, and sorting, paging and drill links all work.

One thing that verification taught: row identity has to be read as a
**property**, not an attribute. Svelte sets data on an upgraded custom element
through its property when one exists, so a row from the prerender carries
`value="cp-01"` in the markup while a row created after a sort carries only the
property. Both reach the component identically — but an attribute-only assertion
reports a working table as `cp-21 → null` and looks like a pass.
