# `md-skeleton` — gate 7 independent audit

**Verdict (re-check 2026-11-06): PASS WITH ACCEPTED EXCEPTIONS (E3; E4 busy-indicator role on macOS/iOS)**

R2-D12 is verified fixed: the empty authored label is now deterministic under every accessibility-runtime state, and its cause is identified. Every suite passes on macOS, all iOS simulators and states, and Android.

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
| 1 Source contract | PASS | 10 properties, 11 hooks, 3 parts: complete |
| 2 Implementation | PASS | Lengths, entrance/pulse/wave, reduced motion; an empty authored label stays empty natively |
| 3 Laboratory | PASS | Retained updates on SwiftUI and Compose (re-probed r2-A041); 27+27 examples compile |
| 4 Behaviour | PASS | Web 17/17; Android 14 unit + 6 device methods; live host 42/42 |
| 5 Visual | PASS | Recorded matrices + fresh default palette: Swift 1974/1974, Android 212 pristine cases |
| 6 Runtime + AX | PASS | macOS 3714/3714; iOS 24/24 runs pass across 4 simulators × voiceover/automation/off; Android; tools/ax 2 cases, 0 open on macOS, iOS and Android; macOS and iOS 1 accepted each (E4) |
| 7 Final audit | PASS WITH ACCEPTED EXCEPTIONS | E3, E4 |

## Re-check of the open findings

- **R2-D12 — VERIFIED.** Cause (d2's bisect, corroborated by r2): when the simulator's accessibility runtime is on (as with VoiceOver, Accessibility Inspector or the tools/ax probe; the setting persists per simulator), UIKit's accessibility bundle makes `UIActivityIndicatorView` report "In progress" for an empty label. This matches r2's own history: AWC-r2 passed on 10-31 before tools/ax ran on it, and failed afterwards, while the never-probed iPad and iOS 18.6 simulators passed. VoiceOver users would have heard it, so it was a real defect. Fix (d2-036): `AWCNativeSkeletonStatusView` overrides `accessibilityLabel` to return the authored label, including "". Since di-045 the harness writes the runtime state before every launch and logs it. r2 ran the unmodified fixture on 24 runs: 4 simulators (AWC-r2, a fresh iPhone 17 Pro 26.3, iPad Pro 26.3, iPhone 16 Pro 18.6) × 3 runtime states (voiceover, automation, off) × 2. All 24 pass (3724/3724 on iPhone, 3714/3714 on iPad), including the 16 runs with the accessibility runtime on, the state that failed 4 of 5 times on 11-05. macOS 3714/3714 and the default palette 1974/1974 also pass (r2-041).

## Gate 1 — source contract matrix

Re-run of `work/audit/r2/tools/contract.py` and `tools/matrix.mjs` on `r2-tree2`: the catalog's source hash (sha256 of TSX + CSS) matches, and all 24 contract rows have a SwiftUI and a Compose implementation, Laboratory exposure and tests (zero cells were checked by hand).

## Re-run counts (2026-11-06)

| Suite | Recorded / first audit | r2 re-check | Job |
|---|---|---|---|
| Swift macOS / default palette | 3,714 / 1,974 | 3714/3714, 1974/1974 | r2-041 |
| iOS skeleton runs by simulator and runtime state | 3724 (iPhone) / 3714 (iPad) | 24/24 runs pass: AWC-r2 3724 ×6, fresh iPhone 26.3 3724 ×6, iPad 26.3 3714 ×6, iPhone 18.6 3724 ×6 (each simulator: voiceover ×2, automation ×2, off ×2); 0 FAIL | r2-042 |
| Swift live host `test-live-skeleton` | 42 | 42/42 | r2-041 |
| Android device: Parity (4), host (2) | 4 + 2 | 4/4 + 2/2 | r2-A040 |
| Android unit | 14 | 13/13 + 1/1 | r2-A040 |
| Laboratory probe (SwiftUI, Compose) | — | open 200, retained update 200, frame 200 | r2-A041 |
| tools/ax | 0 open (1 accepted macOS/iOS) | 0 open on all three native platforms; macOS and iOS 1 accepted each (E4) | r2-043, r2-A042 |
| Generated examples (regenerated 11-06, byte-identical) | 27 + 27 | Swift macOS + iOS-sim typecheck, Kotlin compile | r2-043, r2-A042 |
| Web spec, Studio (11-05; component TSX/CSS hashes unchanged since) | 17; 59/174 | 17/17; 59/59, 174/174 | r2-A023 |

## Gate 3 — Laboratory

Sessions open on SwiftUI and Compose through the Laboratory server (restarted by d2-036). The retained `update` returns 200 and the next frame advances (`../../../../audit/r2/runs3/lab/lab-probe.json`, r2-A041). There are no methods.

## Gate 6 — runtime and accessibility

tools/ax: [`../../../../audit/r2/runs3/ax/md-skeleton/report.md`](../../../../audit/r2/runs3/ax/md-skeleton/report.md): 2 cases with Chrome 153 (Web), the macOS host (valid AX trees, r2-043), the iOS 26.3 probe on AWC-r2 (r2-043) and Android (r2-A042): 0 open findings; macOS and iOS 1 accepted each (E4).

## Exception decisions

**E4 — busy-indicator role on macOS/iOS — ACCEPTED (unchanged).**

**E3 — Extreme-input representable bounds — ACCEPTED (unchanged from 2026-10-31).** Lengths beyond the platform's representable layout range (Compose constraints 32,766 px; SwiftUI bounded at Chrome's measured 16,777,214) saturate, and inspection reports the applied geometry; the source itself saturates. There is no impact at representable sizes.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

None open. Harness note: the per-simulator accessibility-runtime state is now pinned by `run-fixture.sh` (di-045), which removes the hidden dependence on which simulator ran a gate-6 suite.

## History

2026-10-31: PASS WITH ACCEPTED EXCEPTIONS. 2026-11-05: R2-D12 found → FAIL. 2026-11-06: R2-D12 verified → PASS WITH ACCEPTED EXCEPTIONS.
