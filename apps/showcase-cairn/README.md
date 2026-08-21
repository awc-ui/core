# Cairn — lightweight project tracker (AWC UI showcase, SvelteKit)

Cairn is a fictional lightweight project tracker used by Fernline Software's team to run the "Alpenglow 2.4" release cycle. It is a SvelteKit app rendered on the server with Declarative Shadow DOM (via the `@awc-ui/core/hydrate` server hook) and hydrated on the client with `@awc-ui/core/loader`, styled exclusively with MD3 design tokens.

## Screens

- **Tasks** (`/`) — board/list toggle via `md-segmented-button-set`. The list view is an `md-table` with `md-chip` status/priority columns and `md-avatar` assignees; the board view is four status columns of interactive `md-card`s. Clicking a task (row or card) opens a modal `md-side-sheet` with `md-tabs` (Details / Checklist / Activity).
- **Sprint** (`/sprint`) — burndown `md-bar-chart` (Remaining vs Ideal story points per day) and per-goal `md-progress-indicator`s, plus a circular sprint-completion indicator.
- **Everywhere** — a quick-create `md-fab` + `md-fab-menu` (Task / Milestone / Note) fixed bottom-end on all screens, with `md-snackbar` confirmations.

## AWC components exercised

`md-segmented-button-set` · `md-segmented-button` · `md-table-container` · `md-table` · `md-table-head` · `md-table-body` · `md-table-row` · `md-table-cell` · `md-chip` · `md-avatar` · `md-card` · `md-side-sheet` · `md-tabs` · `md-tab` · `md-tab-panels` · `md-tab-panel` · `md-list` · `md-list-item` · `md-divider` · `md-bar-chart` · `md-progress-indicator` · `md-fab` · `md-fab-menu` · `md-fab-menu-item` · `md-snackbar` · `md-button`

## Run it

```bash
pnpm --filter @awc-ui/showcase-cairn dev
```

Build (SSR/prerender gate):

```bash
pnpm --filter @awc-ui/showcase-cairn build
```
