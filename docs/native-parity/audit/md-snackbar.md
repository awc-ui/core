# `md-snackbar` — gate 7 independent audit

**Verdict (re-check 2026-11-05): PASS WITH ACCEPTED EXCEPTIONS (E5)**

R2-D7 is verified: the component checkpoint doc exists and its links resolve. Every suite passes on macOS, all three iOS runtimes and Android.

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
| 1 Source contract | PASS | 11 properties, 3 events, show()/hide(reason), 3 slots, 7 hooks, 5 parts: complete |
| 2 Implementation | PASS | Root scope, positions, timers, peers, motion |
| 3 Laboratory | PASS | Retained update; `show()` / `hide("action")` accepted and fulfilled, `mdClose {"reason":"action"}` delivered on both platforms; 38+38 examples compile |
| 4 Behaviour | PASS | Web 80/80; Swift controller 27; Android 12 unit + 13 device methods |
| 5 Visual | PASS | Font-only default-token fixtures, no injection (Swift); Android `all122PristineDefaultPaletteCasesPaintWithoutInjectedTokens` |
| 6 Runtime + AX | PASS | macOS, three iOS runtimes, Android; tools/ax 3 cases, 0 open on macOS, iOS and Android; iOS 40 px touch targets reported as info (source size) |
| 7 Final audit | PASS WITH ACCEPTED EXCEPTIONS | E5 |

## Re-check of the 2026-10-31 findings

- **R2-D7 — VERIFIED.** `docs/native-parity/md-snackbar.md` (installed by d2-003) contains the contract table, the executed evidence with the r2 counts, the full E5 exception record (every field of the policy) and the gate-6 section. The AUDIT row link, the `#ios-simulator-execution-gate-6` anchor, the platform-audit links, `audit/md-snackbar.md` and the accessibility report link all resolve. Its statements match today's re-run: no token injection in the Swift oracle, and the counts below.

## Gate 1 — source contract matrix

Re-run of `work/audit/r2/tools/contract.py` and `tools/matrix.mjs` on `r2-tree2`: the catalog's source hash (sha256 of TSX + CSS) matches, and all 31 contract rows have a SwiftUI and a Compose implementation, Laboratory exposure and tests (zero cells were checked by hand).

## Re-run counts (2026-11-05)

| Suite | Recorded / first audit | r2 re-check | Job |
|---|---|---|---|
| Web spec + axe | 80 | 80/80 | r2-A023 |
| Swift macOS view / controller | 2,987 / 27 | 2987/2987, 27/27 | r2-022 |
| iOS ×3 runtimes | 2987 + 27 ×3 | 2987 + 27 ×3, 0 FAIL | r2-025 |
| Swift live host | 51 | 51/51 | r2-024 |
| Android device: Parity 4, Parts 2, Interaction 2, Motion 1, host 4 | 13 | 13/13; presentation slot test passed | r2-A021 |
| Android unit | 12 | 12/12 | r2-A021 |
| Examples | 38 + 38 | Swift macOS + iOS-sim typecheck, Kotlin compile | r2-024, r2-025, r2-A021 |
| tools/ax | 0 open | 0 open on all three native platforms; iOS 40 px touch targets reported as info (source size) (Android in 2 batched runs) | r2-026, r2-A026 |

## Gate 3 — Laboratory

Sessions open on both platforms (`mdOpen null`); the retained `update` returns 200 and a new frame revision on SwiftUI and Compose (`../../../../audit/r2/runs2/lab/lab-probe.json`, r2-A022). Methods: `show()` → accepted → fulfilled; `hide("action")` → fulfilled with `mdClose {"reason":"action"}`.

## Gate 6 — runtime and accessibility

tools/ax: [`../../../../audit/r2/runs2/ax2/md-snackbar/report.md`](../../../../audit/r2/runs2/ax2/md-snackbar/report.md) — 3 cases, captured with Chrome 153 (Web), the macOS host, the iOS 26.3 probe on AWC-r2 (r2-026) and Android (r2-A026, two full batches): 0 open findings; iOS 40 px touch targets reported as info (source size).

## Exception decisions

**E5 — Overlay ownership and authored announcement labels — ACCEPTED (unchanged; the record is now in `docs/native-parity/md-snackbar.md`).** There is one root scope per native window/scene instead of the document overlay, and an arbitrary native slot view needs an `accessibilityLabel` because there is no DOM textContent.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

None open.

## History

2026-10-31: FAIL (documentation only, R2-D7). 2026-11-05: R2-D7 verified → PASS WITH ACCEPTED EXCEPTIONS.
