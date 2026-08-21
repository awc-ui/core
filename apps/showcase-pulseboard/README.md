# Pulseboard — showcase (SvelteKit)

Pulseboard is a fictional product-analytics SaaS: the demo shows the "Driftline" workspace of Harborlight Labs, a made-up collaboration app whose usage, funnel and event data is tracked across three screens. The app is a SvelteKit static build with the same SSR wiring as `example-sveltekit`: `@awc-ui/core/hydrate` injects Declarative Shadow DOM in `hooks.server.ts` at prerender time, and the client registers the custom elements via `@awc-ui/core/loader` on mount. All styling is plain CSS on MD3 tokens (`--md-sys-color-*`, `--md-sys-typescale-*`).

## Screens

- `/` **Overview** — four KPI cards with inline `md-sparkline` trends, a stacked `md-area-chart` of daily active users by platform, and a horizontal `md-bar-chart` of feature adoption by plan.
- `/funnels` **Funnels** — an `md-segmented-button-set` period switcher (7/30/90 days) that drives a cohort-retention `md-line-chart` and per-step conversion `md-meter`s.
- `/events` **Events** — an `md-table` (sticky header, striped, skeleton loading mode) with sparkline trend cells, an `md-search` docked bar with live suggestions, `md-chip` category filters, and an `md-skeleton` summary placeholder during the simulated fetch.

The shell is a full-height `md-navigation-rail` (logo, three destinations with `href` routing, footer) plus a per-screen `md-app-bar`.

## AWC components exercised

`md-navigation-rail`, `md-navigation-rail-tab`, `md-app-bar`, `md-icon-button`, `md-card`, `md-sparkline`, `md-area-chart`, `md-bar-chart`, `md-line-chart`, `md-segmented-button-set`, `md-segmented-button`, `md-meter`, `md-table` (with `md-table-container`, `md-table-head`, `md-table-body`, `md-table-row`, `md-table-cell`), `md-skeleton`, `md-search`, `md-chip`.

## Run it

```bash
pnpm --filter @awc-ui/showcase-pulseboard dev
# production build (SSR/DSD gate)
pnpm --filter @awc-ui/showcase-pulseboard build
```
