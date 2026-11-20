# `md-progress-indicator` — gate 7 independent audit

**Verdict (re-check 2026-11-05): PASS WITH ACCEPTED EXCEPTIONS (E3)**

R2-D4 (default palette) and R2-D9 (Android open-after-close) are verified. Every suite passes on macOS, all three iOS runtimes and Android.

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
| 1 Source contract | PASS | 14 properties, `mdComplete`, 13 hooks, 3 parts: complete |
| 2 Implementation | PASS | Wave paths, four-colour cycling, completion |
| 3 Laboratory | PASS | Retained updates on both platforms; 20/20 Android open-after-close sequences (R2-D9); 20+20 examples compile |
| 4 Behaviour | PASS | Web 193/193; Swift 51 contracts; Android 6 unit + 13 device methods |
| 5 Visual | PASS | Fresh default palette (92 configurations per theme incl. the four-colour roles, no injection): Swift 4,580 checks in total, Android `all184PristineDefaultPaletteCasesMatchWithoutTokenInjection` |
| 6 Runtime + AX | PASS | macOS, three iOS runtimes, Android; tools/ax 3 cases, 0 open on macOS, iOS and Android |
| 7 Final audit | PASS WITH ACCEPTED EXCEPTIONS | E3 |

## Re-check of the 2026-10-31 findings

- **R2-D4 — VERIFIED.** `progress-web-default-{light,dark}.json` carry the library maps (49/49 roles; dark secondary-container #4A4458, not the Laboratory #d5e8df). The Swift default pass sets `state.tokens=[:]`, and the Android pristine test passes.
- **R2-D9 — VERIFIED** (non-blocking): 20/20 meter → progress open-after-close sequences on the Android Laboratory host (`../../../../audit/r2/runs2/lab/r2d9.json`); `android-live.mjs` now waits until the closed host's token stops answering.

## Gate 1 — source contract matrix

Re-run of `work/audit/r2/tools/contract.py` and `tools/matrix.mjs` on `r2-tree2`: the catalog's source hash (sha256 of TSX + CSS) matches, and all 31 contract rows have a SwiftUI and a Compose implementation, Laboratory exposure and tests (zero cells were checked by hand).

## Re-run counts (2026-11-05)

| Suite | Recorded / first audit | r2 re-check | Job |
|---|---|---|---|
| Web spec + axe + frames | 193 | 193/193 | r2-A023 |
| Swift macOS | 2,808 → 4,580 (d2-007) | 4580/4580 | r2-022 |
| iOS ×3 runtimes | 4580 (d2-012, iPhone) | 4580/4580 ×3 | r2-025 |
| Swift live host | 39 | 39/39 | r2-024 |
| Android device: Parity (6), PathOracle (4), host (2), generic max (1) | 5 + 4 + 2 + 1 | 6/6 + 4/4 + 2/2 + 1/1 | r2-A021 |
| Android unit | 6 | 6/6 | r2-A021 |
| Examples | 20 + 20 | Swift macOS + iOS-sim typecheck, Kotlin compile | r2-024, r2-025, r2-A021 |
| tools/ax | 0 open | 0 open on all three native platforms (Android in 2 batched runs) | r2-026, r2-A026 |

## Gate 3 — Laboratory

Sessions open on both platforms; the retained `update` returns 200 and a new frame revision on SwiftUI and Compose (`../../../../audit/r2/runs2/lab/lab-probe.json`, r2-A022). There are no methods.

## Gate 6 — runtime and accessibility

tools/ax: [`../../../../audit/r2/runs2/ax2/md-progress-indicator/report.md`](../../../../audit/r2/runs2/ax2/md-progress-indicator/report.md) — 3 cases, captured with Chrome 153 (Web), the macOS host, the iOS 26.3 probe on AWC-r2 (r2-026) and Android (r2-A026, two full batches): 0 open findings.

## Exception decisions

**E3 — Extreme-input representable bounds — ACCEPTED (unchanged from 2026-10-31).** Lengths beyond the platform's representable layout range (Compose constraints 32,766 px; SwiftUI bounded at Chrome's measured 16,777,214) saturate, and inspection reports the applied geometry; the source itself saturates. There is no impact at representable sizes.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

None open.

## History

2026-10-31: FAIL (gate 5, R2-D4; R2-D9 non-blocking). 2026-11-05: R2-D4 and R2-D9 verified → PASS WITH ACCEPTED EXCEPTIONS.
