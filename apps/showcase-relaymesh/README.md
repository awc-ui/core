# Relaymesh — API observability console

Relaymesh is a dark-themed API observability console for a fictional API-mesh
platform, built on Next.js (App Router) with AWC UI web components. Static
chrome is server-rendered as Declarative Shadow DOM via `@awc-ui/react/server`
(no flash of unstyled content), while interactive surfaces — charts, the
filterable request table and the incident actions — are client islands using
`@awc-ui/react`. The whole console is styled exclusively with MD3 design
tokens (`--md-sys-color-*`, `--md-sys-typescale-*`, spacing and shape tokens)
and runs with `data-theme="dark"` set on `<html>`.

## Screens

| Route | Screen |
|---|---|
| `/` | **Services** — fleet summary tiles plus a grid of `md-card`s, each with an `md-status-dot` health indicator, a 24 h uptime `md-sparkline` and an alert `md-badge` |
| `/latency` | **Latency** — `md-line-chart` latency percentiles (with a deploy mark line) and a stacked `md-area-chart` of regional traffic, both driven by `md-segmented-button` time windows (1H / 6H / 24H / 7D) |
| `/requests` | **Request log** — `md-search` (docked, with a live suggestions panel) filtering an `md-table` whose rows expand via `md-table-expand-toggle` to reveal the captured payload |
| `/incidents` | **Incidents** — an `md-list` timeline with `md-status-dot` severity markers, `md-chip` tags, and acknowledge / escalate actions via `md-split-button` + `md-menu`, confirmed with an `md-snackbar` |

Navigation between screens is a persistent `md-navigation-rail` shell wired to
the Next.js router (`mdTabChange` → `router.push`).

## AWC components exercised

`md-navigation-rail`, `md-navigation-rail-tab`, `md-card`, `md-status-dot`,
`md-sparkline`, `md-badge`, `md-line-chart`, `md-area-chart`,
`md-segmented-button-set`, `md-segmented-button`, `md-table-container`,
`md-table`, `md-table-head`, `md-table-body`, `md-table-row`, `md-table-cell`,
`md-table-expand-toggle`, `md-search`, `md-list`, `md-list-item`, `md-divider`,
`md-chip`, `md-split-button`, `md-menu`, `md-menu-item`, `md-snackbar`.

## Run it

```bash
pnpm --filter @awc-ui/showcase-relaymesh dev
```

Build (SSR gate):

```bash
pnpm --filter @awc-ui/showcase-relaymesh build
```
