# `md-meter` — gate 7 independent audit

**Verdict (re-check 2026-11-06): PASS WITH ACCEPTED EXCEPTIONS (E2 Android Arabic fallback width; E3; E4 iOS meter-as-text)**

R2-D11 is verified fixed (with R2-D3 and R2-D6 verified on 11-05). Every suite passes on macOS, all iOS simulators and accessibility-runtime states, and Android.

Reviewer: gate-7 reviewer r2. First audit 2026-10-31; re-check 2026-11-05 (R2-D1…D9); re-check 2026-11-06 (R2-D11, R2-D12, fixed by d2 in
main-queue job d2-036). Independent of the implementing forks; no product code, tests or fixtures were changed (diagnostics ran on r2-only
copies in `work/audit/r2/diag3`).

Re-check snapshot (2026-11-06 22:20 UTC, job `r2-040-snapshot3`): `work/audit/r2-tree2` refreshed from canonical with rsync --delete (86 install
jobs present, latest `d4-064-install-r4b`; the three d2-036 files are byte-identical with canonical; no git commands). Runtimes: macOS 15.6.1, Swift 6.1.2;
iOS simulators iPhone 17 Pro 26.3.1 (`AWC-r2`), a fresh iPhone 17 Pro 26.3.1 created and deleted by the job, iPad Pro 11-inch (M5) 26.3.1, iPhone 16 Pro
18.6, each run under explicit accessibility-runtime states (`AWC_IOS_AX_RUNTIME` voiceover / automation / off, written and logged by
`run-fixture.sh` before every launch); Android 16 / API 36 `emulator-5564`; Chrome 153 for tools/ax. Timing-sensitive runs used
`tools/slot.sh timing 4`, and simulators were shut down on exit. Raw outputs: [`work/audit/r2/runs3`](../../../../audit/r2/runs3) (earlier: [`runs2`](../../../../audit/r2/runs2),
[`runs`](../../../../audit/r2/runs)); job logs `work/audit/r2/runs3/<job>.log` and [`claude-runner/done/r2-*`](../../../../claude-runner/done).

## Gates

| Gate | Result | Basis |
|---|---|---|
| 1 Source contract | PASS | 14 properties, 7 hooks, 5 parts: complete |
| 2 Implementation | PASS | Native Intl/ICU formatting, RTL, value glide; the hidden host clears inspection and semantics |
| 3 Laboratory | PASS | Retained updates on SwiftUI and Compose (4177 restarted by d2-036, re-probed: r2-A041); glide host tests pass; 24+24 examples compile |
| 4 Behaviour | PASS | `NativeMeterViewIntegration` 5085/5085 on macOS ×3 and all iOS runs; Web 51/51; Android 3 unit + 8 device methods |
| 5 Visual | PASS | Recorded matrices + fresh default palette (no injection) on Swift and Android |
| 6 Runtime + AX | PASS | macOS; iPhone 17 Pro 26.3 (`AWC-r2` and a fresh simulator), iPad Pro 26.3 and iPhone 16 Pro 18.6, each under the accessibility runtime "voiceover" (AccessibilityEnabled + ApplicationAccessibilityEnabled on) and "automation" (all on); Android; tools/ax 3 cases, 0 open on macOS, iOS and Android; iOS 3 accepted (E4) |
| 7 Final audit | PASS WITH ACCEPTED EXCEPTIONS | E2, E3, E4 |

## Re-check of the open findings

- **R2-D11 — VERIFIED.** d2-036 replaced the `EmptyView()` of a hidden root host with `AWCHiddenHost`, which publishes an empty root inspection (a 0×0 `Color.clear.awcInspectionAbsent().accessibilityHidden(true)`; nested hidden hosts stay `EmptyView`). On the refreshed snapshot the unmodified fixtures pass on macOS in 3 of 3 runs and on every iOS simulator and runtime state. The r2 diagnostic copy (`work/audit/r2/diag3`, job r2-043) now prints `inspectionNodeAbsent=true responderAbsent=true nodes=[]` after hide, where on 11-05 it printed the stale nodes. The shared change does not regress the other r2 components: Progress, Skeleton, Snackbar, Tooltip, List tooltip, Badge and Status Dot all pass on macOS and iOS, and `NativeCursorHiddenIntegration` passes 56/56 (r2-041, r2-042).
- R2-D3 (default palette) and R2-D6 (in-place updates, value glide): verified 2026-11-05 and still passing (below).

## Gate 1 — source contract matrix

Re-run of `work/audit/r2/tools/contract.py` and `tools/matrix.mjs` on `r2-tree2`: the catalog's source hash (sha256 of TSX + CSS) matches, and all 26 contract rows have a SwiftUI and a Compose implementation, Laboratory exposure and tests (zero cells were checked by hand).

## Re-run counts (2026-11-06)

| Suite | Recorded / first audit | r2 re-check | Job |
|---|---|---|---|
| Swift macOS `NativeMeterViewIntegration` | 5,085 (d2-028/037) | 5085/5085 ×3 | r2-041 |
| iOS: AWC-r2 / fresh iPhone 26.3 / iPad 26.3 / iPhone 18.6, voiceover + automation | 5085 | 5085/5085 in all 8 runs (4 simulators × voiceover + automation), 0 FAIL | r2-042 |
| r2 diagnostic (hide) | — | inspection absent, responder absent, nodes [] | r2-043 |
| Swift live hosts `test-live-meter` / communication updates | 19 / 42 | 19/19, 42/42 | r2-041 |
| Android device: Parity (5), Format (2), host (1), communication host (5) | 8 + 5 | 5/5 + 2/2 + 1/1 + 5/5 | r2-A040 |
| Android unit `NativeMeterContractTest` | 3 | 3/3 | r2-A040 |
| Laboratory probe (SwiftUI, Compose) | — | open 200, retained update 200, frame 200 | r2-A041 |
| tools/ax | 0 open (iOS 3 accepted) | 0 open on all three native platforms; iOS 3 accepted (E4) | r2-043, r2-A042 |
| Generated examples (regenerated 11-06, byte-identical) | 24 + 24 | Swift macOS + iOS-sim typecheck, Kotlin compile | r2-043, r2-A042 |
| Web spec, Studio (11-05; component TSX/CSS hashes unchanged since) | 51; 59/174 | 51/51; 59/59, 174/174 | r2-A023 |

## Gate 3 — Laboratory

Sessions open on SwiftUI and Compose through the Laboratory server (restarted by d2-036). The retained `update` returns 200 and the next frame advances (`../../../../audit/r2/runs3/lab/lab-probe.json`, r2-A041). There are no methods.

## Gate 6 — runtime and accessibility

tools/ax: [`../../../../audit/r2/runs3/ax/md-meter/report.md`](../../../../audit/r2/runs3/ax/md-meter/report.md): 3 cases with Chrome 153 (Web), the macOS host (valid AX trees, r2-043), the iOS 26.3 probe on AWC-r2 (r2-043) and Android (r2-A042): 0 open findings; iOS 3 accepted (E4).

## Exception decisions

**E2 — Android Arabic fallback glyph width — ACCEPTED (unchanged):** Noto Naskh 16 dp versus Chrome/Geeza Pro 19.33 px; the string, line box and placement are checked.

**E4 — iOS meter exposed as static text with its value — ACCEPTED (unchanged):** UIKit has no meter or level-indicator trait.

**E3 — Extreme-input representable bounds — ACCEPTED (unchanged from 2026-10-31).** Lengths beyond the platform's representable layout range (Compose constraints 32,766 px; SwiftUI bounded at Chrome's measured 16,777,214) saturate, and inspection reports the applied geometry; the source itself saturates. There is no impact at representable sizes.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

None open.

## History

2026-10-31: FAIL (gates 3, 5: R2-D3, R2-D6). 2026-11-05: R2-D3 and R2-D6 verified; new regression R2-D11 → FAIL. 2026-11-06: R2-D11 verified → PASS WITH ACCEPTED EXCEPTIONS.
