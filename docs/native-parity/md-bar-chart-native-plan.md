# Bar chart native implementation plan (md-bar-chart)

Status: preparation only, at Gate 1. No native code has changed.

* Verified Web contract: [md-bar-chart-source-review.md](md-bar-chart-source-review.md).
* Oracle: **provisional** cloud capture in
  `outputs/native-parity/md-bar-chart/web-oracle-cloud/` — recapture on the Mac (Chrome 153).

## Current adapters — NOT YET READ

The Mac bridge dropped before the iOS `chart` adapter and the Android equivalent could be read.
Use the line chart's [gap checklist](md-line-chart-native-plan.md#gap-checklist) for the shared
rows and the table below for bar-only rows.

## Bar-specific gaps to check

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Layout | vertical / horizontal; horizontal categories top→bottom | ? | ? |
| Grouping | slots per visible series (unstacked) or per stack group; `category-gap` 30 %, `bar-gap` 20 %, `bar-width` clamp | ? | ? |
| Stacking | normal, percentage, silhouette, wiggle; totals (`show-totals`) | ? | ? |
| Negatives | bars below zero, labels at the low end | ? | ? |
| Corners | radius 6 on the free end only (per stack, per sign) | ? | ? |
| Chevron | interlocking arrow segments, both layouts | ? | ? |
| Overlay series, ranges, variwide | `overlay`/`widthRatio`, `range`, `pointWidths` | ? | ? |
| Dual value axis | `y-axis2` | ? | ? |
| Polar | ring per category (0 outermost), hole 0.22, sweep 0.75 from 12 o'clock, **sub-ring per series when unstacked (fix B1)**, round caps per (sub-)ring, value ticks outside, names in the free quarter | ? | ? |
| Polar hover | segment hit test, spotlight fade (62 % toward surface), dwell before tooltip | ? | ? |
| Value labels | bound to the bar tip, animate with it | ? | ? |
| Tooltip | `none` honoured; `item` = axis card | ? | ? |
| Keyboard | ←/→ walk categories in every layout; Enter → `mdBarClick` for the first visible series | ? | ? |
| Drill | `drill(index, direction)` animates the next data swap | ? | ? |
| Empty | hard-coded "No data to display" (no `label-empty`); no `summary`/`table-labels` (open O-B1) | ? | ? |

## Plan

Reuse the shared native chart core (see the line plan) with a bar layout ported from
`engine/bar-layout.ts` (`computeBarLayout`, `radialScene`): diff the `scene.bars` /
`scene.slices` JSON of each paint case first, then motion (`motion.json`: per-series pixel
bounding boxes and value-label tracks per frame, polar spotlight frames), then interaction
records (`hover.json`, `keys.json`, `pointer.json`).
