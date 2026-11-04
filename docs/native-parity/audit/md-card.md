# Gate 7 audit — `md-card`

Reviewer: gate-7 reviewer r3, 2026-10-31. Independent of the implementing forks; no product code changed.

**Verdict: FAIL** — findings r3-07, r3-09, r3-10, r3-11, r3-19, r3-21. macOS and Android re-runs pass in full; iOS 26.3 reproduces the
two open `dragClick … clickPress` pixel failures.

## Method

- Snapshot `work/audit/r3-tree` (job `r3-002`, 2026-10-31 02:12 EET, 42 install jobs, newest `fx-072-install-orgchart-apk`).
- Contract: `packages/core/src/components/md-card/` + regenerated inventory (`r3-006`): 9 properties, 4 events (`mdClick`,
  `mdDragStart` (cancelable), `mdDragMove`, `mdDragEnd`), default slot, 2 parts (`state-layer`, `outline`), 14 hooks — unchanged.
- Hash check of `outputs/native-parity/md-card/{native-swift,native-android,laboratory}/checkpoint.json`: `NativeCard.swift`,
  `NativeCard.kt`, `AWCComponent.kt`, `test-native-views.sh` and the Laboratory files changed since — prior counts are stale;
  the r3 re-runs are the current evidence.

## Gate checklist

| Gate | Result | Evidence |
| --- | --- | --- |
| 1 Source contract | pass | matrix below; source decisions recorded in `md-card.md` ("Source decisions recorded, not changed natively": pressed outranks dragged, inner controls fire `mdClick`, translucent disabled container, state rules over the elevation hook) |
| 2 Implementation | **findings r3-07, r3-09, r3-19** | forced colours not implemented; CSS `cursor` (pointer/grab/grabbing/default) and `aria-grabbed` not mapped; dragged-card z-index local to its container |
| 3 Laboratory | pass | `card-appearance.js` 14 hooks + 2 parts; retained update on both platforms; 28+28 examples |
| 4 Behaviour | **finding r3-10** | 66 trusted-input interaction runs, 18 lifecycle scenarios pass on both; Android keeps a touch click after an in-bounds move that Chrome cancels (documented, no exception record) |
| 5 Visual | pass | 448 paint cases (3 variants, light/dark, LTR/RTL, density 0…−4, all hooks and both parts) |
| 6 Runtime + a11y | **finding r3-11** (+ r3-21) | iPhone 26.3 states 181,903/181,905 and 189,179/189,182; iOS 18.6 179,932/179,933; iPad 26.3 189,427/189,539 — all failures in the `dragClick` scenario; tools/ax 0 open findings on all platforms |
| 7 Final audit | FAIL | this document |

## Source contract matrix (summary)

| Family | Count | SwiftUI | Compose | Laboratory | Test |
| --- | --- | --- | --- | --- | --- |
| Properties (variant, interactive, dragEnabled, disabled, softDisabled, ripple, fullWidth, fullHeight, density) | 9 | `NativeCard.swift` | `NativeCard.kt` | retained updates | paint 448 + states 66 runs |
| Events `mdClick` (DOM `MouseEvent` → native record `{type, button, clientX, clientY, detail, isTrusted}`), `mdDragStart` (cancelable), `mdDragMove`, `mdDragEnd` (`MdCardDragDetail`) | 4 | `AWCNativeEvent` | `AWCEvent` | event log; live hosts (click, drag) | states + lifecycle (`authored-pointer-trusted-touch`, start-cancel, re-entrant moves) |
| Default slot | 1 | slot view | slot lambda | text slot editor | authored content cases (`NativeCardAwcContentTest`) |
| Parts `state-layer`, `outline` | 2 | `AWCCardPart` | `AWCCardPart` | Styles panel | paint part cases |
| Hooks | 14 | `AWCCardAppearance` | `AWCCardAppearance` | `card-appearance.js` | all 14 in `card-web-paint.json` |
| `:host([hidden])` | — | handled | handled | — | hidden cases (both) |
| `cursor` (pointer, grab, grabbing, default) | — | **none** | **none** | — | **none** |
| `aria-grabbed` (drag-enabled) | — | **none** | **none** | — | **none** |
| `@media (forced-colors)` (ButtonFace/ButtonText border, GrayText disabled, no state layer) | — | **none** | **none** | — | **none** |
| `@media (prefers-reduced-motion)` | — | handled | handled | — | `card-web-states-reduced` |

## Exception decisions

| Difference listed in `md-card.md` | Decision |
| --- | --- |
| Cursor and `aria-grabbed` "not mapped yet" | **Rejected** (implementable: macOS `NSCursor` / SwiftUI `pointerStyle` (macOS 15+) or an `NSTrackingArea` cursor rect, iPadOS `.hoverEffect`/pointer style, Compose `Modifier.pointerHoverIcon(PointerIcon.Hand/…)`; grabbed state as an accessibility value/state description). r3-09. |
| Android touch click after a 30-point in-bounds move (Chrome cancels) | **Rejected** (implementable: cancel the click once the pointer passes touch slop / the move threshold Chrome uses, as the Compose drag path already tracks). r3-10. |
| SwiftUI multi-line authored text half-leading | Accepted as an explained raster/typography difference of authored children (gate 5 "explain platform raster differences"), not an exception. |
| Compose pointer input does not focus authored buttons | Accepted as the Android touch-mode convention (focus follows keyboard input mode), not an exception. |
| z-index 1000 while dragging is local to the container | **Rejected** — same class as the accordion floating panel: implementable through a window-level overlay ordered by z-index. r3-19. |

## Re-run counts (claimed → r3)

| Suite | Claimed (latest) | r3 | Job |
| --- | --- | --- | --- |
| macOS `NativeCardPaintIntegration` | 6,912/6,912 | **6,912/6,912** | `r3-009` |
| macOS `NativeCardStatesIntegration` | 171,114 (frame-dependent) | **174,718/174,718** | `r3-009` |
| macOS `NativeCardLifecycleIntegration` | 32/32 | **32/32** | `r3-009` |
| Android paint / interaction / lifecycle | 6,699 / 55,810 / 29 | **6,699 / 55,810 / 29** | `r3-A001` |
| Android `NativeCardAwcContentTest`, `LivePreviewCardHostTest` | pass | **2/2, 1/1** | `r3-A001` |
| SwiftUI live host `test-live-card.mjs` | 24/24 | **pass** | `r3-0106` |
| iOS paint / states / lifecycle (iPhone 17 Pro, iOS 26.3, AWC-r3) | 195,467/195,470 (3 open) | **6,912/6,912 · 181,903/181,905 (run 1), 189,179/189,182 (run 2) · 32/32** — failures only `dragClick-*/clickPress` flat pixels (worst 20–25 levels at x≈363) | `r3-011`, `r3-013` |
| iOS 18.6 (iPhone 16 Pro, AWC-r3-18) / iPad Pro 11-inch (M5) iOS 26.3 (AWC-r3-ipad) | 187,814/187,815 / 197,469/197,471 | **6,912/6,912 · 179,932/179,933 · 32/32** (1 failing check) / **6,912/6,912 · 189,427/189,539 · 32/32** (112 failing checks) | `r3-014` |
| Swift / Kotlin examples | 28 / 28 | **28 typecheck, 0 errors / 28 compile** | `r3-010`, `r3-A007` |
| tools/ax static, interactive, disabled | pass ×3 | **pass** ×3 (0 open; iOS 40 pt target reported as info) | `r3-0107`, `r3-A009` |

## Laboratory (gate 3)

`lab-probe.mjs` (`r3-0105`): SwiftUI and Compose sessions open; `update {variant:"outlined"}` 200 on both. No methods.

## Accessibility (gate 6)

tools/ax re-run (`work/audit/r3/out/ax/md-card/report.md`): the authored button "Explore workspace" and the card text match Web on
macOS, iOS and Android in all three cases; Tab walks match up to Web's stops (iOS leaves the component after the first stop, which
the comparator accepts). The disabled card is exempt from contrast as an inactive component.

## Findings

- **r3-07** (gates 2, 5) forced colours not implemented or tested.
- **r3-09** (gate 2) CSS cursor and `aria-grabbed` not mapped.
- **r3-10** (gate 4) Android keeps a touch click after a 30-point in-bounds move (Chrome cancels).
- **r3-11** (gate 6) iOS `dragClick` scenario: `clickPress` flat-pixel failures on every runtime (iPhone 26.3: 2 and 3 checks in two runs; iOS 18.6: 1; iPad 26.3: 2), and on iPad one `dragClick-outlined-light-ltr` run kept the second press's ripple at its 0.12 peak instead of fading (110 per-frame ripple opacity/scale checks).
- **r3-19** (gate 2) dragged card z-order local to its container.
- **r3-21** (gate 7) released policy notes still say iOS/VoiceOver execution is unverified.

Defect rows with evidence paths and suggested fixes: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate-7 reviewer r3". Evidence: `work/audit/r3/` (runner logs `work/claude-runner/done/r3-*.log`); progress `work/audit/r3/PROGRESS.md`.
