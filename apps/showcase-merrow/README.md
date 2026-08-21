# showcase-merrow

Merrow & Co is a fictional SEO-first homewares storefront built with Astro and AWC UI. Every page is prerendered to static HTML with Declarative Shadow DOM injected at build time by the Astro middleware (the same `@awc-ui/core/hydrate` wiring as the `example-astro` reference app), so crawlers and first paint see fully rendered markup; small inline scripts hydrate only the interactive islands — catalog filtering and sorting, the add-to-basket snackbar, and the checkout wizard.

## Screens

- `/` — **Catalog**: breadcrumbs, filter row (`md-chip` category filters + `md-select` sort), and a grid of product `md-card`s with `md-rating`, price, and `md-chip` tags. Filtering and sorting run client-side over the static grid.
- `/products/[slug]` — **Product page** (one static route per product): gallery placeholder built from `md-skeleton`s, rating breakdown with per-star `md-meter`s, `md-number-field` quantity, and an add-to-basket `md-button` that raises an `md-snackbar` with a Checkout action.
- `/checkout` — **Checkout**: vertical linear `md-stepper` (shipping `md-text-field`s with validation gating, payment `md-radio` group, review summary) finishing in an `md-dialog` order confirmation.

## AWC components exercised

`md-breadcrumbs`, `md-breadcrumb-item`, `md-card`, `md-rating`, `md-chip`, `md-select`, `md-select-option`, `md-button`, `md-skeleton`, `md-meter`, `md-number-field`, `md-snackbar`, `md-stepper`, `md-step`, `md-text-field`, `md-radio`, `md-dialog`

## Run it

```bash
pnpm --filter @awc-ui/showcase-merrow dev
```

Build (also the SSR/DSD gate):

```bash
pnpm --filter @awc-ui/showcase-merrow build
```
