# Fieldstone Ops (showcase-fieldstone)

Fieldstone Ops is a fictional logistics admin console built with Next.js (App Router) and
the AWC UI Material Design 3 web components. It manages the people side of a five-depot
delivery network: a hand-authored data table of console users with search, sorting,
pagination, bulk selection and expandable detail rows; a role editor that moves
capabilities between pools with a confirm step; an organization chart with a profile side
sheet; and a filterable audit trail. The shell is a sticky app bar plus a navigation rail
with badge counts, and every screen is styled exclusively with MD3 system tokens in plain
CSS.

## Screens

| Route | Screen |
|---|---|
| `/` | **Users** — `md-table` with sorting, pagination, expandable rows, multi-select checkboxes, a toolbar with docked `md-search` and an `md-split-button` export menu, per-row `md-status-dot` presence and `md-chip` role tags |
| `/roles` | **Roles & permissions** — `md-select` role picker, `md-transfer-list` capability editor, confirm `md-dialog` before applying |
| `/directory` | **Org directory** — `md-organization-chart` with an `md-side-sheet` profile that opens on select |
| `/audit` | **Audit log** — `md-table` filtered by an `md-date-picker` range and `md-segmented-button` severity toggles |

## AWC components exercised

`md-app-bar`, `md-navigation-rail`, `md-navigation-rail-tab`, `md-badge`,
`md-icon-button`, `md-table`, `md-table-container`, `md-table-head`, `md-table-body`,
`md-table-row`, `md-table-cell`, `md-table-sort-label`, `md-table-expand-toggle`,
`md-table-toolbar`, `md-table-pagination`, `md-search`, `md-checkbox`,
`md-split-button`, `md-menu`, `md-menu-item`, `md-status-dot`, `md-chip`, `md-avatar`,
`md-button`, `md-select`, `md-select-option`, `md-transfer-list`, `md-dialog`,
`md-organization-chart`, `md-side-sheet`, `md-date-picker`, `md-segmented-button`,
`md-segmented-button-set`.

## Run it

```bash
pnpm --filter @awc-ui/showcase-fieldstone dev
```

Build (SSR gate):

```bash
pnpm --filter @awc-ui/showcase-fieldstone build
```
