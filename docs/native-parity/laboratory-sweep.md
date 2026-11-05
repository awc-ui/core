# Laboratory live-preview sweep and inspection schema

Date: 2026-10-27. Evidence: `outputs/native-parity/schema-lab/` (`checkpoint.json`, `sweep-1.json`, run logs).
Installer: `work/schema-lab/schema-patch.py` (anchored, idempotent edits).

## Inspection schema fix (md-card, md-list)

The Laboratory validates every live frame's inspection against `native-inspection.mjs` (`validateMetrics`). In that
schema, `gap` is a `{row, column}` record and `padding`/`margin`/`border` have four edges. The SwiftUI renderers of
md-card and md-list did not follow it, so the server rejected every SwiftUI live frame for them with
`502 INVALID_LIVE_FRAME`:

- md-card reported `gap` as a number.
- md-list reported a two-edge `padding` and a numeric `gap`.
- The md-list row reported a numeric `gap`.

Their own live-host scripts talk to the renderer directly, and the Studio tests use synthetic frames, so neither
caught it. md-chip had the same defect; it was fixed in the selection-controls Laboratory pass
([selection-laboratory.md](selection-laboratory.md)).

The metrics now conform:

| Renderer | `gap` | `padding` | Old value kept as |
| --- | --- | --- | --- |
| md-card | `{row: gap, column: 0}` (row gap) | four edges, unchanged | `contentGap` |
| md-list | `{row: segmented gap or 0, column: 0}` (row gap) | `[block, inline, block, inline]` | `contentGap`; `paddingBlockInline` = `[block, inline]` |
| md-list row | `{row: 0, column: gap}` (column gap) | four edges, unchanged | `contentGap` |

The readers were updated: the card and list paint fixtures, `test-live-card.mjs` and `test-live-list.mjs` (which now
also assert the schema shape).

| Check (job 760) | Result |
| --- | --- |
| Card paint / states / lifecycle | 6,912/6,912; 168,277/168,277; 32/32 |
| List paint / states (-O) / methods / truncation tooltips | 29,418/29,418; 112,930/112,930; 28/28; 8/8 |
| Live hosts | `test-live-card`, `test-live-list` and `test-live-preview` pass |
| iOS simulator compile | 0 errors |
| Through the running server (127.0.0.1:4177) | md-card and md-list SwiftUI previews open with valid frames |

## Sweep of every Laboratory component (job 761)

`work/schema-lab/sweep-laboratory.mjs` opens a live preview for each of the 56 components in the
Laboratory navigation through the running server. It does this on the SwiftUI (iOS tab) and the Android renderers, one
session at a time, with the recipe properties, then requests a second frame and closes the session.

Result: **112/112 sessions opened with valid frames** (both validated by `native-live.mjs` / `android-live.mjs`).
No other component fails, for a schema reason or otherwise.

Some sessions are valid but report no inspection nodes, because their surface is closed in the recipe or presents
outside the measured root: md-fab-menu (ios), md-fab-menu (android), md-bottom-sheet (android), md-dialog (android), md-side-sheet (android). This is not a failure; it is recorded for the
final audit.
