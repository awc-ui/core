# Aurelia Bank — Credit Risk Console (Angular, single-page application)

The **client-rendered SPA** build of the `credit-risk` showcase vertical. Every
framework build renders the same six screens from the same fixture; this one
ships one HTML document and one JavaScript entry, resolves its routes in the
browser, and is served at `awc-ui.dev/showcase/credit-risk/angular/`.

Angular 17.3, the `application` builder, the Angular router in
`PathLocationStrategy`. No server, no prerendering, no app-shell. Until now
`/angular/` was a build that prerendered all 95 routes at build time; that build
moved to [`../angular-ssr/`](../angular-ssr/README.md), where it renders per
request and is the entry that demonstrates SSR. The two share every component in
`src/app` — they differ in **where the first render happens** and nowhere else.

```bash
pnpm --filter @awc-ui/showcase-credit-risk-angular build    # -> dist/browser/ (95 index.html files)
pnpm --filter @awc-ui/showcase-credit-risk-angular dev      # ng serve, http://localhost:4324/showcase/credit-risk/angular/
pnpm --filter @awc-ui/showcase-credit-risk-angular serve    # serve dist/browser/ at the real mount path
pnpm --filter @awc-ui/showcase-credit-risk-angular verify   # drive the built output in a browser
pnpm --filter @awc-ui/showcase-credit-risk-angular lint     # tsc -p tsconfig.app.json --noEmit
```

`build` runs `sync-runtime` first, which needs `packages/core/dist` to exist
(`pnpm --filter @awc-ui/core build`), and the app imports the kit's compiled
`dist` (`pnpm --filter @awc-ui/showcase-kit build`).

## Screens

| Route | Screen | Pages |
|---|---|---|
| `/` | Portfolio overview — KPI tiles with sparklines, sector bars, rating distribution, exposure trend by rating band, the counterparty book | 1 |
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
re-render the Angular tree through the translator and leave the path alone,
which is the same arrangement as the `react`, `next`, `angular-ssr`, `vue` and
`svelte` builds. Only `html` and `astro` route the locale (`/astro/ro/`).

## What makes this build a single-page application

With JavaScript disabled the page is **empty**. That is the claim, and section
`[1]` of `scripts/verify-browser.mjs` asserts exactly it — the mirror image of
section `[1]` in the twin's copy of the same file, which asserts that every
`md-*` element arrives with a populated shadow root.

Three settings keep it that way, and none of them is incidental:

- `"prerender": false` and **no `server` entry** in `angular.json`. The
  `application` builder emits `dist/browser/index.html` with an empty
  `<awc-root>` and nothing else.
- `scripts/fan-out-routes.mjs` **refuses to run on a non-empty shell**. Turning
  prerendering back on would otherwise copy the rendered *overview* into all 95
  route directories, so every screen would load, look plausible, and be wrong
  until Angular booted and corrected it.
- `scripts/verify-browser.mjs` fetches five of the routes and asserts the bodies
  are **byte-identical**.

**The build still emits 95 HTML files, and that is not a contradiction.**
"Single-page application" here means one document, one JS entry and routing in
the browser — not one file on disk. A cold request for
`/showcase/credit-risk/angular/facilities/fac-001/` reaches the host before any
of this app is running, and a static host answers it with a 404. So the routes
are enumerated from the same three fixture selectors (`getSectors`,
`getCounterparties`, `getFacilities`) that fed the `prerender-routes.txt` this
build's ancestor wrote, and the shell is copied into each one.

A host rewrite is the other half of the answer and is worth having as well:

```
/showcase/credit-risk/angular/*  /showcase/credit-risk/angular/index.html  200
```

It costs nothing where a real file exists (a `200` rewrite is shadowed by
matching files). It cannot replace the fan-out: the repo's own verifiers —
`scripts/verify-showcase-parity.mjs` and `scripts/verify-showcase-a11y.mjs` —
serve the staged tree with a dumb file server that has no rewrite hook.

## The decisions worth knowing

**The base path is absolute and this build only works mounted at exactly it.**
`src/app/lib/routes.ts` derives it from the kit's `createRoutes('angular')`.
`baseHref` in `angular.json` and `<base href>` in `src/index.html` are the copies
the builder needs before any of our code runs, and `app.config.ts` provides the
same string as `APP_BASE_HREF` so the router reads it from the kit rather than
from the DOM. The `<base>` tag is not decoration: the builder writes `main.js`,
`polyfills.js` and `styles.css` as bare filenames, and the same document is
served at 95 different paths, so without it every asset would resolve against
whichever directory the reader landed in.

There is no `deployUrl`. Relative asset names plus an absolute `<base href>`
already resolve correctly at every depth, `ng serve` drops `deployUrl` anyway,
and adding it would put Critters' resolve root in play for no gain.

**A cold deep link needs no path conversion, and that is why the fan-out works.**
Angular's router matches `/watchlist`, while every link in the vertical is
spelled `/watchlist/`. `appPath()` does that one conversion for `routerLink`;
hrefs stay slashed so the dock's framework switcher can rewrite the segment
without knowing which build it landed on. On the way IN nothing is needed:
`Location.normalize()` strips the base href and then the trailing slash, so the
document served at `…/angular/watchlist/index.html` boots straight into the
`watchlist` route. Angular then replaces the address bar with the un-slashed
spelling, which is why `scripts/serve-dist.mjs` resolves a directory to its
`index.html` — as every static host does.

**Two head tags are written at build time, and neither is page content.**
Angular's `application` builder has no `transformIndexHtml` hook, so
`scripts/inject-head.mjs` runs after `ng build` and substitutes one marker
comment in `dist/browser/index.html` with the kit's preboot IIFE and the
reporting-date meta — the same two values React's `awc-showcase-head` Vite
plugin substitutes into its own `index.html`. It also strips the ~5 kB of HTML
comments from `src/index.html`, which would otherwise ship 95 times.

The preboot has to be *markup*, not an `APP_INITIALIZER`: it stamps `lang`,
`dir`, `data-theme` and `data-density` onto `<html>` before the stylesheet
paints, and on an SPA the wait for `main.js` is the longest in the document — a
dark-theme reader would get a white page for all of it, and an Arabic reader an
LTR one. The initializer in `app.config.ts` keeps the same code behind a
`[data-awc-preboot]` guard for the one case the build step cannot cover:
`ng serve`, which composes the document in memory.

**The components are not bundled.** `@awc-ui/core/loader` is deliberately never
imported: Stencil's lazy runtime resolves its chunks relative to its own
location, so bundling it makes it hunt for entry files beside `main.js`, where
nothing was written, and every element renders at zero height.
`scripts/sync-runtime.mjs` copies the minified lazy build into
`public/awc-runtime/` — which the builder's `assets` glob copies to the output
root — and `src/index.html` loads it with a plain `<script type="module">` in
`<head>`. Angular's index generator only appends to that document, so the tag
survives verbatim and the request goes out while the head is still parsing,
in parallel with `main.js` rather than after it.

**`inlineCritical` is off.** `optimization: true` would run Critters over the
shell, which here has an empty `<body>`: it would extract almost nothing and
still convert the app stylesheet into the `media="print"` / `onload` preload
pattern. On a build where the first paint happens after `main.js` runs, that
turns a guaranteed-applied stylesheet into a race. Minification and font
inlining stay on.

**Every string prop is an ATTRIBUTE binding.** `[attr.label]="x"`, never
`[label]="x"` — even though the property form would work perfectly in a build
that only ever renders in a browser. Two reasons, both in
`src/app/components/element.md`: the server-rendered twin shares this source and
there the distinction decides whether the document carries any content at all,
and `verify-showcase-parity.mjs` fingerprints elements by their attributes, so
property bindings would empty the fingerprint while the page still looked right.

**Custom events need nothing at all.** `(mdSortChange)="onSort($event)"` works
exactly as written — Angular calls `addEventListener` with the name as given.
This is the one place Angular is straightforwardly better at these components
than React (which only maps known DOM events) or Vue (whose `@mdSortChange`
hyphenates to `md-sort-change` and silently listens for an event that is never
emitted).

## Known limits

- **The document title stays English.** The locale lives in a query parameter
  that only client JavaScript reads, so the document that leaves the static host
  has no authoritative language. The preboot swaps `lang`/`dir` on `<html>` and
  every visible string re-renders through the translator; `<title>` cannot
  follow. Same limitation, same reason, as the builds either side of this one.
- **The dock's state query does not survive an in-app navigation.**
  `router.navigateByUrl(appPath(…))` drops the query string, so a link copied
  after two clicks reverts to defaults on someone else's machine.
  `localStorage` covers it within one browser. This matches `angular-ssr`
  exactly — the two use the same navigation call sites — and differs from the
  React SPA, which preserves the params deliberately.
- **An unknown path 404s at the host.** There is no wildcard route, the same as
  the twin. On a host configured with the history rewrite above, such a path
  would reach the app instead and Angular would log "Cannot match any routes"
  and render nothing. No link this app produces can reach that state — every one
  of them is built from the kit's fixture.

## Checking it

`pnpm lint` is `tsc -p tsconfig.app.json --noEmit`. Template type-checking
(`strictTemplates`) runs as part of `ng build`.

`pnpm verify` builds nothing itself — build first — then starts
`scripts/serve-dist.mjs`, deliberately without a history fallback, so "the deep
link works" means the files are really on disk. It drives a real browser through
53 assertions in eight sections: the shell is empty with JavaScript off, the 95
documents are one document, every cold deep link boots into its screen, all 41
sampled `md-*` elements upgrade and all 7 charts paint, the section nav and drill
anchors and back button all route without tearing down the document, the dock
switches locale in place without touching the path, the tables sort and page
through the selector, and the dock renders once with every framework id the kit
knows.

At the repo root, `pnpm verify:showcase-parity` compares this build against the
reference on visible text, an ordered `md-*` fingerprint, the element census,
live table rows, document height and block gaps.

## Layout

```
angular.json                   builder options: the mount, no ssr, no prerender
src/index.html                 the one document; head order is documented in it
src/main.ts                    bootstrapApplication, and nothing else
src/app/app.config.ts          router, APP_BASE_HREF, the preboot fallback, the dock
src/app/app.routes.ts          the six screens, each lazily loaded
src/app/lib/routes.ts          this build's binding of the kit's shared route table
src/app/lib/screen.base.ts     the translator and route table every component injects
src/app/lib/showcase.service.ts the dock's state as a signal + the translator
src/app/components/            Shell, Dock, tables, chart wrappers, KPI bits
src/app/components/element.md  how to bind to the md-* elements from Angular
src/app/screens/               the six screens
scripts/sync-runtime.mjs       copy Stencil's lazy build into public/awc-runtime/
scripts/inject-head.mjs        preboot + reporting date into the built shell
scripts/fan-out-routes.mjs     one index.html per route, after ng build
scripts/serve-dist.mjs         serve dist/browser/ at the real mount path
scripts/verify-browser.mjs     the browser assertions above
```
