# Gate 7 audit — `md-list` (+ `md-list-item`)

Reviewer: gate-7 reviewer r3, 2026-10-31. Independent of the implementing forks; no product code changed.

**Verdict: FAIL** — findings r3-08, r3-09, r3-12, r3-13, r3-14, r3-15, r3-16, r3-21, r3-22. Paint and interaction re-runs pass on
macOS and Android (one Android timing failure under load passed when re-run alone); iOS 26.3 reproduces the open post-click
state-layer failures.

## Method

- Snapshot `work/audit/r3-tree` (job `r3-002`, 2026-10-31 02:12 EET, 42 install jobs, newest `fx-072-install-orgchart-apk`).
- Contract: `packages/core/src/components/md-list{,-item}/` + regenerated inventory (`r3-006`), unchanged from baseline:
  md-list 8/3/4/1, 10 hooks, part `drop-placeholder`; md-list-item 28/6/5/8, 68 hooks, 29 parts.
- Hash check of `outputs/native-parity/md-list/{native-swift,native-android,laboratory}/checkpoint.json`: renderer and shared
  files changed since — prior counts are stale; the r3 re-runs are the current evidence.

## Gate checklist

| Gate | Result | Evidence |
| --- | --- | --- |
| 1 Source contract | **findings r3-08, r3-13** | 4 md-list-item events declared unsupported on both platforms without an exception record; six source questions listed as "source decisions for the owner" with no recorded decision |
| 2 Implementation | **findings r3-09, r3-12, r3-15** | `labelledby` parsed but never applied (SwiftUI) / ignored (Compose); Android hybrid density (case 120, 32 known-gap checks); CSS cursor (pointer/grab/grabbing) not mapped |
| 3 Laboratory | **finding r3-16** | Android `selectionMode` retained update kills the live session | |
| 4 Behaviour | pass | 27 interaction runs (+ extra, reduced) on both; methods 28/28; tooltips |
| 5 Visual | **finding r3-14** | 264 paint cases exercise all 78 hooks; only 8 of the 29 item parts are styled in any test |
| 6 Runtime + a11y | **finding r3-22** (+ r3-21) | states: iPhone 26.3 75,995/76,003 and 76,833/76,837, iOS 18.6 75,256/75,276, iPad 26.3 76,960/76,962 (post-click state-layer / corner frames); tools/ax 0 open findings on all platforms | |
| 7 Final audit | FAIL | this document |

## Source contract matrix (summary)

| Family | md-list | md-list-item | SwiftUI | Compose | Laboratory | Test |
| --- | --- | --- | --- | --- | --- | --- |
| Properties | 8 | 28 | all parsed; **`labelledby` unused** | all parsed; **`labelledby` absent** | retained updates (8 + 28) | paint/states oracles; `labelledby` only in one case (with `label`), accessible name never asserted |
| Events | mdSelect, mdActivate, mdReorder | mdClick, mdExpand + **4 internal** (mdItemClick, mdItemSelect, mdRequestActivation, mdItemRequestReorder) | 5 public | 5 public | event log | states oracles (payloads and order) |
| Methods | activateNext, activatePrevious, selectItem, getSelectedIndices | setFocus, focusItem, toggle, expand, collapse | `AWCListController`, `AWCListItemController` | same | method buttons with results | `NativeListMethodsIntegration` 28/28, live hosts |
| Slots | default | 8 | slot views | slot lambdas | text slots (headline, overline, supporting, trailing-supporting, expanded-content) | paint cases |
| Hooks | 10 | 68 | `AWCListAppearance`, `AWCListItemAppearance` | same | `list-appearance.js` | all 78 used by `list-web-paint.json` cases |
| Parts | drop-placeholder | 29 (27 native + 2 tooltip popups via md-tooltip appearance) | `AWCListItemPart` | same | Styles panel | row, state-layer, headline, leading-icon, trailing, drag-handle, expanded-panel, avatar (+ placeholder) only |

## Exception decisions

| Proposed difference | Decision |
| --- | --- |
| md-list-item `mdItemClick`, `mdItemSelect`, `mdRequestActivation`, `mdItemRequestReorder` "internal protocol" (policies: unsupported) | **Rejected** as an exception — implementable (md-accordion-item emits its equivalent item-to-group events natively; the native list already computes every payload). Either emit them through `onEvent` with the source payloads, or record a source decision to make them internal (e.g. stop documenting them / mark `@internal` in the CEM) and then drop them from the contract. r3-13. |
| `headline-tooltip-popup` / `supporting-tooltip-popup` styled through the shared md-tooltip appearance | Acceptable as a named native equivalent **once tested**: no test applies a tooltip appearance to a list row's popup (part of r3-14). |
| Android hybrid density (local −1 under global −4), 32 known-gap checks | **Rejected** — implementable (`AWCDensityScope` carrying the inherited spacing rung) or resolved by deciding the open source question; r3-15. |
| Input-latency "known gaps" (rendered values within one more frame of Chrome's envelope: Swift 29, Android 113) | Accepted as a documented oracle-timing tolerance (CDP inputs reach the page 1–52 ms after the phase time; values further out fail). Not an exception. |
| Swift known gap: authored md-switch row 56 vs 64 px (md-switch touch target), recorded in `NativeListStatesIntegration.swift:386-388` | No longer occurs: both r3 macOS runs record only input-latency gaps (29 and 60, job `r3-0135` lists all 60), so this exclusion no longer hides anything. Not a finding. |

## Re-run counts (claimed → r3)

| Suite | Claimed (latest) | r3 | Job |
| --- | --- | --- | --- |
| macOS `NativeListPaintIntegration` | 29,418/29,418 | **29,418/29,418** | `r3-009` |
| macOS `NativeListStatesIntegration` | 112,882 … 118,194 (frame-dependent) | **115,747/115,747** (29 latency gaps), second run **118,777/118,777** (60 latency gaps, all listed) | `r3-009`, `r3-0135` |
| macOS `NativeListMethodsIntegration` / `NativeListTooltipIntegration` | 28/28, 8/8 | **28/28, 8/8** | `r3-009` |
| Android `NativeListPaintTest` | 27,983/27,983 + 32 known gaps | **27,983/27,983 + 32 known gaps** | `r3-A006` |
| Android `NativeListStatesTest` | 175,279/175,279 | first run **175,278/175,280** (2 caret frames, `r3-A002`, Mac under load); alone **175,276/175,276** (113 latency gaps, 1 pending case) | `r3-A002`, `r3-A006` |
| Android `NativeListTooltipTest`, `NativeListFocusSemanticsTest`, `LivePreviewListHostTest` | pass | **pass, pass, pass** | `r3-A002`, `r3-A006` |
| SwiftUI live host `test-live-list.mjs` | 24/24 | **pass** | `r3-0106` |
| iOS methods / paint / states / tooltips (iPhone 17 Pro, iOS 26.3, AWC-r3) | 106,426/106,436 (10 open) | **28/28 · 29,418/29,418 · 75,995/76,003 (run 1, 55 latency gaps), 76,833/76,837 (run 2, 43 latency gaps) · 8/8** | `r3-011`, `r3-013` |
| iOS 18.6 (iPhone 16 Pro, AWC-r3-18) / iPad Pro 11-inch (M5) iOS 26.3 (AWC-r3-ipad) | 105,248/105,257 / 106,671/106,675 | **28/28 · 29,418/29,418 · 75,256/75,276 · 8/8** (20 failing checks) / **28/28 · 29,418/29,418 · 76,960/76,962 · 8/8** (2 failing checks) | `r3-014` |
| Swift / Kotlin examples | 93 / 93 | **93 typecheck, 0 errors / 93 compile** | `r3-010`, `r3-A007` |
| tools/ax single-select, multi-select, none | pass ×3 | **pass** ×3 (0 open) | `r3-0107`, `r3-A009` |

The Android pending case is `trailing-trailing-standard-none-light-ltr/focus-button (authored control focus by id)`.

## Laboratory (gate 3)

`lab-probe.mjs` / `lab-probe2.mjs` (`r3-0105`, `r3-0109`) through the 4177 server. SwiftUI: retained updates `selectionMode`,
`density`, `listStyle` 200; `selectItem(1)` then `getSelectedIndices()` → `[1]`; `activateNext()` 200. Compose: `density` and `label`
200, but `update {selectionMode}` → `502 ANDROID_HOST_FAILED` and the session is gone (`404 SESSION_NOT_FOUND`) in 3 of 3 attempts, so
the methods could not be exercised on that session (r3-16); `LivePreviewListHostTest` (methods with results on Compose) passes.
md-list-item sessions: `update {headline}` 200 and `setFocus()` 200 on both. Studio focused 95/95, full 807/807; SwiftUI live host
`test-live-list.mjs` passes.

## Accessibility (gate 6)

tools/ax re-run (`work/audit/r3/out/ax/md-list/report.md`): single-select and multi-select rows are options on macOS/iOS and
radio buttons / checkboxes on Android (ROLE_TABLE encodings), names and Tab entry match Web; the selection-none rows read as text.
The Web `list`/`listbox` container is treated as "not exposed" on macOS and iOS by `compare.mjs`, so the list's accessible name is
not compared anywhere — which is how r3-12 (`labelledby`) went unnoticed. Android exposes `CollectionInfo`.

## Findings

- **r3-08** (gate 1) open source decisions not recorded (internal API public, typeahead `textContent`, morph timing, RTL disclosure keys, soft-disabled press morph, hybrid density).
- **r3-09** (gate 2) CSS cursor not mapped for rows and the drag handle.
- **r3-12** (gates 2, 6) `labelledby` not implemented; list name untested.
- **r3-13** (gates 1, 2) four md-list-item events unsupported without an exception record.
- **r3-14** (gates 4, 5) 13 of 29 item parts never exercised.
- **r3-15** (gates 2, 5) Android hybrid density known gap (32 checks).
- **r3-16** (gate 3) Android Laboratory `selectionMode` update kills the session.
- **r3-21** (gate 7) released policy notes still say iOS/VoiceOver execution is unverified.
- **r3-22** (gate 6) iOS post-click state-layer / corner frames: iPhone 26.3 8 and 4 checks in two runs, iOS 18.6 20, iPad 26.3 2.

Defect rows with evidence paths and suggested fixes: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate-7 reviewer r3". Evidence: `work/audit/r3/` (runner logs `work/claude-runner/done/r3-*.log`); progress `work/audit/r3/PROGRESS.md`.
