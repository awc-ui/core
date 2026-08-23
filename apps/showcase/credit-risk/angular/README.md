# Aurelia Bank — Credit Risk Console (Angular)

The Angular build of the `credit-risk` showcase vertical. Six framework builds
render the same six screens from the same fixture; this one prerenders every
route to static HTML and hydrates, and is served at
`awc-ui.dev/showcase/credit-risk/angular/`.

```bash
pnpm --filter @awc-ui/showcase-credit-risk-angular build    # -> dist/browser/
pnpm --filter @awc-ui/showcase-credit-risk-angular serve    # at the real mount path
pnpm --filter @awc-ui/showcase-credit-risk-angular verify   # checks in a real browser
```

`build` runs `sync-runtime` and `prerender-routes` first. `sync-runtime` needs
`packages/core/dist` to exist (`pnpm --filter @awc-ui/core build`).

## Screens

| Route | Screen |
|---|---|
| `/` | Portfolio overview — KPI tiles with sparklines, sector bars, rating distribution, exposure trend by rating band, the counterparty book |
| `/sectors/:sector` | Concentration and utilisation meters, sector EL/RWA trend, the sector's counterparties (7 pages) |
| `/counterparties/:id` | Obligor header, then tabs for facilities, rating history and group structure (24 pages) |
| `/facilities/:id` | Terms, covenant headroom meters, collateral net of haircuts, balance schedule to maturity (61 pages) |
| `/watchlist` | Early-warning signals, filtered by severity and sector |
| `/stress` | Baseline / adverse / severe, EL and RWA comparison charts, per-sector impact |

95 routes, all prerendered.

## The five decisions worth knowing

**Every string prop is an ATTRIBUTE binding.** `[attr.label]="x"`, never
`[label]="x"`. This is the single decision the prerender depends on, and it is
easy to get wrong because the property form works perfectly in a browser.
Angular's property binding compiles to `element.label = x`; during the
**prerender** that sets a JavaScript property on a DOM node which is then
serialised to HTML, and a property that was never an attribute does not appear
in the output. Bound that way, every chip, cell and meter would prerender as an
empty tag and the static HTML would carry no content at all.
`components/element.md` has the full rule, including how boolean and
presence-only attributes are written.

**Custom events need nothing at all.** `(mdSortChange)="onSort($event)"` works
exactly as written — Angular calls `addEventListener` with the name as given.
This is the one place Angular is straightforwardly better at these components
than React (which only maps known DOM events) or Vue (whose `@mdSortChange`
hyphenates to `md-sort-change` and silently listens for an event that is never
emitted).

**No `provideClientHydration()`, deliberately.** Angular's hydration walks the
prerendered DOM and asserts it matches what the client renders; these components
attach shadow roots and rewrite their own internals the moment the runtime
lands, which is exactly the third-party mutation hydration is documented not to
tolerate. Without it Angular re-renders on bootstrap, which costs a frame and
buys certainty. The prerendered HTML still does its job — real rows and real
figures for a reader with JavaScript off, and for anything reading the page
without running it.

**Wrapper components must not become boxes.** An Angular component always
renders its own host element, and the shared stylesheet is written for the DOM
the other five builds emit. Every wrapper here sets `:host { display: contents }`
so it vanishes from layout. Where even that is not enough — `.dl > div` is a
*structural* selector, and no layout property can make it match
`.dl > awc-fact > div` — the component takes an attribute selector instead and
IS the element: `<div awcFact [label]="…">`. Same for the drill links, which are
plain `<a class="drill" [routerLink]="…">`.

**Trailing slashes differ on the way in, not on the way out.** Every other build
links to `/watchlist/`; Angular's router treats that as a different path from
`/watchlist` and matches neither to the other. So the route table and
`prerender-routes.txt` use bare paths, `appPath()` does the one conversion from
the kit's slashed form, and the builder still emits `watchlist/index.html` —
the directory shape every other build produces and a static host needs.

## Checking it

`pnpm lint` is `tsc --noEmit` over the app, and `strictTemplates` is on, so the
templates are type-checked too.

`pnpm verify` starts a server and drives a real browser: the prerendered HTML
carries real rows and real numbers with JavaScript disabled, every component
upgrades, every chart paints, the dock's language picker re-renders every string
without reloading the document, and sorting, paging and drill links all work.
