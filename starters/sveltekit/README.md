# AWC UI starter — SvelteKit

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/fork/github/awc-ui/core/tree/main/starters/sveltekit)

> The StackBlitz link works once this directory lands on the `main` branch of
> [awc-ui/core](https://github.com/awc-ui/core).

A minimal SvelteKit project using the published `@awc-ui/core` and
`@awc-ui/tokens` packages. It renders a compact mini-dashboard — app bar, two
stat cards, a line chart, a small table, and a dark-mode switch.

## How it's wired

- **Tokens** — `src/routes/+layout.svelte` imports `@awc-ui/tokens/tokens.css`
  so the `--md-sys-*` custom properties are available document-wide.
- **SSR** — `src/hooks.server.ts` post-processes each rendered page chunk with
  `@awc-ui/core/hydrate` (`renderToString`) to inject Declarative Shadow DOM
  for every `<md-*>` element (this also runs at prerender time with
  `@sveltejs/adapter-static`), so the first paint is styled.
- **Client registration** — `+layout.svelte` calls
  `defineCustomElements(window)` from `@awc-ui/core/loader` in `onMount` so
  the server DSD hydrates and becomes interactive.
- **Chart data** — objects and arrays have no attribute form;
  `src/routes/+page.svelte` sets the line chart's `xAxis` / `series` / `yAxis`
  as JS properties in `onMount` via `bind:this`.
- **Dark mode** — the app-bar switch's `on:mdChange` sets `data-theme="dark"`
  on `<html>`, which swaps the token palette.

## Run it

```sh
npm install
npm run dev       # http://localhost:5173
npm run build
npm run preview
```
