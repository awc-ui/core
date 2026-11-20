# `md-loading-indicator` — gate 7 independent audit

**Verdict (re-check 2026-11-06): PASS**

R2-D11 is verified fixed (with R2-D2 and R2-D6 verified on 11-05). Every suite passes on macOS, all iOS simulators and accessibility-runtime states, and Android; no exceptions are needed.

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
| 1 Source contract | PASS | 3 properties, 5 hooks, part `shape`: complete |
| 2 Implementation | PASS | Polygons, 4.55 s morph, reduced motion; the hidden host clears inspection and semantics |
| 3 Laboratory | PASS | Retained updates on SwiftUI and Compose (re-probed r2-A041); the morph keeps running across updates; 15+15 examples compile |
| 4 Behaviour | PASS | `NativeLoadingIndicatorViewIntegration` 2392/2392 on macOS ×3 and all iOS runs; Web 23/23; Android 5 unit + 10 device methods |
| 5 Visual | PASS | Recorded matrices + fresh default palette (no injection) on Swift and Android |
| 6 Runtime + AX | PASS | macOS; iPhone 17 Pro 26.3 (`AWC-r2` and a fresh simulator), iPad Pro 26.3 and iPhone 16 Pro 18.6, each under the accessibility runtime "voiceover" (AccessibilityEnabled + ApplicationAccessibilityEnabled on) and "automation" (all on); Android; tools/ax 2 cases, 0 open on macOS, iOS and Android |
| 7 Final audit | PASS | — |

## Re-check of the open findings

- **R2-D11 — VERIFIED.** d2-036 replaced the `EmptyView()` of a hidden root host with `AWCHiddenHost`, which publishes an empty root inspection (a 0×0 `Color.clear.awcInspectionAbsent().accessibilityHidden(true)`; nested hidden hosts stay `EmptyView`). On the refreshed snapshot the unmodified fixtures pass on macOS in 3 of 3 runs and on every iOS simulator and runtime state. The r2 diagnostic copy (`work/audit/r2/diag3`, job r2-043) now prints `inspectionNodeAbsent=true responderAbsent=true nodes=[]` after hide, where on 11-05 it printed the stale nodes. The shared change does not regress the other r2 components: Progress, Skeleton, Snackbar, Tooltip, List tooltip, Badge and Status Dot all pass on macOS and iOS, and `NativeCursorHiddenIntegration` passes 56/56 (r2-041, r2-042).
- R2-D2 (default palette) and R2-D6 (in-place updates, morph retention): verified 2026-11-05 and still passing (below).

## Gate 1 — source contract matrix

Re-run of `work/audit/r2/tools/contract.py` and `tools/matrix.mjs` on `r2-tree2`: the catalog's source hash (sha256 of TSX + CSS) matches, and all 9 contract rows have a SwiftUI and a Compose implementation, Laboratory exposure and tests (zero cells were checked by hand).

## Re-run counts (2026-11-06)

| Suite | Recorded / first audit | r2 re-check | Job |
|---|---|---|---|
| Swift macOS `NativeLoadingIndicatorViewIntegration` | 2,392 (d2-028/037) | 2392/2392 ×3 | r2-041 |
| iOS: AWC-r2 / fresh iPhone 26.3 / iPad 26.3 / iPhone 18.6, voiceover + automation | 2392 | 2392/2392 in all 8 runs (4 simulators × voiceover + automation), 0 FAIL | r2-042 |
| r2 diagnostic (hide) | — | inspection absent, responder absent, nodes [] | r2-043 |
| Swift live hosts `test-live-loading-indicator` / communication updates | 9 / 42 | 9/9, 42/42 | r2-041 |
| Android device: Parity (4), host (1), communication host (5) | 5 + 5 | 4/4 + 1/1 + 5/5 | r2-A040 |
| Android unit `NativeLoadingIndicatorContractTest` | 5 | 5/5 | r2-A040 |
| Laboratory probe (SwiftUI, Compose) | — | open 200, retained update 200, frame 200 | r2-A041 |
| tools/ax | 0 open | 0 open on all three native platforms | r2-043, r2-A042 |
| Generated examples (regenerated 11-06, byte-identical) | 15 + 15 | Swift macOS + iOS-sim typecheck, Kotlin compile | r2-043, r2-A042 |
| Web spec, Studio (11-05; component TSX/CSS hashes unchanged since) | 23; 59/174 | 23/23; 59/59, 174/174 | r2-A023 |

## Gate 3 — Laboratory

Sessions open on SwiftUI and Compose through the Laboratory server (restarted by d2-036). The retained `update` returns 200 and the next frame advances (`../../../../audit/r2/runs3/lab/lab-probe.json`, r2-A041). There are no methods.

## Gate 6 — runtime and accessibility

tools/ax: [`../../../../audit/r2/runs3/ax/md-loading-indicator/report.md`](../../../../audit/r2/runs3/ax/md-loading-indicator/report.md): 2 cases with Chrome 153 (Web), the macOS host (valid AX trees, r2-043), the iOS 26.3 probe on AWC-r2 (r2-043) and Android (r2-A042): 0 open findings.

## Exception decisions

None needed.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

None open.

## History

2026-10-31: FAIL (gates 3, 5: R2-D2, R2-D6). 2026-11-05: R2-D2 and R2-D6 verified; new regression R2-D11 → FAIL. 2026-11-06: R2-D11 verified → PASS.
