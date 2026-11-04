# md-bar-chart native checkpoint

Status: **dedicated native renderer (gate 2) and Laboratory integration (gate 3) verified on macOS SwiftUI, the iOS simulator
and the Android emulator** against Mac Chrome 153 oracles (2026-10-30). Accessibility evidence with `tools/ax`: macos 0 open / 76 expected; ios 0 open / 64 expected; android 0 open / 74 expected (2 cases).
Independent final audit pending. Source contract and decisions: [md-bar-chart-source-review.md](md-bar-chart-source-review.md)
(section "Decisions (autonomous, …, reversible)"). Native plan: [md-bar-chart-native-plan.md](md-bar-chart-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Element | `AWCNativeView` node `md-bar-chart` → `AWCNativeChartView` (Charts/) | `AWCComponent("md-bar-chart", props, onEvent) { slot -> }` → `NativeChartView` |
| Properties (38) | every IR property as `AWCValue` (JSON objects / arrays for series, axes, data) | same |
| Function-valued properties | `AWCChartFormatters` (`valueFormatter`, axis formatters, `tooltipRenderer`) + `.awcChartFormatters(_:nodeID:)` | `ChartFormatters` + `LocalAWCChartFormatters` (keyed by node id) |
| Hooks (16 `--md-bar-chart-*`) | `AWCChartAppearance` (typed or `cssValues:`) + `.awcChartAppearance(_:)` | `AWCChartAppearance` (typed or `fromCss`) + `AWCChartAppearanceScope` |
| Methods (`refreshTheme()`, `resize()`, `replay()`, `drill()`, `toDataURL()`, `setZoom()`, `resetZoom()`) | `AWCChartController` + `.awcChartController(_:)` | `AWCChartController` + `AWCChartControllerScope` |
| `getInstance()` | not provided — it returns the Web engine object (see Exceptions) | same |
| Events (`mdBarClick`, `mdLegendClick`, `mdHover`, `mdReady`, `mdZoom`) | `onEvent` with the source detail | same |
| Slots (`header`, `empty`, `loader`, `loading`, `footer`) | child nodes with `slot` | the `content` slot lambda |

Inherited like CSS: theme tokens < appearance hooks < the host's inline `style` custom properties. Vertical / horizontal / polar layouts (grouped polar rings, decision B1), stacking, value labels and totals, chevrons, drill-down motion and the entrance stepped on the mirrored scene in RTL (bar-chart.ts playIntro).

## Evidence (n5-001/005/006 oracles; n5-017, n5-020…023 macOS + iOS + Laboratory; n5-A013, n5-A015…A018 Android, accessibility pass + tools/ax)

Oracles: `outputs/native-parity/md-bar-chart/web-oracle-mac/` (Chrome 153.0.8010.36, DPR 1; README + SHA256SUMS), shared
byte-identically (gzip) by the Android assets `ChartWeb/md-bar-chart/`; the Swift suites read the published layout by default.

| Run | Result |
| --- | --- |
| macOS SwiftUI (`NativeChartSceneIntegration`, `NativeChartInteractionIntegration`, `NativeChartMotionIntegration`) | paint-core 36/36, paint-extra 48/48, paint-dark-extra 7/7, paint-forced-colors 3/3, hover 10/10, hover-reduced-motion 10/10, keys 7/7, pointer 10/10, motion 21/21, motion-reduced-motion 21/21 — 173/173 |
| iOS simulator AWC-n5 (iPhone 17 Pro, iOS 26.3.1, `apps/native-ios-parity`) | 173/173 (same suites) |
| Android emulator-5560 (`dev.awc.playground.charts.NativeChartParityTest`, `NativeChartMotionTest`; ICU + Paint) | 173/173 |
| JVM (the Kotlin ports, desktop ICU) | scenes, hover / keys / pointer identical (motion: on device) |
| Views through the dispatch (light / dark × LTR / RTL) | macOS `NativeChartViewsSmoke` 34/34 (28 renders, 4 chart descriptors, 2 hosted plot-focus checks: key view, group, descriptor, increment, Tab → first chip); Android `NativeChartViewsTest` 72/72 checks (focus, keyboard, legend, announcement, lifecycle, accessibility model) |
| Laboratory | studio `chart-integration.test.mjs` 4/4 (no new failures in the full studio suite; the 5 failures are pre-existing on canonical); SwiftUI live host `test-live-charts.mjs` 37/37 checks (incl. lifecycle); snapshot renderer 9/9; Android `LivePreviewChartsHostTest` 2/2 tests (incl. lifecycle); compiled examples 103 Swift (typecheck) + 103 Kotlin (compiled) |
| Accessibility (`tools/ax`) | macos 0 open / 76 expected; ios 0 open / 64 expected; android 0 open / 74 expected (2 cases) — `outputs/native-parity/md-bar-chart/accessibility/report.md` |

Motion tolerance (line / area / bar): per-colour frame digests; each native measurement is the interval of its ±24 / ±28 /
±32 band digests and Chrome's ±28 value must lie inside (see the line review's decisions).

## Accessibility model

The host is a container labelled by the summary; the plot is the first Tab stop and one element with `labelPlot` as its name and the current point as its value (macOS: a group in the window key-view loop with increment / decrement; iOS: adjustable — swipe up / down — and a stop of the AWC key-view loop; Android: a focusable node with the TalkBack actions Next / Previous / First / Last); the legend chips follow as toggle buttons (pressed = shown), each a Tab stop toggled by Enter / Space; the cursor announcement is a polite live region (Android) / an accessibility announcement plus the plot value (Apple); the Web screen-reader data table is the AXChartDescriptor on macOS / iOS (VoiceOver chart details, Audio Graph) and the step actions on Android; the subtitle is exposed as text and the loading spinner as a progress indicator named by `loadingLabel`. Reviewed conventions are listed in
`tools/ax/expectations.mjs` (Charts entries).

## Exceptions (proposed; reviewer acceptance pending)

Full records per AUDIT.md's exception policy, scoped to the smallest behaviour. Neither is accepted.

### md-bar-chart/getInstance

| Field | Record |
| --- | --- |
| Scope | the one method `getInstance()`; every other method is implemented |
| Exact source behaviour | `@Method() async getInstance(): Promise<BarChartEngine \| null>` (packages/core/src/components/md-bar-chart/md-bar-chart.tsx:403) resolves the internal Web engine instance that renders the canvas (null before the first render); callers can reach engine internals directly. |
| Affected platforms and API | macOS SwiftUI, iOS SwiftUI, Android Compose — `AWCChartController` (+ `.awcChartController(_:)` / `AWCChartControllerScope`) has no `getInstance`; the Laboratory policy lists it under `unsupportedMethods`. |
| Technical reason | The engine object is a JavaScript class instance bound to the DOM canvas; the native renderers are not that engine, so there is no object with the same identity or members to return. |
| User impact | Scripts that call engine internals through `getInstance()` have no native counterpart. Documented chart operations are unaffected. |
| Tested native equivalent | Every documented operation is a typed controller method with a result: `refreshTheme()`, `resize()`, `replay()`, `drill()`, `toDataURL()`, `setZoom()`, `resetZoom()`; events and properties cover the rest. A `getInstance` request is rejected explicitly, never silently ignored. |
| Tests | [test-live-charts.mjs](../../apps/native-ios-playground/scripts/test-live-charts.mjs) — SwiftUI live host: every method with its result; getInstance rejected; [LivePreviewChartsHostTest.kt](../../apps/native-android-playground/src/androidTest/java/dev/awc/playground/LivePreviewChartsHostTest.kt) — Compose live host: the same; [chart-integration.test.mjs](../../apps/native-playground/chart-integration.test.mjs) — Laboratory method support: getInstance unsupported, every other method supported |
| Evidence | `outputs/native-parity/md-bar-chart/native/checkpoint.json`, [test-live-charts.mjs](../../apps/native-ios-playground/scripts/test-live-charts.mjs), [LivePreviewChartsHostTest.kt](../../apps/native-android-playground/src/androidTest/java/dev/awc/playground/LivePreviewChartsHostTest.kt) |
| Reviewer | independent final audit reviewer (AUDIT.md gate 7) — not yet assigned |
| Acceptance | **NOT ACCEPTED — proposed; needs the reviewer's explicit acceptance (AUDIT.md exception policy)** |

### md-bar-chart/part-selectors

| Field | Record |
| --- | --- |
| Scope | author `::part()` rules on the shadow parts; the parts' own styling and their CSS custom properties are implemented |
| Exact source behaviour | Shadow-DOM nodes carry `part` attributes (packages/core/src/components/md-bar-chart/md-bar-chart.tsx, lines 697–1071): `zoom`, `zoom-slider`, `zoom-pan`, `header`, `canvas`, `empty`, `loading`, `zoom-band`, `footer` and, forwarded from the embedded zoom slider (`exportparts`), `zoom-track`, `zoom-window`, `zoom-handle`; page CSS can restyle any of them with `md-bar-chart::part(<name>)` rules. |
| Affected platforms and API | macOS SwiftUI, iOS SwiftUI, Android Compose — `AWCChartAppearance` (`.awcChartAppearance(_:)` / `AWCChartAppearanceScope`), theme tokens, inline `style` custom properties. |
| Technical reason | `::part()` is CSS selector syntax over a shadow tree; SwiftUI and Compose have no stylesheet, shadow DOM or selector matching (AUDIT.md: CSS selector syntax is a browser-only facility). |
| User impact | Arbitrary per-part CSS (any property on any part) cannot be applied natively; apps restyle through the typed hooks, or supply their own content in the slots. |
| Tested native equivalent | The component stylesheet's styling of each part is reproduced by the renderers, and every CSS custom property it reads is a typed hook (16 `--md-bar-chart-*` hooks), inherited as on the Web: theme tokens < hooks < inline `style`. |
| Tests | [NativeChartSceneIntegration.swift](../../packages/native-ios/Tests/NativeChartSceneIntegration.swift) — paint scenes incl. hook, dark and forced-colors subsets vs Chrome (macOS, iOS); Android: dev.awc.playground.charts.NativeChartParityTest; [test-live-charts.mjs](../../apps/native-ios-playground/scripts/test-live-charts.mjs) — hook defaults < local values and their rendered ink; Android: LivePreviewChartsHostTest.kt; [chart-integration.test.mjs](../../apps/native-playground/chart-integration.test.mjs) — typed hook profiles in the Laboratory |
| Evidence | `outputs/native-parity/md-bar-chart/web-oracle-mac/`, `outputs/native-parity/md-bar-chart/native/checkpoint.json`, [NativeChartSceneIntegration.swift](../../packages/native-ios/Tests/NativeChartSceneIntegration.swift) |
| Reviewer | independent final audit reviewer (AUDIT.md gate 7) — not yet assigned |
| Acceptance | **NOT ACCEPTED — proposed; needs the reviewer's explicit acceptance (AUDIT.md exception policy)** |

## Remaining

Independent final audit; reviewer acceptance of the exceptions above.
