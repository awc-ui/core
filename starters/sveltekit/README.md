# AWC UI starter — SvelteKit

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/fork/github/awc-ui/core/tree/main/starters/sveltekit)

A standalone Svelte 4 dashboard using the published AWC UI packages. Use Node.js
20.19 or later. Source changes that add package APIs require the matching package
release; the repository's packed-candidate checks verify them before publication.

## How it works

- `src/hooks.server.ts` creates a separate HTML buffer for each request and calls
  `renderToString` once the final chunk arrives. This preserves a complete document
  and emits Declarative Shadow DOM during prerendering. Buffering delays streamed HTML.
- `src/hooks.client.ts` uses SvelteKit 2.10+ `init` to capture Stencil's SSR host attributes before Svelte
  hydrates. The root layout restores removed attributes before importing the
  component entries. Svelte 4 otherwise removes the `s-id` adoption markers,
  causing the component runtime to append a second shadow render.
- `src/lib/awc.ts` shares `createSvelteHydration()` from
  `@awc-ui/core/ssr/sveltekit` between the two lifecycle hooks.
- `src/lib/components.ts` imports the used SSR-capable component entries. Vite
  bundles their dependencies, so registration does not depend on lazy-loader URLs.
  Add new component imports there when extending the page.
- The root layout imports global tokens. The page waits for chart registration
  before assigning object-valued data. Canvas chart plots appear after JavaScript
  runs; SSR provides their surrounding structure.
- The app-bar switch changes `data-theme` on `<html>`.

## Run it

```sh
npm install
npm run dev       # http://localhost:5173
npm run build
npm run preview
```

The static adapter prerenders this dashboard with DSD. See the
[starter verification instructions](../README.md#verify-consumer-installations)
for isolated install, production build, and browser checks.
