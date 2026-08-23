# Showcase applications

Whole applications built from AWC UI, one directory per vertical and one build
per framework underneath: `apps/showcase/<vertical>/<framework>`.

Today there is one vertical — **credit-risk**, the Aurelia Bank Credit Risk
Console — in six framework builds.

| Build | Toolchain | Output | Renders | Language lives |
|---|---|---|---|---|
| `html` | none (a Node generator + esbuild for one client bundle) | `dist/` | Static files | In the URL |
| `astro` | Astro | `dist/` | Server-rendered into declarative shadow DOM | In the URL |
| `react` | Next.js (static export) | `out/` | Prerendered, hydrates | Client state |
| `vue` | Nuxt (`nuxi generate`) | `.output/public/` | Prerendered, hydrates | Client state |
| `angular` | Angular (prerender) | `dist/browser/` | Prerendered, hydrates | Client state |
| `svelte` | SvelteKit (`adapter-static`) | `build/` | Prerendered, hydrates | Client state |

## The rule that makes six builds worth having

**Nothing that is not a view lives in an app.** Every number, date, translated
string, derived series, status colour and table column layout comes from
[`@awc-ui/showcase-kit`](../../packages/showcase-kit). The apps decide how to
lay things out and nothing else.

That is what makes the six comparable: a screenshot of the React build and a
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
reasonable local decision, and together they meant the six were not the same
application at all.

The two server-rendered builds meet that bar by parking what is off screen in
`<template>` elements, whose contents the parser keeps out of the document tree.
Hiding rows would NOT pass — a hidden row is still in `querySelectorAll` and
still in the accessibility tree, and "the same" has to mean the same elements.

Each build's README documents the two or three things its framework made
genuinely different — and they are more interesting than they sound:

- **React** — why the components are not bundled, and why every screen is a
  client component.
- **Vue** — why `@mdSortChange` silently does not work, and what to write
  instead.
- **Angular** — why every string prop must be an `[attr.…]` binding, or the
  prerender emits empty tags.
- **Svelte** — why row identity has to be read as a property, not an attribute.
- **HTML** — what a build looks like with no framework at all, and which four
  behaviours are worth a client script.
- **Astro** — what declarative shadow DOM buys, and precisely what it does not
  (the charts).

## Working on them

```bash
pnpm --filter @awc-ui/core build      # every build copies the runtime out of dist/

pnpm showcase:build                   # all six, staged into apps/docs/public/showcase/
pnpm showcase:build svelte vue        # just these two
pnpm showcase:lint                    # type-check every build
pnpm showcase:verify                  # drive each one in a real browser
pnpm verify:showcase-parity           # diff all six against React, screen by screen
pnpm verify:showcase-a11y             # the a11y regressions, across all six

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
