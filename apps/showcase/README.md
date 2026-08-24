# Showcase applications

Whole applications built from AWC UI, one directory per vertical and one build
per framework underneath: `apps/showcase/<vertical>/<framework>`.

Today there is one vertical — **credit-risk**, the Aurelia Bank Credit Risk
Console — in ten builds.

They come in PAIRS. Each of the four component frameworks appears twice: once as
a single-page application, where the server sends an empty shell and the browser
renders everything, and once server-rendered per request, where the HTML arrives
complete with the components already inside declarative shadow DOM. Within a
pair the only source that differs is a handful of routing call sites, so the
difference between two neighbours is the rendering strategy and cannot be
anything else.

| Build | Toolchain | Output | Renders | Language lives |
|---|---|---|---|---|
| `html` | none (a Node generator + esbuild for one client bundle) | `dist/` | Static files | In the URL |
| `astro` | Astro | `dist/` | Into declarative shadow DOM, once, at build time | In the URL |
| `react` | Vite + React, hand-rolled router | `dist/` | SPA — empty shell, browser renders | Client state |
| `next` | Next.js App Router | `.next/` (server) | **Per request**, into declarative shadow DOM | Client state |
| `vue` | Vite + Vue 3, hand-rolled router | `dist/` | SPA — empty shell, browser renders | Client state |
| `nuxt` | Nuxt, Nitro `node-server` | `.output/` (server) | **Per request**, into declarative shadow DOM | Client state |
| `angular` | Angular browser builder | `dist/browser/` | SPA — empty shell, browser renders | Client state |
| `angular-ssr` | `@angular/ssr` + express | `dist/` (server) | **Per request**, into declarative shadow DOM | Client state |
| `svelte` | Vite + Svelte, hand-rolled router | `dist/` | SPA — empty shell, browser renders | Client state |
| `sveltekit` | SvelteKit, `adapter-node` | `build/` (server) | **Per request**, into declarative shadow DOM | Client state |

The four marked *(server)* produce no servable directory — the output is the
input to a Node process. They are deployed as their own sites and reverse-proxied
onto their path; `scripts/build-showcase.mjs` compiles them but stages nothing,
and `apps/docs/netlify.toml` carries the proxy. The other six are copied into
`apps/docs/public/showcase/`.

## The rule that makes the builds worth having

**Nothing that is not a view lives in an app.** Every number, date, translated
string, derived series, status colour and table column layout comes from
[`@awc-ui/showcase-kit`](../../packages/showcase-kit). The apps decide how to
lay things out and nothing else.

That is what makes them comparable: a screenshot of the React build and a
screenshot of the Svelte build differ only where the *framework* differs, never
because two ports computed a quarterly aggregate slightly differently. If you
find yourself writing arithmetic, a dictionary lookup or a column template
inside an app, it belongs in the kit instead.

**And the same rule applies to the rendered document.** React is the reference,
and `pnpm verify:showcase-parity` diffs every other build against it on every
screen — the visible text, the census of `md-*` elements, the live row count,
whether a pagination control exists. A build that renders the whole book where
React renders a page of ten, or three stress scenarios where React renders one,
fails. It is worth being strict about: those divergences each looked like a
reasonable local decision, and together they meant the builds were not the same
application at all.

The two build-time-rendered builds meet that bar by parking what is off screen in
`<template>` elements, whose contents the parser keeps out of the document tree.
Hiding rows would NOT pass — a hidden row is still in `querySelectorAll` and
still in the accessibility tree, and "the same" has to mean the same elements.

Each build's README documents the two or three things its framework made
genuinely different — and they are more interesting than they sound:

- **HTML** — what a build looks like with no framework at all, and which four
  behaviours are worth a client script.
- **Astro** — what declarative shadow DOM buys, and precisely what it does not
  (the charts).
- **React** — why the components are not bundled, and why a 60-line router is
  enough for six screens.
- **Next.js** — why `.next/` cannot be staged like the others, and how the
  per-request render is proved rather than asserted.
- **Vue** — why `@mdSortChange` silently does not work, and what to write
  instead.
- **Nuxt** — the Stencil comment markers Vue's hydration walker trips over, and
  why stripping them is safe.
- **Angular** — why every string prop must be an `[attr.…]` binding, or the
  render emits empty tags.
- **Angular (SSR)** — why `provideClientHydration()` is the difference between
  adopting the server's shadow DOM and quietly rebuilding it.
- **Svelte** — why row identity has to be read as a property, not an attribute.
- **SvelteKit** — why `claim_element` strips the attributes a server-rendered
  component arrived with, and what that costs if you let it.

The four SSR builds share one mechanism worth knowing before reading any of
them: each hands its rendered HTML to the same framework-agnostic
`renderToString` from `@awc-ui/core/hydrate`. The components neither know nor
care which framework produced the page — which is the claim the pairs exist to
demonstrate.

## Working on them

```bash
pnpm --filter @awc-ui/core build      # every build copies the runtime out of dist/

pnpm showcase:build                   # every build; the static six staged into apps/docs/public/showcase/
pnpm showcase:build svelte vue        # just these two
pnpm showcase:preview                 # all ten behind ONE origin, with the four servers running
pnpm showcase:lint                    # type-check every build
pnpm showcase:verify                  # drive each one in a real browser
pnpm verify:showcase-parity           # diff the static builds against React, screen by screen
pnpm verify:showcase-a11y             # the a11y regressions, across the static builds
pnpm verify:ssr                       # the four servers really render per request
pnpm verify:ssr-adoption              # and the browser KEEPS that render rather than redoing it

pnpm dev:showcase-react               # one build, in watch mode
```

Every build is compiled against an absolute base path of
`/showcase/credit-risk/<framework>/`, so its output only works when served at
exactly that path. Each app therefore ships a `serve` script that mounts its own
output there — `vite preview`, `nuxi preview` and `ng serve` all serve at `/`
and will 404 on every asset.

`scripts/build-showcase.mjs` builds each one and stages it into
`apps/docs/public/showcase/`, which is where the docs site picks it up.
`scripts/build-docs.sh` calls it, so a deployed site and a local
`bash scripts/build-docs.sh` produce the same thing.

## Adding a framework

1. Add `apps/showcase/<vertical>/<framework>/` — the workspace glob
   `apps/showcase/*/*` picks it up with no further registration.
2. `createRoutes('<framework>')` from the kit, once, and derive the app's base
   path from it rather than writing the literal twice.
3. Add the id to `FRAMEWORKS` in `packages/showcase-kit/src/credit-risk/routes.ts`
   so the dock offers it.
4. Add an entry to `BUILDS` in `scripts/build-showcase.mjs` with the directory
   that toolchain writes to.
5. Add its `index.html` to the loop in `.github/workflows/deploy.yml`, so a
   build that silently stops emitting fails the deploy instead of shipping a
   404 behind a link that promises otherwise.
