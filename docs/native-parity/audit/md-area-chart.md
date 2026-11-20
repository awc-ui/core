# Gate 7 re-check (s7-9, 2026-11-16): md-area-chart

**Verdict: PASS**

Scope: md-line-chart, md-area-chart, md-bar-chart, md-pie-chart, md-sparkline share one re-run; the counts below cover all five.

## Re-run counts (reviewer s7-9, 2026-11-16, snapshot work/audit/s7-9-tree, job logs in claude-runner/done/)
| Suite | Platform | Result | Job |
|---|---|---|---|
| NativeChartPaintIntegration | macOS / iPhone 26.3 / iOS 18 | 1045/1045 each | s7-9-002-macos / s7-9-003-ios-iphone / s7-9-004-ios18 |
| NativeChartMotionIntegration | macOS / iPhone / iOS 18 | 98/98 runs within tolerance each | same |
| NativeChartViewsSmoke | macOS | 34/34 | s7-9-002-macos |
| NativeChartScene / Interaction | iPhone / iOS 18 | exit 0 | s7-9-003, s7-9-004 |
| Android NativeChartPaintTest, NativeChartParityTest, NativeChartMotionTest, NativeChartViewsTest, LivePreviewChartsHostTest (emulator-5566) | Android | BUILD SUCCESSFUL, 5 of 5 classes | s7-9-A003-android |
| stdio live host + validateNativeInspection (7 tags), test-live-charts, test-snapshot-charts | macOS host | all 5 charts `server validation: ok`; 57 checks; 9 checks | s7-9-005-lab-ax |
| 4177 read-only probes incl. `POST /api/native-live/session?platform=ios` (R5-01) | Laboratory | 50 ok, 0 fail; session 200 for every chart; update, setZoom, resetZoom, toDataURL ok; getInstance 400 INVALID_METHOD (unsupported, as declared) | s7-9-005-lab-ax |
| Compiled examples (ChartExamples) | Swift typecheck / Kotlin compile | 103 / 103 | s7-9-006-examples-swift, s7-9-A004-examples-kotlin |
| tools/ax (macOS, iOS, Android, compare) | all | pass; accepted entries are the reviewed conventions (canvas / hidden data table / AXChartDescriptor, patch-ax-chart); 0 open | s7-9-005-lab-ax, s7-9-A005-ax-android |

## Findings re-checked
- R5-01 (SwiftUI live session 502): FIXED, confirmed by the POST probe above (session 200, padding reported as a 4-array).
- R5-02/R5-03 (native paint against Chrome incl. hooks, parts, slots): FIXED, window-capture suites pass on three runtimes plus Android.
- R5-04 (`tableLabels`): FIXED, in the paint suites' descriptor checks and Android chart-data-table.
- R5-05 (`getInstance` support metadata): FIXED, generated IR lists `unsupportedMethods: [getInstance]` for iOS and Android (read in the snapshot).
- R5-06 (`::part` exceptions): rejected earlier; typed part appearance is implemented and tested (paint-parts). No exception remains.
- R5-15 (suite registration): FIXED. R5-17 (iOS ax text-missing): FIXED; accepted entries are conventions (data-table text carried by AXChartDescriptor / Android steps), not hidden defects.
- Exceptions: none outstanding.
No blocking finding.


---

## Earlier review (r5, 2026-10-31), superseded by the section above

# Gate 7 audit — `md-area-chart`

Reviewer: gate-7 reviewer r5, 2026-10-31. **Verdict: FAIL** — findings R5-01, R5-02, R5-03, R5-04, R5-05, R5-06, R5-15, R5-17 (work/audit/DEFECTS.md). Exceptions: `getInstance` **accepted**, `::part` selectors **rejected**.

Snapshot `work/audit/r5-tree`: rsync of canonical `work/awc-native` at 2026-10-31 02:12 Mac local time (job r5-001; 42 install jobs, latest `fx-072-install-orgchart-apk`), build products excluded, `node_modules` linked; inventory regenerated from it (`work/audit/r5/evidence/current-inventory.json`). Reviewer evidence: `work/audit/r5/evidence/`; jobs: `work/claude-runner/done/r5-*`. Platforms: macOS 15.6.1 (24G90), Xcode 26.3 (17C529); simulators AWC-r5 (iPhone 17 Pro, iOS 26.3.1), AWC-r5-pad (iPad Pro 11-inch M5, iOS 26.3.1), AWC-r5-18 (iPhone 16 Pro, iOS 18.6); Android emulator-5566 (AwcNative7, API 36) with the snapshot's private project.

## Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | FAIL | 39 properties, 8 events, 7 methods, 5 slots, 16 hooks, 12 parts. Every property, event, method and slot has SwiftUI and Compose code and a released-policy / Laboratory entry. Open: `tableLabels` (R5-04); `labelEmpty`, `labelZoomStart`, `labelZoomEnd`, `loader` slot untested (R5-03); hooks without a native test (R5-03); 12 parts without a native surface (exception rejected, R5-06); getInstance declared supported by the generated metadata (R5-05). |
| 2 Implementation | Partially verified | Dedicated renderers in production dispatch (AWCNativeView → AWCNativeChartView; AWCComponent → NativeChartView). The canvas draw list equals Chrome's `getScene()` on every platform; the host chrome is verified only by the reviewer's spot check (R5-02). |
| 3 Laboratory | FAIL | SwiftUI live preview rejected by the server for every session (R5-01). Android live preview: update and methods with results pass; static SwiftUI render 200; Studio and host tests pass; examples compile. |
| 4 Behaviour | PASS (re-run) | Interaction / state replays, motion, views and live-host tests re-run green on every platform (table below). |
| 5 Visual | Evidence gap | Model-level scene comparison only; no measured native-view comparison (R5-02); hooks unverified (R5-03). |
| 6 Runtime + accessibility | Open findings | Suites pass on macOS, iPhone 26.3, iPad 26.3, iPhone iOS 18.6 and Android. tools/ax re-run: macOS pass, 37 accepted; iOS 1 open (text-missing), 8 accepted; Android pass, 16 accepted (1 cases) (R5-17). |
| 7 Independent audit | FAIL | This document. |

## Re-runs (claimed → r5)

Claimed counts are those of docs/native-parity/md-area-chart.md / outputs/native-parity/md-area-chart/native/checkpoint.json. The checkpoint lists no file hashes, so it cannot be matched to today's canonical code: every suite was re-run on the snapshot against the published Mac Chrome 153 oracles (`outputs/native-parity/md-area-chart/web-oracle-mac`).

| Suite | Claimed (each platform) | macOS (r5-003) | iPhone 17 Pro 26.3 (r5-007) | iPad Pro 11 26.3 (r5-010) | iPhone 16 Pro 18.6 (r5-011, r5-014) | Android emulator-5566 (r5-A001) |
| --- | --- | --- | --- | --- | --- | --- |
| paint-core | 32/32 | 32/32 | 32/32 | 32/32 | 32/32 | 32/32 |
| paint-extra | 43/43 | 43/43 | 43/43 | 43/43 | 43/43 | 43/43 |
| paint-dark-extra | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 |
| paint-forced-colors | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| hover | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 |
| hover-reduced-motion | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 |
| keys | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 |
| pointer | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 |
| motion | 13/13 | 13/13 | 13/13 | 13/13 | 13/13 | 13/13 |
| motion-reduced-motion | 13/13 | 13/13 | 13/13 | 13/13 | 13/13 | 13/13 |
| **total** | 143/143 | 143/143 | 143/143 | 143/143 | 143/143 | 143/143 |

Shared chart suites in the same runs: NativeChartSceneIntegration 485/485, NativeChartInteractionIntegration 211/211, NativeChartMotionIntegration 98/98 on macOS and the three simulators; Android `NativeChartParityTest` (scenes, interaction, pie / sparkline states) and `NativeChartMotionTest` pass. Views: macOS `NativeChartViewsSmoke` 34/34 (its 28 PNGs are ImageRenderer placeholders for the platform views — R5-02), Android `NativeChartViewsTest` 72/72. iOS 18.6 scene suite: the first install on the fresh simulator failed (simctl "Failed to locate app asset data promise"); the re-run r5-014 passed 485/485.

## Laboratory (gate 3)

Through the running server http://127.0.0.1:4177 with the Studio's own request (`nativeRenderRequest` + the recipe), jobs r5-005 / r5-0075 (`work/audit/r5/tools/lab-probe-r5.mjs`, `evidence/lab/lab-probe*.json`):

- SwiftUI (`platform=ios`, the macOS live host): **session 502 `INVALID_LIVE_FRAME`** on every attempt. The canonical host binary over stdio returns the frame, but its inspection metric `padding` is a scalar, which `validateNativeInspection` rejects (R5-01). The static render `/api/native-render` returns 200.
- Compose (`platform=android`, emulator-5554 host): session 200; update `{label, stack: normal}`; `replay()` ok; `toDataURL()` → PNG data URL (58,334 chars); `getInstance()` → 400 INVALID_METHOD.
- Re-run on the snapshot (r5-012): Studio `chart-integration` + `native-live-routes` + `native-inspection` (+ org chart / table suites) 36/36; `test-live-charts.mjs` 37/37 (stdio, bypasses the server validation); `test-snapshot-charts.mjs` 9/9; Android `LivePreviewChartsHostTest` 2/2 (r5-A001).
- Copied examples regenerated from canonical with the Laboratory's own example code (`n5-lab/lab/chart-examples.mjs`, r5-006): 103 SwiftUI examples type-check against the snapshot's AWCUI; 103 Compose examples compile in the androidTest source set (r5-A003).

## Accessibility (gate 6)

tools/ax re-run on the snapshot (r5-008 macOS / Web / iOS AWC-r5; r5-A005 Android emulator-5566 + compare; `evidence/ax/md-area-chart/report.md`): macOS pass, 37 accepted; iOS 1 open (text-missing), 8 accepted; Android pass, 16 accepted (1 cases).
The open iOS findings are `text-missing` of the screen-reader table text (category labels with values). They appear with the current `compare.mjs` / `normalize.mjs` (changed 2026-10-30 23:12, after the chart accessibility runs) on the owners' own captures as well, so the published "0 open" report is stale (R5-17). The other expectations (SR table → AXChartDescriptor / step actions, axis ticks as canvas text, empty slot wrappers, unnamed canvas, legend chip target size, iOS adjustable plot) are documented platform conventions with their native equivalents, not hidden defects.

## Exceptions

### md-area-chart/getInstance — ACCEPTED (gate-7 reviewer r5, 2026-10-31)

All policy fields are present (source behaviour with file:line, platforms/API, technical reason, user impact, tested native equivalent, evidence). Not implementable as specified: the method resolves the Web engine instance (a JavaScript class constructed on the shadow-DOM canvas container); the source readme states that `getInstance()` "is an escape hatch; anything done through it is outside this component's contract". Every documented operation is a typed `AWCChartController` method (refreshTheme, resize, replay, toDataURL, setZoom, resetZoom) with results, and an explicit rejection is tested: test-live-charts.mjs (37/37), LivePreviewChartsHostTest (2/2), chart-integration.test.mjs, and the reviewer's server probe (Android 400 `INVALID_METHOD`). Scope: the one method. The acceptance does not cover the support metadata, which still declares the method supported (R5-05).

### md-area-chart/part-selectors — REJECTED (gate-7 reviewer r5, 2026-10-31)

The selector syntax is browser-only, but its observable effect — restyling a named part — is implementable and already implemented elsewhere in this codebase as typed part surfaces where part rules win over hooks (md-card `AWCCardPartAppearance`, md-list `AWCListPartAppearance`, md-avatar `AWCAvatarPartAppearance`, md-checkbox `AWCCheckboxPartAppearance`). Required: an `AWCChartPartAppearance` keyed by the chart's parts with the shared sparse vocabulary, Laboratory part rules, compiled examples and per-part paint tests (R5-06).

## Findings

- **R5-01** (3): Every SwiftUI live-preview session of the five charts is rejected by the 4177 server: `POST /api/native-live/session?platform=ios` → 502 `INVALID_LIVE_FRAME` ("invalid layout measurements"). The host reports the chart metric `padding` as a scalar (e.g. `16`) while `native-inspection.mjs` `validateMetrics` requires `[top, right, bottom, left]` (the Compose host already reports `[16,16,16,16]`). `test-live-charts.mjs` talks to the host over stdio and asserts the scalar (`metric(...,'padding')===28`), so the server path was never exercised. Static `/api/native-render` works.
- **R5-02** (2, 5): No suite compares the rendered native chart views with Chrome. The "paint" suites diff the model's draw list with Chrome's `getScene()` using Chrome's canvas width/height as input; the host box (surface, padding, radius, block size), legend chips (scene legend entries carry no geometry), empty/loading layers, header/footer/center slots, zoom slider, tooltip card (the interaction replay uses Chrome's measured card size) and focus rings are never measured natively, although Chrome shots exist for every paint case. `NativeChartViewsSmoke`'s 28 "renders" use `ImageRenderer`, which draws the platform views (plot focus view, legend chips) as the yellow "unsupported" placeholder, so its PNGs are not visual evidence. Reviewer spot check (window capture, `work/audit/r5/tools/R5ChartPixelProbe.swift`, job r5-009): 8 cases (line light/dark·RTL default, legend bottom, empty, zoom slider; area, bar default; pie donut) have identical host boxes and mean |Δ| 0.06–0.84 with 0.11–0.78 % of pixels > 24 levels — no mismatch observed, but no regression protection.
- **R5-03** (1, 4): Contract rows with no native test: cartesian hooks `aspect-ratio`, `min-block-size`, `shape`, `empty-background`, `empty-color`, `empty-font`, `empty-font-size`, `empty-icon-size`, `zoom-band-color`, `zoom-size`, `zoom-track-color`, `zoom-window-color` (no oracle case uses any cartesian hook; `zoom-handle-color` is configured in test-live-charts.mjs but never asserted); pie/sparkline hooks occur in oracle HTML but the scene comparison cannot observe host-box effects (only `background`, `padding`, sparkline `blockSize` are asserted, as self-reported host metrics); properties `labelEmpty`, `labelZoomStart`, `labelZoomEnd` and the `loader` slot (line/area/bar), pie `outerRadius`.
- **R5-04** (1): `tableLabels` is declared supported (NativeSupport.json / support.json, Laboratory) but neither renderer reads it (no reference under AWCUI/Charts or nativeui/charts). The pie review decision says "`summary` and `tableLabels` replace them on every platform"; natively the screen-reader table is the AXChartDescriptor / Android step actions, whose axis and column titles stay English.
- **R5-05** (1, 7): `packages/native-ios/NativeSupport.json` and `packages/native-android/support.json` list `getInstance` in both `methods` and `unsupportedMethods`; `native-compiler` derives `unsupportedMethods` from `methods`, so the generated IR / catalog and `current-inventory.json` declare getInstance supported (0 method gaps) on both platforms, contradicting the exception record.
- **R5-06** (1 (exception rejected)): Proposed `::part` exceptions rejected: per-part restyling is implementable natively and the codebase already does it with typed part surfaces where part rules win over hooks (md-card `AWCCardPartAppearance`, md-list `AWCListPartAppearance` + placeholder part, md-avatar `AWCAvatarPartAppearance`, md-checkbox `AWCCheckboxPartAppearance`); the org chart record itself states the surface is implementable.
- **R5-15** (4): The chart (`NativeChartScene/Interaction/Motion`, `NativeChartViewsSmoke`) and table (`NativeTablePaint/States`) Swift suites are not in `packages/native-ios/scripts/test-native-views.sh`, so the canonical integration (`integrate-swift.sh`) never runs them; they only ran from fork lab scripts (n5-lab/build-scene.sh, n4-lab/scripts/build-test.sh).
- **R5-17** (6): With the current tools/ax (compare.mjs / normalize.mjs changed 2026-10-30 23:12, after the chart accessibility runs), the owners' own captures and the r5 re-run both give open iOS `text-missing` findings (line 3, area 1, bar 2, pie 2): the screen-reader table text (category labels with values) no longer matches the numeric-only Charts expectation. The published "0 open" reports are stale.

## Observations (non-blocking)

- Dependencies: the zoom slider and loading indicator are internal renderings of md-slider / md-progress-indicator behaviour; both components report their own native renderers (AUDIT.md rows), not re-audited here.
- The motion tolerance (±24/28/32 colour-band interval) is recorded in the line review's decisions.
