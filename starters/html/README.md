# AWC UI starter — plain HTML (no build step)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/fork/github/awc-ui/core/tree/main/starters/html)

> The StackBlitz link works once this directory lands on the `main` branch of
> [awc-ui/core](https://github.com/awc-ui/core).

A single `index.html` — no bundler, no framework. It renders the same compact
mini-dashboard as the other starters: app bar, two stat cards, a line chart, a
small table, and a dark-mode switch.

## How it's wired (CDN)

- **Components** — the browser-ready `@awc-ui/core` entry loads directly from
  **jsDelivr**:
  `https://cdn.jsdelivr.net/npm/@awc-ui/core@1.0.0-beta.9/dist/md3/md3.esm.js`.
  Its module script registers every `md-*` element and lazy-loads sibling
  chunks from the same package directory. No import rewriting is required.
- **Core CSS** — the document head loads tokens and the unfinished-component
  guard before the module script, using the same Core version:
  `https://cdn.jsdelivr.net/npm/@awc-ui/core@1.0.0-beta.9/dist/md3/md3.css`.
- **Chart data** — objects and arrays have no attribute form; the second
  module script sets the line chart's `xAxis` / `series` / `yAxis` as JS
  properties.
- **Dark mode** — the app-bar switch sets `data-theme="dark"` on `<html>`,
  which swaps the token palette.
- There is **no SSR / Declarative Shadow DOM** here. Components stay hidden
  until their first render adds `.hydrated`; registration alone is not enough.
  This prevents raw content flashing but does not reserve final dimensions.
  Use one of the framework starters for rendered structure on first paint.

The `package.json` lists `@awc-ui/core` and `@awc-ui/tokens` only for
reference/version pinning — the page itself never reads `node_modules`.

## Run it

```sh
npm start          # serves the folder at http://localhost:3000
```

or open `index.html` through any static file server.
