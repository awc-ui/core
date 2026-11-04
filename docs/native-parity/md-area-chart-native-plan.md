# Area chart native implementation plan (md-area-chart)

Status: preparation only, at Gate 1. No native code has changed.

* Verified Web contract: [md-area-chart-source-review.md](md-area-chart-source-review.md).
* Oracle: **provisional** cloud capture in
  `outputs/native-parity/md-area-chart/web-oracle-cloud/` — recapture on the Mac (Chrome 153).

## Current adapters — NOT YET READ

As for the line chart: the Mac bridge dropped before the iOS `chart` adapter and the Android
equivalent could be read. Fill the "now" columns of
[md-line-chart-native-plan.md](md-line-chart-native-plan.md#gap-checklist) for the area
dispatch first; whether the adapters render `md-area-chart` through the same chart view as
`md-line-chart` (with fills forced on) is the first thing to establish.

## Area-specific gaps to check (in addition to the line checklist)

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Default stack | `normal` (line: `none`) | ? | ? |
| Streamgraphs | `silhouette`, `wiggle` baselines | ? | ? |
| Percentage | each x sums to 100 % | ? | ? |
| Fill | vertical gradient, `fill-opacity` 0.55 default, line on top unless `show-line=false` | ? | ? |
| Emphasis | none on axis trigger; band containment with `tooltip="item"` | ? | ? |
| Area click | `mdAreaClick` inside a band | ? | ? |
| Runtime props | `locale`, `no-animation`, `series-labels` re-apply after mount (fixes A1–A3) | ? | ? |
| Loading | not reflected; no replay on clear (open O-A1/O-A2 — follow the decision) | ? | ? |

## Plan

Reuse the shared native chart core planned for the line chart; the area chart is a
configuration of it (fills on, stack default `normal`, emphasis rules for filled charts).
Validate scene JSON for every paint case, then motion digests (`motion.json`), then the
interaction records.
