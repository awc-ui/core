# Lumen Bank — AWC UI showcase (Next.js)

Lumen Bank is a fictional mobile-first retail banking app built with AWC UI's
Material Design 3 web components, server-rendered in Next.js (App Router) via
the `@awc-ui/react/server` SSR wrappers with Declarative Shadow DOM. Every
screen is styled exclusively with MD3 tokens (`--md-sys-color-*`,
`--md-sys-typescale-*`, spacing, shape and z-index tokens) in plain CSS, and
the shell pairs a sticky `md-app-bar` with a bottom-docked `md-navigation-bar`
wired to the Next.js router.

## Screens

- `/` — **Accounts overview**: balance `md-card`s with `md-sparkline` trends,
  an `md-pie-chart` spending donut, and recent activity in an `md-list`.
- `/transactions` — **Transactions**: `md-search` (docked, with merchant
  suggestions), `md-chip` category filters, and an `md-table` with expandable
  rows (`md-table-expand-toggle` + `slot="expanded"` details).
- `/transfer` — **Transfer**: a linear vertical `md-stepper` — recipient
  (`md-select`, filterable), amount (`md-number-field`, USD currency format),
  confirmation with `md-otp-field`, and an `md-snackbar` on success.
- `/budgets` — **Budgets**: an `md-meter` per category with semantic status
  colors, edited through an `md-slider` inside an `md-bottom-sheet`, with an
  `md-snackbar` confirmation.

## AWC components exercised

`md-app-bar`, `md-navigation-bar`, `md-navigation-tab`, `md-icon-button`,
`md-card`, `md-sparkline`, `md-pie-chart`, `md-list`, `md-list-item`,
`md-divider`, `md-search`, `md-chip`, `md-table`, `md-table-container`,
`md-table-head`, `md-table-body`, `md-table-row`, `md-table-cell`,
`md-table-expand-toggle`, `md-stepper`, `md-step`, `md-select`,
`md-select-option`, `md-number-field`, `md-otp-field`, `md-snackbar`,
`md-meter`, `md-slider`, `md-bottom-sheet`, `md-button`.

## Run it

```bash
pnpm --filter @awc-ui/showcase-lumen dev
```

Build (SSR gate):

```bash
pnpm --filter @awc-ui/showcase-lumen build
```
