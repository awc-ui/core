# AWC UI starter — Next.js (App Router)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/fork/github/awc-ui/core/tree/main/starters/next)

> The StackBlitz link works once this directory lands on the `main` branch of
> [awc-ui/core](https://github.com/awc-ui/core).

A minimal Next.js App Router project using the published `@awc-ui/react`,
`@awc-ui/core` and `@awc-ui/tokens` packages. It renders a compact
mini-dashboard — app bar, two stat cards, a line chart, a small table, and a
dark-mode switch.

## How it's wired

- **Tokens** — `app/layout.tsx` imports `@awc-ui/tokens/tokens.css` so the
  `--md-sys-*` custom properties are available document-wide.
- **SSR** — the static components in `app/page.tsx` (a Server Component) come
  from `@awc-ui/react/server`, which server-renders each component's
  Declarative Shadow DOM via `@awc-ui/core/hydrate` and hydrates on the client,
  so the first paint is styled with no flash.
- **Client components** — `app/theme-switch.tsx` and `app/sessions-chart.tsx`
  use the client wrappers from `@awc-ui/react`: the switch needs the
  `onMdChange` event, and the chart's `xAxis` / `series` / `yAxis` are objects
  set as JS properties (no attribute form).
- **`next.config.mjs`** — `transpilePackages: ['@awc-ui/react', '@awc-ui/core']`
  lets Next process the ESM wrappers and their `'use client'` directives.
- **Dark mode** — the app-bar switch sets `data-theme="dark"` on `<html>`,
  which swaps the token palette.

## Run it

```sh
npm install
npm run dev       # http://localhost:3000
npm run build
npm start
```
