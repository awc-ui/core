# Copperplate — showcase-copperplate

Copperplate is a touch-first restaurant point-of-sale for a fictional bistro, built as a single
`index.html` with no build step: AWC UI is loaded exactly like the repository README quick start
(the tokens stylesheet and the `@awc-ui/core/loader` module via relative `node_modules` paths).
Servers ring up menu items from a card grid — picking a modifier and quantity per line — watch the
running order accumulate with per-line quantity badges and remove buttons, tender the sale from a
payment dialog, and review the day in an end-of-day section with a sales table and a category-mix
donut chart. Every tap target is at least 48px and all styling uses MD3 tokens in plain CSS.

## Screens (in-page sections, switched by the bottom navigation bar)

- **Register** — menu `md-card` grid with `md-button-group` modifiers and `md-number-field`
  quantities; running order `md-list` with `md-badge` quantity counts and remove
  `md-icon-button`s; live subtotal / tax / total and a Charge action.
- **Tender dialog** — `md-dialog` with an `md-segmented-button-set` payment-type picker
  (Card / Cash / Gift card) and a completion snackbar.
- **End of day** — KPI cards, a sales `md-table` (sticky header and totals footer) inside an
  `md-table-container`, and an `md-pie-chart` donut of the sales mix by category. Completed
  sales at this register update the figures live.

## AWC components exercised

`md-app-bar`, `md-badge`, `md-button`, `md-button-group`, `md-card`, `md-dialog`, `md-divider`,
`md-icon-button`, `md-list`, `md-list-item`, `md-navigation-bar`, `md-navigation-tab`,
`md-number-field`, `md-pie-chart`, `md-segmented-button`, `md-segmented-button-set`,
`md-snackbar`, `md-table`, `md-table-body`, `md-table-cell`, `md-table-container`,
`md-table-foot`, `md-table-head`, `md-table-row`.

## Run it

```bash
pnpm --filter @awc-ui/showcase-copperplate dev
```

Then open <http://localhost:4180>. There is no build step — the page is static HTML served with
`python3 -m http.server`.
