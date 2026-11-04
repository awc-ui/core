# Gate 7 audit — `md-ripple`

Reviewer: gate-7 reviewer r3, 2026-10-31. Independent of the implementing forks; no product code changed.

**Verdict: PASS** — every gate is met by current evidence re-run on the canonical snapshot; no exception is needed and no finding is open.

## Method

- Snapshot `work/audit/r3-tree` (job `r3-002`, 2026-10-31 02:12 EET, 42 install jobs, newest `fx-072-install-orgchart-apk`).
- Contract: `packages/core/src/components/md-ripple/` + regenerated inventory (`r3-006`): 1 property (`disabled`), 2 methods
  (`trigger`, `whenSettled`), 6 hooks, no events/slots/parts — unchanged from baseline.
- `outputs/native-parity/md-ripple/native/checkpoint.json` carries no file hashes; the r3 re-runs are the current evidence.

## Gate checklist

| Gate | Result | Evidence |
| --- | --- | --- |
| 1 Source contract | pass | matrix below; source review decisions (200 ms `whenSettled` bound, px-only extents, Chrome easing grammar) reflected in both renderers |
| 2 Implementation | pass | `NativeRipple.swift` (`.awcRipple`, `AWCRippleController`), `AWCRipple.kt` (`Modifier.awcRipple`, `AWCRippleControllerScope`); suppression (`--md-sys-ripple-enabled`), hidden, disabled, window/scene loss |
| 3 Laboratory | pass | `ripple-appearance.js` 6 hooks; `disabled` retained update and both methods through the 4177 server on both platforms; 8+8 examples |
| 4 Behaviour | pass | 21 behaviour scenarios (macOS), 27 (Android) incl. replacement waves, cycle-scoped waiters, foreign second finger |
| 5 Visual | pass | 160 paint frames + 8 motion configs vs Mac Chrome 153 (light/dark, LTR/RTL, radii, extents) |
| 6 Runtime + a11y | pass | ripple is `aria-hidden`; tools/ax shows one named button (the recipe surface) on every platform |
| 7 Final audit | PASS | this document |

## Source contract matrix

| Member | SwiftUI | Compose | Laboratory | Test |
| --- | --- | --- | --- | --- |
| `disabled` (false) | `.awcRipple(disabled:)` / node property | `Modifier.awcRipple(disabled)` | retained update (probe: 200 on both) | `NativeRippleIntegration` disabled scenarios; `NativeRippleParityTest` |
| `trigger()` | `AWCRippleController.trigger` | `AWCRippleController.trigger` | method button (probe: 200 on both) | behaviour fixtures, live hosts |
| `whenSettled()` (200 ms bound) | `async whenSettled` | `suspend whenSettled` | method button (probe: 200 on both) | behaviour fixtures (cycle-scoped waiters) |
| 6 hooks (color, opacity, extend-inline/-block, grow-duration/-easing) | `AWCRippleAppearance` | `AWCRippleAppearance` | `ripple-appearance.js` | paint/motion oracle hook cases (all 6 present in `ripple-web-*`) |
| `--md-sys-ripple-enabled` | theme token / `awcRippleEnabled` | theme token / `LocalAWCRippleEnabled` | theme | suppression scenarios (both suites) |
| `:host([hidden])` | wave tracked, nothing painted | same | — | `hiddenPress` scenario |

No exception is proposed. The source has no reduced-motion or forced-colours rule for the ripple.

## Re-run counts (claimed → r3)

| Suite | Claimed | r3 | Job |
| --- | --- | --- | --- |
| macOS `NativeRippleIntegration` | 1,790/1,790 | **1,790/1,790** | `r3-009` |
| Android `NativeRippleParityTest` paint / motion / behaviour | 1,103 / 24 / 27 | **1,103 / 24 / 27** | `r3-A001` |
| Android `LivePreviewRippleHostTest` | 1/1 | **1/1** | `r3-A001` |
| SwiftUI live host `test-live-ripple.mjs` | 13/13 | **13/13** | `r3-0106` |
| iOS `NativeRippleIntegration` (iPhone 17 Pro, iOS 26.3, AWC-r3) | 1,785/1,785 | **1,785/1,785** | `r3-011` |
| iOS 18.6 (iPhone 16 Pro, AWC-r3-18) / iPad Pro 11-inch (M5) iOS 26.3 (AWC-r3-ipad) | 1,785/1,785 / 1,785/1,785 | **1,785/1,785** / **1,785/1,785** | `r3-014` |
| Swift / Kotlin examples | 8 / 8 | **8 typecheck, 0 errors / 8 compile** | `r3-010`, `r3-A007` |
| Studio focused (9 suites incl. `ripple-integration.test.mjs`) / full | 36/36 (ripple set) | **95/95 / 807/807** | `r3-0108` |
| tools/ax default, disabled | pass ×3 | **pass** on macOS, iOS, Android (0 open) | `r3-0107`, `r3-A009` |

## Laboratory (gate 3)

`lab-probe.mjs` (job `r3-0105`): sessions open on SwiftUI and Compose; `update {disabled:true}` 200; `trigger()` 200 and
`whenSettled()` 200 on both. Live host suites above.

## Accessibility (gate 6)

tools/ax re-run (`work/audit/r3/out/ax/md-ripple/report.md`): every platform exposes exactly one button "Tap to see the ripple"
(the recipe surface); the ripple adds no element or text (`aria-hidden` on Web, accessibility-hidden natively). macOS and Android
Tab orders match Web; on iOS the walk reaches the button and then leaves the component (∅), which the comparator accepts
(Web has one stop). No expectation entry is involved.

## Findings

None. Observation (not a finding): the iOS Tab walk after the first stop belongs to the shared UIKit focus bridge, not to md-ripple.

Defect rows with evidence paths and suggested fixes: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate-7 reviewer r3". Evidence: `work/audit/r3/` (runner logs `work/claude-runner/done/r3-*.log`); progress `work/audit/r3/PROGRESS.md`.
