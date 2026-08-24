# Aurelia Bank — Credit Risk Console (Angular, server-rendered)

The Angular SSR build of the `credit-risk` showcase vertical. Every framework
build renders the same six screens from the same fixture; this one renders them
**on the server, per request**, and is served at
`awc-ui.dev/showcase/credit-risk/angular-ssr/`.

```bash
pnpm --filter @awc-ui/showcase-credit-risk-angular-ssr build   # -> dist/browser/ + dist/server/
pnpm --filter @awc-ui/showcase-credit-risk-angular-ssr start   # the real server, :4613 (or $PORT)
pnpm --filter @awc-ui/showcase-credit-risk-angular-ssr verify  # checks in a real browser
```

`build` runs `sync-runtime` first, which needs `packages/core/dist` to exist
(`pnpm --filter @awc-ui/core build`).

## Screens

| Route | Screen |
|---|---|
| `/` | Portfolio overview — KPI tiles with sparklines, sector bars, rating distribution, exposure trend by rating band, the counterparty book |
| `/sectors/:sector` | Concentration and utilisation meters, sector EL/RWA trend, the sector's counterparties (7 pages) |
| `/counterparties/:id` | Obligor header, then tabs for facilities, rating history and group structure (24 pages) |
| `/facilities/:id` | Terms, covenant headroom meters, collateral net of haircuts, balance schedule to maturity (61 pages) |
| `/watchlist` | Early-warning signals, filtered by severity and sector |
| `/stress` | Baseline / adverse / severe, EL and RWA comparison charts, per-sector impact |

95 routes, none of them prerendered.

## What makes this build server-rendered

`scripts/verify-ssr.mjs` at the repo root asks two independent questions, and
`src/server.ts` is written to answer both.

**Did the markup arrive without a browser?** The response is fetched with
`fetch`, which runs no JavaScript. Angular's renderer emits
`<md-card class="panel">…</md-card>` — a bare custom-element tag, because a
custom element is only ever upgraded by a browser — so the server runs the
finished HTML through `renderToString` from `@awc-ui/core/hydrate`, which gives
every `md-*` element the declarative shadow root and the styles it would have
had in one. That is the same module and the same options
`apps/showcase/credit-risk/astro/src/middleware.ts` uses, hung off Angular's
response instead of Astro's.

**Was it rendered for THIS request?** The fixture is frozen at `REPORTING_DATE`
with no clock and no randomness anywhere, which is exactly what makes a static
export and a live render produce byte-identical screens — good for parity, and
useless as proof. So every response carries

```html
<meta name="awc-render-mode" content="ssr">
<meta name="awc-rendered-at" content="2026-08-24T…Z">
```

stamped while the request is being served. Two requests a second apart disagree,
and they can only disagree if the HTML was built for each of them. The marker is
added AFTER the hydrate pass, so it survives even a transform that threw — the
harness fails an app that emits no marker just as hard as one whose markers
match, on the stated grounds that silence is not evidence.

Three settings keep it honest, and none of them is incidental:

- `"prerender": false` in `angular.json`. This build used to prerender all 95
  routes; that is the setting the conversion exists to change.
- **No `publicPath`** on the `CommonEngine.render()` call. `CommonEngine` starts
  by looking for `<publicPath>/<pathname>/index.html` and returns that file
  instead of rendering if it finds one marked `ng-server-context="ssg"`.
  Omitting `publicPath` makes that lookup return early every time, so there is
  no path through the server that serves a page it did not just render — not
  even with a stale `dist/` left over from before the conversion.
- `Cache-Control: no-store` on every rendered response. A cache in front of this
  would make the render marker lie.

**What does NOT server-render, and this is correct behaviour rather than a gap:**
charts draw into a `<canvas>`, and a canvas cannot be painted without a canvas
context. What arrives for a chart is its **frame** — heading, subtitle, legend,
accessible name and the data-table description a screen reader reads — with the
plot appearing when the runtime draws it. Every other figure on every screen,
tables and meters and chips included, is in the HTML. So with JavaScript off
this is a complete, readable credit report with blank chart panels, not a
finished dashboard.

## How it is wired

`angular.json` points `ssr.entry` at `src/server.ts`, so the Angular builder
compiles it with the rest of the app and emits `dist/server/server.mjs` next to
the `main.server.mjs` it imports and the `polyfills.server.mjs` the builder
prepends. `pnpm start` runs that one file. Angular 17.3 ships `CommonEngine`
from `@angular/ssr`; the `provideServerRendering()` / `CommonEngine` pairing is
that version's API and differs from 18's and 19's.

`@awc-ui/core/hydrate` is listed in `externalDependencies`. It is Stencil's
3.9 MB hydrate app, a runtime dependency of the server and never of the browser,
and it must not go through esbuild — `optimization: true` would minify it, and
it is not a library written to survive that. Left external, `server.mjs` imports
it from `node_modules` at startup.

**The base path is absolute and this build only works mounted at exactly it.**
`src/app/lib/routes.ts` derives it from the kit's `SHOWCASE_BASE` and this
build's framework id — spelled out rather than taken from `createRoutes()`,
because the kit's `Framework` union does not list `angular-ssr` yet and this
package's `lint` is `tsc --noEmit`; the file carries the note and collapses back
to one line the day that constant is widened.
`baseHref` and `deployUrl` in `angular.json` and `<base href>` in
`src/index.html` are the copies the builder needs before any of our code runs,
and `src/server.ts` provides the same string as `APP_BASE_HREF` per request.
Angular's own scaffold passes express's `req.baseUrl` there, which is `''` for a
server that is not mounted behind a router — and an empty base means the router
tries to match `/showcase/credit-risk/angular-ssr/watchlist` as a route and
matches nothing.

## The decisions worth knowing

**Every string prop is an ATTRIBUTE binding.** `[attr.label]="x"`, never
`[label]="x"`. This is the single decision the server render depends on, and it
is easy to get wrong because the property form works perfectly in a browser.
Angular's property binding compiles to `element.label = x`; on the server that
sets a JavaScript property on a DOM node which is then serialised to HTML, and a
property that was never an attribute does not appear in the output. Bound that
way, every chip, cell and meter would arrive as an empty tag and the response
would carry no content at all. `src/app/components/element.md` has the full
rule, including how boolean and presence-only attributes are written.

**Custom events need nothing at all.** `(mdSortChange)="onSort($event)"` works
exactly as written — Angular calls `addEventListener` with the name as given.
This is the one place Angular is straightforwardly better at these components
than React (which only maps known DOM events) or Vue (whose `@mdSortChange`
hyphenates to `md-sort-change` and silently listens for an event that is never
emitted).

**The server writes the preboot script and the runtime import into the head.**
It has to. `bootScripts()` in `app/app.config.ts` needs a `document` and there
is no global one in a Node render, so under prerendering both tags were only
ever added in the browser, once `main.js` had run. That was survivable when the
first paint was unstyled anyway. It is not now: a page that arrives fully
painted in the wrong theme — and in the wrong direction for Arabic — until a
bundle downloads is worse than one that arrives unpainted. The server's tags
carry the same `data-awc-preboot` / `data-awc-runtime` markers `bootScripts()`
looks for, which is what stops the client adding a second copy.

**`provideClientHydration()` is on, and the browser ADOPTS the server's render.**
This was absent for a long time, with a note saying it was absent on purpose:
Stencil's components attach shadow roots and rewrite their own internals when
the runtime lands, and that was read as the third-party mutation Angular's
hydration is documented not to tolerate. The reasoning was wrong, and it cost
this build the thing it advertises.

Without `provideClientHydration()`, Angular adopts nothing.
`bootstrapApplication` empties `<awc-root>` and renders the app from scratch, so
the 206 `<template shadowrootmode>` shadow roots the server sent are torn out of
the document along with the elements holding them, and Stencil builds all 206
again in the browser. Nothing *looked* wrong — which is exactly why it lasted:
the replacement render is correct, so no screenshot, no text assertion and no
element count could see it. What it cost was the claim. Measured with the
runtime request blocked, so only Angular's own hydration is observed, `md-badge`
came back carrying one attribute — `value`, the one Angular's template sets —
with `class`, `role`, `aria-label`, `variant`, `density` and `s-id` gone and no
shadow root at all. `s-id` is the marker Stencil writes on every host it
server-rendered, and the only signal its client runtime has that a shadow root
is already there. Zero of 174 hosts kept it. The server render was real for one
paint and then thrown away.

With it, Angular locates the existing elements instead of creating them, and it
never enumerates and clears attributes it did not put there — unlike Svelte 4's
`claim_element`, which is what broke the sibling build. `s-id` survives on all
174 hosts, the declarative shadow roots stay attached to the elements that own
them, and Stencil adopts every one of them. `node scripts/verify-ssr-adoption.mjs
angular-ssr` reports `server render is ADOPTED — 174 of 174 hosts keep their
marker through hydration`, the same line `next` and `nuxt` get, and no screen
renders anything twice.

The third-party mutation the old note feared is real, but it lands where Angular
is not looking: Stencil mutates the **shadow** roots, which Angular never walks,
and sets attributes on the hosts, which Angular ignores. Neither is a structural
change to Angular's tree.

**One thing had to change in `src/server.ts` for that to be safe.** Stencil's
hydrate pass writes positional marker comments as well as `s-id`/`c-id`, and one
of them — `<!--r.N-->`, a content reference — lands as the first child of every
host, in the **light** DOM, which is the tree Angular hydrates:

```html
<md-button … s-id="6133"><!--r.6133--> Overview </md-button>
```

Angular resolves a first child as `parent.firstChild` and validates what it
finds only under `ngDevMode` — in the production build shipped here there is no
check at all. It would claim that comment as the text node its template says is
there, write `" Overview "` into the comment on the first change-detection pass,
and leave the real text beside it as an orphan no binding ever touches again: a
label that looks right and then never changes language, with every following
sibling in that view off by one node. So the annotations stay on, which is what
buys the adoption, and `stripLightDomAnnotations` in `src/server.ts` removes the
markers from the light DOM **only** — every annotation inside a shadow root is
left exactly as written, because Angular never walks in there and Stencil needs
them intact. `nuxt/server/plugins/awc-ssr-dsd.ts` carries the same walk for the
same boundary; Vue's hydration fails loudly where Angular's fails silently.

**Trailing slashes differ on the way in, not on the way out.** Every other build
links to `/watchlist/`; Angular's router treats that as a different path from
`/watchlist` and matches neither to the other. `appPath()` does the one
conversion for `routerLink`, and hrefs stay slashed so the dock's framework
switcher can rewrite the segment without knowing which build it landed on. On
the server no conversion is needed: `Location.normalize()` strips the base href
and then the trailing slash before the router sees the path.

## Checking it

`pnpm lint` is `tsc --noEmit` over the app including `src/server.ts`, and
`strictTemplates` is on, so the templates are type-checked too.

`pnpm verify` starts the real server and drives a real browser: the document the
server sends carries declarative shadow roots, real rows and real numbers with
JavaScript disabled; every component upgrades; every chart paints; the dock's
language picker re-renders every string without reloading the document; and
sorting, paging and drill links all work.

`node scripts/verify-ssr.mjs angular-ssr`, from the repo root, runs no
JavaScript and answers the two questions above — did the markup arrive without a
browser, and was it built for this request.

`node scripts/verify-ssr-adoption.mjs angular-ssr` asks the question neither of
those can, because both are answered by `fetch`: does the **browser keep** what
the server sent. It loads each screen twice — once with the Stencil runtime
request blocked, so only Angular's hydration is observed, and once whole — and
reports whether `s-id` survived and whether the page ended up with more shadow
hosts than the server sent templates. This build must report `ADOPTED`, `174 of
174`, and no duplication on any of the six screens. Every text-based check in
this repo was blind to the failure it catches: `innerText` does not cross a
shadow boundary, and the light DOM was identical either way.

`pnpm dev` (`ng serve`) does **not** go through `src/server.ts`: the dev server
renders from memory with its own SSR middleware, so there is no shadow-DOM
injection and no render marker there. Use `pnpm build && pnpm start` for
anything that depends on either.
