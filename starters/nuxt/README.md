# AWC UI starter — Nuxt 3

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/fork/github/awc-ui/core/tree/main/starters/nuxt)

> The StackBlitz link works once this directory lands on the `main` branch of
> [awc-ui/core](https://github.com/awc-ui/core).

A minimal Nuxt 3 project using the published `@awc-ui/core` and
`@awc-ui/tokens` packages. It renders a compact mini-dashboard — app bar, two
stat cards, a line chart, a small table, and a dark-mode switch.

## How it's wired

- **Tokens** — `nuxt.config.ts` lists `@awc-ui/tokens/tokens.css` in `css` so
  the `--md-sys-*` custom properties are available document-wide.
- **Custom elements** — `vue.compilerOptions.isCustomElement` accepts every
  `md-*` tag on both the server and client compilers.
- **SSR** — `server/plugins/awc-ssr-dsd.ts` is a Nitro plugin that
  post-processes the rendered body with `@awc-ui/core/hydrate`
  (`renderToString`) to inject Declarative Shadow DOM for every `<md-*>`
  element, so the first paint is styled. The hydrate module is kept external
  to the Nitro build (`nitro.externals`).
- **Client registration** — `plugins/awc.client.ts` calls
  `defineCustomElements(window)` from `@awc-ui/core/loader` so the server DSD
  hydrates and becomes interactive.
- **Chart data** — objects and arrays have no attribute form; `app.vue` sets
  the line chart's `xAxis` / `series` / `yAxis` as JS properties in
  `onMounted` via a template ref.
- **Dark mode** — the app-bar switch sets `data-theme="dark"` on `<html>`,
  which swaps the token palette.

## Run it

```sh
npm install
npm run dev       # http://localhost:3000
npm run build
npm run preview
```
