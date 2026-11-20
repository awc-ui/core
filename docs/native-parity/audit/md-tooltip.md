# `md-tooltip` — gate 7 independent audit

**Verdict (re-check 2026-11-05): PASS WITH ACCEPTED EXCEPTIONS (E4 Android description → live region; E3)**

R2-D8 (intermittent tools/ax Android focus) is verified: the cause was the probe, and the fixed probe gives 0 open findings in every run. Every suite passes on macOS, all three iOS runtimes and Android.

Reviewer: gate-7 reviewer r2. First audit 2026-10-31, re-check 2026-11-05 after fork d2 marked R2-D1…D9 fixed. Independent of the
implementing forks; no product code, tests or fixtures were changed (diagnostics ran on r2-only copies in `work/audit/r2/diag`).

Re-check snapshot: `work/audit/r2-tree2`, an rsync of the canonical tree taken 2026-11-05 19:43 UTC by job `r2-021-snapshot2` (77 install
jobs present, latest `di-032-install-key-repeat`; no git commands), build products rebuilt privately. Runtimes: macOS 15.6.1 arm64, Swift 6.1.2;
iOS simulators iPhone 17 Pro iOS 26.3.1 (`AWC-r2`), iPad Pro 11-inch (M5) iOS 26.3.1 (`AWC-r2-ipad`), iPhone 16 Pro iOS 18.6 (`AWC-r2-ios18`);
Android 16 / API 36 emulator `emulator-5564`; Chrome 153.0.8010.36 for tools/ax Web captures. Timing-sensitive suites ran through
`tools/slot.sh timing 4`; every simulator was shut down on job exit. Raw outputs: [`work/audit/r2/runs2`](../../../../audit/r2/runs2) (first audit:
[`runs`](../../../../audit/r2/runs)); job logs: [`claude-runner/done/r2-*`](../../../../claude-runner/done) and `work/audit/r2/runs2/<job>.log`.

Component sources (TSX/CSS) are unchanged since the first audit (same hashes) and the catalog matches them. Regenerated public
examples are byte-identical to the recorded ones.

## Gates

| Gate | Result | Basis |
|---|---|---|
| 1 Source contract | PASS | 12 properties, 2 events, show()/hide(), 4 slots, 11 hooks, 5 parts: complete |
| 2 Implementation | PASS | Overlay placement, delays, Escape, focus restoration |
| 3 Laboratory | PASS | Retained update; `show()`/`hide()` fulfilled with `mdOpen null`/`mdClose null` on both platforms; 42+42 examples compile |
| 4 Behaviour | PASS | Web 75/75; Swift controller 39; Android 14 unit + 13 device methods |
| 5 Visual | PASS | Default-token fixtures (Swift 2,600 + 7,156 supplemental, no injection); Android 204 default + 104 supplemental |
| 6 Runtime + AX | PASS | macOS, three iOS runtimes, Android; tools/ax 2 cases, 0 open on macOS, iOS and Android; Android 2 accepted (E4) |
| 7 Final audit | PASS WITH ACCEPTED EXCEPTIONS | E4, E3 |

## Re-check of the 2026-10-31 findings

- **R2-D8 — VERIFIED.** d2 traced it to the tools/ax Android probe, not the component: it sampled focus once, 250 ms after Tab, and could read the provider's FOCUS_INPUT node while Compose was still wrapping focus. The fixed probe (`AccessibilityProbeTest.kt`, d2-017/018) only counts a node that really holds focus and records focus once two reads 100 ms apart agree; a lasting focus loss is still recorded. This removes the failure because its cause is known (PARALLEL.md load-discipline rule). r2 re-run: Android 0 open in 5 of 5 runs (2 batched with all eight tags, 3 with Tooltip alone; r2-A026), with only the two accepted E4 entries.

## Gate 1 — source contract matrix

Re-run of `work/audit/r2/tools/contract.py` and `tools/matrix.mjs` on `r2-tree2`: the catalog's source hash (sha256 of TSX + CSS) matches, and all 36 contract rows have a SwiftUI and a Compose implementation, Laboratory exposure and tests (zero cells were checked by hand).

## Re-run counts (2026-11-05)

| Suite | Recorded / first audit | r2 re-check | Job |
|---|---|---|---|
| Web spec + dynamic | 75 | 75/75 | r2-A023 |
| Swift macOS controller / view / supplemental / list tooltip | 39 / 2,600 / 7,156 / 8 | 39/39, 2600/2600, 7156/7156, 8/8 | r2-022 |
| iOS ×3 runtimes (view + controller + list) | 2600 + 39 ×3 | 2600 + 39 + 8 ×3, 0 FAIL | r2-025 |
| Swift live host | 42 | 42/42 | r2-024 |
| Android device: Parity 4, Interaction 4, host 4, list tooltip 1 | 13 | 13/13; presentation text-slot test passed | r2-A021 |
| Android unit | 14 | 14/14 | r2-A021 |
| Examples | 42 + 42 | Swift macOS + iOS-sim typecheck, Kotlin compile | r2-024, r2-025, r2-A021 |
| tools/ax | Android 1 open in 1 of 3 runs (10-31) | 0 open on all three native platforms; Android 2 accepted (E4) (Android in 2 batched runs) | r2-026, r2-A026 |

## Gate 3 — Laboratory

Sessions open on both platforms; the retained `update` returns 200 and a new frame revision on SwiftUI and Compose (`../../../../audit/r2/runs2/lab/lab-probe.json`, r2-A022). Methods: `show()`/`hide()` accepted and fulfilled, with `mdOpen null` / `mdClose null`.

## Gate 6 — runtime and accessibility

tools/ax: [`../../../../audit/r2/runs2/ax2/md-tooltip/report.md`](../../../../audit/r2/runs2/ax2/md-tooltip/report.md) — 2 cases, captured with Chrome 153 (Web), the macOS host, the iOS 26.3 probe on AWC-r2 (r2-026) and Android (r2-A026, two full batches): 0 open findings; Android 2 accepted (E4). R2-D8 re-check: Android 0 open in 5 of 5 runs (2 batched with all eight tags, 3 with Tooltip alone; r2-A026), with only the two accepted E4 entries.

## Exception decisions

**E4 — Tooltip description on Android — ACCEPTED (unchanged):** Compose semantics have no description or tooltip-text channel, so the popup is announced as a polite live region when shown.

**E3 — Extreme-input representable bounds — ACCEPTED (unchanged from 2026-10-31).** Lengths beyond the platform's representable layout range (Compose constraints 32,766 px; SwiftUI bounded at Chrome's measured 16,777,214) saturate, and inspection reports the applied geometry; the source itself saturates. There is no impact at representable sizes.

The source's own transformed-ancestor placement limitation is a Web-source boundary, not a native gap.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

None open.

## History

2026-10-31: PASS WITH ACCEPTED EXCEPTIONS (R2-D8 non-blocking). 2026-11-05: R2-D8 verified → PASS WITH ACCEPTED EXCEPTIONS.
