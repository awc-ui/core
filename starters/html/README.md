# AWC UI starter — plain HTML (no build step)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/fork/github/awc-ui/core/tree/main/starters/html)

> The StackBlitz link works once this directory lands on the `main` branch of
> [awc-ui/core](https://github.com/awc-ui/core).

A single `index.html` — no bundler, no framework. It renders the same compact
mini-dashboard as the other starters: app bar, two stat cards, a line chart, a
small table, and a dark-mode switch.

## How it's wired (CDN)

- **Components** — `@awc-ui/core` is loaded from **esm.sh**, which resolves the
  package's `./loader` export as ES modules:
  `https://esm.sh/@awc-ui/core@1.0.0-beta.4/loader` →
  `defineCustomElements(window)` registers every `md-*` element (they
  lazy-load on first use). jsDelivr works too if you prefer it
  (`https://cdn.jsdelivr.net/npm/@awc-ui/core@1.0.0-beta.4/loader/index.mjs`),
  but esm.sh rewrites bare-specifier imports for you, so it is the simplest
  no-tooling option.
- **Tokens CSS** — `@awc-ui/tokens` is loaded from **jsDelivr** by its real
  file path inside the package:
  `https://cdn.jsdelivr.net/npm/@awc-ui/tokens@1.0.0-beta.4/src/tokens.css`.
- **Chart data** — objects and arrays have no attribute form; the second
  module script sets the line chart's `xAxis` / `series` / `yAxis` as JS
  properties.
- **Dark mode** — the app-bar switch sets `data-theme="dark"` on `<html>`,
  which swaps the token palette.
- Because everything comes from the CDN there is **no SSR / Declarative Shadow
  DOM** here — components render after the loader registers them. Use one of
  the framework starters if you need a styled first paint.

The `package.json` lists `@awc-ui/core` and `@awc-ui/tokens` only for
reference/version pinning — the page itself never reads `node_modules`.

## Run it

```sh
npm start          # serves the folder at http://localhost:3000
```

or open `index.html` through any static file server.
