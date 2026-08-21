# AWC UI starter — Astro

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/fork/github/awc-ui/core/tree/main/starters/astro)

> The StackBlitz link works once this directory lands on the `main` branch of
> [awc-ui/core](https://github.com/awc-ui/core).

A minimal Astro project using the published `@awc-ui/core` and `@awc-ui/tokens`
packages. It renders a compact mini-dashboard — app bar, two stat cards, a line
chart, a small table, and a dark-mode switch.

## How it's wired

- **Tokens** — `src/pages/index.astro` imports `@awc-ui/tokens/tokens.css` so
  the `--md-sys-*` custom properties are available document-wide.
- **SSR / SSG** — `src/middleware.ts` post-processes every rendered page with
  `@awc-ui/core/hydrate` (`renderToString`) to inject Declarative Shadow DOM
  for each `<md-*>` element at build time, so the first paint is styled.
- **Client registration** — the inline `<script>` in `index.astro` calls
  `defineCustomElements(window)` from `@awc-ui/core/loader` so the build-time
  DSD hydrates and becomes interactive.
- **Chart data** — objects and arrays have no attribute form; the line chart's
  `xAxis` / `series` / `yAxis` are set as JS properties in the same script.
- **Dark mode** — the app-bar switch sets `data-theme="dark"` on `<html>`,
  which swaps the token palette.

## Run it

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # static build with DSD baked in
npm run preview
```
