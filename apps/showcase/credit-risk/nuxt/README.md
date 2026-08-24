# Aurelia Bank — Credit Risk Console (Nuxt)

The Nuxt build of the `credit-risk` showcase vertical, and one of its two
server-rendered ones. Every framework build renders the same six screens from
the same fixture; this one renders them **on a Node server, per request**, with
the components' shadow DOM already in the response, and is served at
`awc-ui.dev/showcase/credit-risk/nuxt/`.

```bash
pnpm --filter @awc-ui/showcase-credit-risk-nuxt build    # -> .output/
pnpm --filter @awc-ui/showcase-credit-risk-nuxt start    # a real server on :4611
pnpm --filter @awc-ui/showcase-credit-risk-nuxt verify   # 16 checks in a real browser
node scripts/verify-ssr.mjs nuxt                         # from the repo root
```

`build` runs `sync-runtime` first, which needs `packages/core/dist` to exist
(`pnpm --filter @awc-ui/core build`). `start` honours `$PORT` and falls back to
4611, the port the repo-root SSR harness expects.

## Screens

| Route | Screen |
|---|---|
| `/` | Portfolio overview — KPI tiles with sparklines, sector bars, rating distribution, exposure trend by rating band, the counterparty book |
| `/sectors/[sector]/` | Concentration and utilisation meters, sector EL/RWA trend, the sector's counterparties (7 pages) |
| `/counterparties/[id]/` | Obligor header, then tabs for facilities, rating history and group structure (24 pages) |
| `/facilities/[id]/` | Terms, covenant headroom meters, collateral net of haircuts, balance schedule to maturity (61 pages) |
| `/watchlist/` | Early-warning signals, filtered by severity and sector |
| `/stress/` | Baseline / adverse / severe, EL and RWA comparison charts, per-sector impact |

95 routes, none of them prerendered. There is no route list anywhere in this
app any more: Nuxt's file-based router matches the dynamic segments and the
fixture supplies the ids at render time.

## What makes this a real SSR build

The showcase used to claim SSR for six builds that were all statically
generated, so the claim is now made in a form that can be checked. Two separate
questions, and `scripts/verify-ssr.mjs` at the repo root asks both:

**1. The markup arrives without a browser.** Fetched with `fetch`, which runs no
JavaScript, the response body already contains `<template shadowrootmode="open">`
for every `md-*` element. `server/plugins/awc-ssr-dsd.ts` runs the rendered body
through `@awc-ui/core/hydrate` on Nitro's `render:html` hook — the same eight
lines as `starters/nuxt`, `apps/example-nuxt` and the Astro build's middleware,
hung off each framework's own response seam.

**2. It was rendered for this request.** The fixture is frozen at
`REPORTING_DATE` with no clock and no randomness, which is what made a prerender
and a live render byte-identical — good for parity, useless as evidence. So each
render stamps

```html
<meta name="awc-render-mode" content="ssr">
<meta name="awc-rendered-at" content="2026-08-24T…Z">
```

into `<head>`, read at render time, and the harness fetches a page twice a
second apart and fails the build if the two markers agree. `cache-control:
no-store` goes on every rendered document so nothing downstream can turn the
second request back into the first.

**The charts are the honest exception.** They draw into a `<canvas>`, and a
canvas cannot be painted without a canvas context. What server-renders for a
chart is its frame — heading, subtitle, legend, accessible name and the
data-table description a screen reader reads — with the plot appearing when the
runtime draws it. With JavaScript off this is a complete, readable credit report
with blank chart panels, not a finished dashboard.

## The decisions worth knowing

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

**Server-rendering the components breaks Vue hydration, and the fix is two
lines.** This is the one finding here that is not in the Next build, because it
is Vue-specific, and it is worth reading before porting this to SvelteKit or
Angular. Stencil annotates what it server-renders so its own runtime can adopt
it later: `s-id`/`c-id` attributes, `<!--r.N-->` marker comments, and — always,
even with annotations off — an empty `<!---->` "content reference" comment
inserted as each host's first child. Those land in the **light DOM**, which
belongs to Vue. React's hydration walker skips comment nodes; Vue's does not. So
every component on the page mismatched, Vue tore each one's children down and
rebuilt them, and it logged `Hydration completed but contains mismatches.` in
production. Everything still *looked* right, which is why `pnpm verify` asserts
on the console rather than on appearance. The fix, both in
`server/plugins/awc-ssr-dsd.ts`: `clientHydrateAnnotations: false`, and a small
pass that removes the content-reference comment where a top-level shadow root
has just closed. Neither costs anything — Stencil's runtime re-creates the
content reference itself when it connects an element with no `s-id`.

**The language still changes in place.** Server rendering did not take that
away. The dock's locale is client state — a query parameter and localStorage,
neither of which the server can read — so the document is rendered in `en`/`ltr`
on both sides of hydration, and `composables/useShowcase.ts` re-renders every
string through `t` the moment the dock publishes. No navigation, no reload.

**The components are not bundled.** Stencil's lazy runtime is copied into
`public/awc-runtime/` by `scripts/sync-runtime.mjs` and loaded from a static
absolute URL by a module script that `server/plugins/preboot.ts` unshifts into
`<head>` — a Nitro hook rather than `app.head`, because only the hook can
promise a position relative to Nuxt's own tags, and the preboot IIFE has to come
first. Putting the runtime through Vite makes it resolve its entry chunks under
`_nuxt/`, where the build never wrote them, and every element renders at zero
height. The full post-mortem is in that script. It still matters on a
server-rendered build: the runtime is what makes the components INTERACTIVE, and
it adopts the server's shadow roots rather than rebuilding them.

**`/` redirects to the mount.** `app.baseURL` means Nitro answers 404 at the
bare root — right in production, where seven builds share a host, and useless
when you start the server and open the port it printed.
`server/plugins/front-door.ts` redirects `/` and the slashless mount, and
nothing else. It hangs off the `request` hook because that is the only seam that
sees the path before the base is stripped: server middleware is itself mounted
under the base, and route rules are matched with the base already removed, which
would make `/` and `/showcase/credit-risk/nuxt/` the same rule and any redirect
on it a loop.

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

`pnpm verify` starts `server.mjs` — the same server `pnpm start` runs, on a port
of its own — and drives a real browser: the server's HTML carries real rows,
real numbers and real shadow roots with JavaScript disabled, every component
upgrades, every chart paints, the dock's language picker re-renders every string
without reloading the document, and sorting, paging and drill links all work.
`node scripts/verify-ssr.mjs nuxt` from the repo root asks the other question —
whether that HTML was made for the request.

Row identity is read as a **property**, not an attribute: Vue sets data on an
upgraded custom element through its property when one exists, so a row that came
from the server carries `value="cp-01"` in the markup while a row created after
a sort may carry only the property. Both reach the component identically — an
attribute-only assertion would report a working table as broken.
