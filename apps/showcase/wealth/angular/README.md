# Kestrel Private Bank — Wealth Management Console (Angular, single-page application)

The **Angular SPA** build of the `wealth` showcase vertical. Every framework
build renders the same six screens from the same fixture; this one ships one
HTML document and one JavaScript entry, resolves its routes in the browser, and
is served at `awc-ui.dev/showcase/wealth/angular/`.

Angular 17.3, the `application` builder, the Angular router in
`PathLocationStrategy`. No server, no prerendering, no app-shell — and unlike
the credit-risk vertical, **no server-rendered twin**: wealth is SPA-only by
design (an authenticated internal tool is the case where an SPA is the honest
shape rather than a compromise).

```bash
pnpm --filter @awc-ui/showcase-wealth-angular build    # -> dist/browser/ (13 index.html files)
pnpm --filter @awc-ui/showcase-wealth-angular dev      # ng serve, http://localhost:4334/showcase/wealth/angular/
pnpm --filter @awc-ui/showcase-wealth-angular serve    # serve dist/browser/ at the real mount path (:4335)
pnpm --filter @awc-ui/showcase-wealth-angular verify   # drive the built output in a browser (:4354)
pnpm --filter @awc-ui/showcase-wealth-angular lint     # tsc -p tsconfig.app.json --noEmit
```

`build` runs `sync-runtime` first, which needs `packages/core/dist` to exist
(`pnpm --filter @awc-ui/core build`), and the app imports the kit's compiled
`dist` (`pnpm --filter @awc-ui/showcase-kit build`).

## Screens

| Route | Screen | Pages |
|---|---|---|
| `/` | Book overview — KPI tiles, allocation donut, growth chart, activity feed, the household book | 1 |
| `/holdings/` | Positions and instrument universe, filter bar, CSV export | 1 |
| `/households/[id]/` | One household — allocation, performance, members, mandate, settings sheet | 8 |
| `/proposals/` | Proposal pipeline and the four-step proposal builder | 1 |
| `/trade/` | Order ticket and blotter | 1 |
| `/planning/` | Client objectives and the what-if projection | 1 |

13 addressable screens, six route patterns, one of them parameterised — the
same set as every sibling build. The route shapes come from
`@awc-ui/showcase-kit/wealth`, so a link written once cannot drift between
ports. The household drill is deliberately NOT a rail destination (five
destinations for six routes — see the kit's `DESTINATIONS`).

The locale is **not** in the URL. `?lang=ro` and the dock's language menu
re-render the Angular tree through the translator and leave the path alone.
Only the `html` build of this vertical routes the locale.

## What makes this build a single-page application

With JavaScript disabled the page is **empty** — section `[1]` of
`scripts/verify-browser.mjs` asserts exactly that. Three settings keep it so:

- `"prerender": false` and **no `server` entry** in `angular.json`.
- `scripts/fan-out-routes.mjs` **refuses to run on a non-empty shell** — turning
  prerendering back on would copy the rendered overview into all 13 route
  directories.
- `scripts/verify-browser.mjs` fetches five of the routes and asserts the
  bodies are **byte-identical**.

The build still emits 13 HTML files, and that is not a contradiction:
"single-page application" means one document, one JS entry and routing in the
browser — not one file on disk. A cold request for
`/showcase/wealth/angular/households/hh-01/` reaches the host before any of
this app is running, so the routes are enumerated from the kit's fixture
selector (`getHouseholds`) and the shell is copied into each one.

## How this build is put together

- **Chrome above the router.** `AppComponent` renders the app bar, the
  navigation rail, the compact navigation bar and the dock ONCE, with
  `<router-outlet>` inside `main.shell__main` — the React build's `AppFrame`.
  The rail's expansion lives in the root-provided `ShellService`, so both the
  elements and their state survive navigation (indicator slides, width
  transition runs).
- **`ScreenComponent`** owns the per-screen frame: always-rendered trail row,
  heading, optional toolbar, and the once-per-pathname 550ms skeleton beat with
  the `?skeleton=hold` / `?skeleton=<ms>` inspection override. The real content
  is mounted from the first frame and hidden via `data-placeholder`; the
  skeleton (plain divs, never `md-skeleton`) is absolutely overlaid.
- **Binding house rules** are in `src/app/components/element.md`: `(mdX)`
  events bind directly, scalars are `[attr.x]` bindings, object props are
  property bindings built with `ShowcaseComponent.memo()`, booleans are
  `cond ? '' : null`, and `md-navigation-bar`'s veto needs the hand-attached
  capture-phase listener in `bar.component.ts`.
- **`bits.component.ts`** is the formatting/status vocabulary (Money, Percent,
  Signed, dates, chips, dots, meters, Highlight, KpiTile) — attribute-selector
  components so the DOM stays identical to the React reference. No `Intl`
  calls, status ternaries or hardcoded chip colours anywhere else.
- Everything shared comes from `@awc-ui/showcase-kit/wealth` (routes, tables,
  selectors, status maps, i18n, `app.css`) and is never restated.
  `trade.css` / `planning.css` / `snackbar.css` are the React app's
  framework-free per-screen stylesheets, loaded via `angular.json`.
