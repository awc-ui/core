# Gate 7 audit — `md-divider`

Reviewer: gate-7 reviewer r3, 2026-10-31. Independent of the implementing forks; no product code changed.

**Verdict: FAIL** — 3 findings (r3-01, r3-02, r3-03). Re-runs are green on every platform; the failures are an
unimplemented/untested source branch (forced colours), a missing default-palette / dark-theme colour comparison and the
absent in-place Laboratory update.

## Method

- Snapshot of the canonical tree: `work/audit/r3-tree` (job `r3-002`, 2026-10-31 02:12 EET, 42 install jobs, newest
  `fx-072-install-orgchart-apk`). All re-runs below use it; the Laboratory probe uses the running 4177 server (canonical).
- Contract: `packages/core/src/components/md-divider/` and a regenerated inventory (`work/audit/r3/out/current-inventory.json`,
  job `r3-006`) — unchanged from the baseline (4/0/0/0, 4 hooks, 1 part).
- The prior evidence (`outputs/native-parity/md-divider/`, `web-evidence.json`, `android/final-45/`) predates many shared-file
  changes; the r3 re-runs are the current evidence.

## Gate checklist

| Gate | Result | Evidence |
| --- | --- | --- |
| 1 Source contract | pass | matrix below; CEM = source (4 props, 4 hooks, part `divider`); cascade `insetEnd > insetStart > inset` read from `md-divider.css` and matched in `NativeDivider.swift` / `NativeDivider.kt` |
| 2 Implementation | **finding r3-01** | forced-colors branch (`CanvasText` line) has no Compose path; SwiftUI maps it to increased contrast (`onSurface`) untested |
| 3 Laboratory | **finding r3-03** | appearance module (4 hooks, part `divider`), examples compile; no in-place property update (`400 INVALID_PROPERTY_UPDATE` on both platforms) |
| 4 Behaviour | pass | all 8 flag combinations × orientation × direction, hidden, vertical minimum (45 oracle cases) on both platforms |
| 5 Visual | **finding r3-02** | the default line colour is never compared with Chrome (only the authored `#123456` case is pixel-checked); the oracle loads `/fonts.css` (Laboratory palette, `reference-theme-provenance.md`) and has no dark case |
| 6 Runtime + a11y | pass | macOS, Android and iOS 26.3 re-runs green; tools/ax re-run: 0 open findings on macOS, iOS and Android (2 accepted conventions each) |
| 7 Final audit | FAIL | this document |

## Source contract matrix

| Member | SwiftUI | Compose | Laboratory | Test |
| --- | --- | --- | --- | --- |
| `inset`, `insetStart`, `insetEnd`, `vertical` (boolean, false) | `AWCNativeDividerMetrics` | `NativeDividerMetrics` | catalog property editors (session re-render, see r3-03) | `DividerWebGeometry.json` 32 flag cases; `NativeDividerViewIntegration`, `NativeDividerParityTest` |
| `--md-divider-color` / `-thickness` / `-inset-start` / `-inset-end` | `AWCDividerAppearance` (`.awcDividerAppearance`) | `AWCDividerAppearance` (`AWCDividerAppearanceScope`) | `divider-appearance.js` (4 fields, part `divider`) | styled cases h/v-styled-32…39, rtl-overflow/negative |
| `::part(divider)` | inner `Rectangle` + inspection part | inner `Box` + inspection part | Styles panel targets `divider` | inspection margins (both suites; Android coordinate-limit test) |
| role `separator` + `aria-orientation` | label "Separator", value orientation | contentDescription + stateDescription | — | tools/ax `horizontal`, `vertical` |
| `:host([hidden])` | `hidden:true` removes subtree | same | — | `horizontal-hidden`, `vertical-hidden` |
| `@media (forced-colors)` → `CanvasText` | increased contrast → `onSurface` | **none** | — | **none** (r3-01) |
| `min-block-size: 1em` (vertical) | `@ScaledMetric` 16 body | `LocalTextStyle` font size | — | `vertical-minimum` |

No events, methods or slots. No exception is proposed.

## Re-run counts (claimed → r3)

| Suite | Claimed | r3 | Job |
| --- | --- | --- | --- |
| macOS `test-native-divider.sh` | 276/276 | **276/276** | `r3-009` |
| Android `NativeDividerParityTest` (45 fixtures) | 2/2 methods | **2/2** | `r3-A001` |
| Android unit `NativeDividerContractTest` | 2/2 (in 69) | **2/2** (unit total 195/195) | `r3-A001` |
| iOS `NativeDividerViewIntegration` (iPhone 17 Pro, iOS 26.3, AWC-r3) | 276/276 | **276/276** | `r3-011` |
| iOS 18.6 (iPhone 16 Pro, AWC-r3-18) / iPad Pro 11-inch (M5) iOS 26.3 (AWC-r3-ipad) | 276/276 / 276/276 | **276/276** / **276/276** | `r3-014` |
| Swift examples typecheck | 7 | **7, 0 errors** | `r3-010` |
| Kotlin examples compile | 7 | **7, BUILD SUCCESSFUL** (`:app:compileDebugAndroidTestKotlin`) | `r3-A007` |
| tools/ax (horizontal, vertical) | pass, 2 accepted ×3 | **pass, 2 accepted** on macOS, iOS, Android | `r3-0107`, `r3-A009` |

## Laboratory (gate 3)

Probe `work/audit/r3/lab/lab-probe.mjs` (job `r3-0105`) through `http://127.0.0.1:4177/api/native-live/*`: the SwiftUI and
Compose sessions open with valid frames and inspection (2 nodes: host and part). `update {vertical:true}` is refused on
both platforms with `400 INVALID_PROPERTY_UPDATE "Retained property updates are unavailable for this component."`
(`md-divider` is not in `native-property-updates.js`), so a property edit re-creates the session instead of updating it in
place (PARALLEL.md definition of done: "in-place property updates"). No methods. Examples regenerated from the released
policies (`work/audit/r3/examples/md-divider/`) and compiled.

## Accessibility (gate 6)

The three `expectations.mjs` entries for `md-divider` (text-extra "Separator" on macOS/iOS/Android) are conventions: no
native platform has a separator role (Chrome itself maps it to AXSplitter, which SwiftUI cannot set), and the native element
carries the same information (label + orientation value). Accepted as conventions.

## Findings

- **r3-01** (gates 2, 5) forced colours: no Compose implementation; SwiftUI branch untested.
- **r3-02** (gate 5) no default-palette colour comparison and no dark-theme case.
- **r3-03** (gate 3) no in-place Laboratory property update.

Defect rows with evidence paths and suggested fixes: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate-7 reviewer r3". Evidence: `work/audit/r3/` (runner logs `work/claude-runner/done/r3-*.log`); progress `work/audit/r3/PROGRESS.md`.
