# `md-status-dot` — gate 7 independent audit

**Verdict (re-check 2026-11-05): PASS**

R2-D5 (default palette) and R2-D6 (in-place updates and state colour transition) are verified fixed. Every suite passes on macOS, all three iOS runtimes and Android, and no exceptions are needed.

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
| 1 Source contract | PASS | 7 properties, 8 hooks, no events/methods/slots/parts: complete |
| 2 Implementation | PASS | Anchoring, inline, pulse, 200 ms state colour transition |
| 3 Laboratory | PASS | Retained updates; the state colour transition passes through intermediate colours across an update (SwiftUI host; Android `statusDotColourTransitionsAcrossARetainedUpdate`); invalid patches are rejected; 11+11 examples compile |
| 4 Behaviour | PASS | Web 36/36; Swift 1,687 contracts; Android 5 unit + 5 device methods |
| 5 Visual | PASS | Fresh default palette (100 configurations per theme, library tokens, `state.tokens = [:]`): Swift 1,997 actual checks, Android `all200PristineDefaultPaletteCasesMatchWithoutTokenInjection` |
| 6 Runtime + AX | PASS | macOS, three iOS runtimes, Android; tools/ax 3 cases, 0 open on macOS, iOS and Android |
| 7 Final audit | PASS | — |

## Re-check of the 2026-10-31 findings

- **R2-D5 — VERIFIED.** `StatusDotWebDefault-{light,dark}.json` carry the library maps (49/49 colour roles equal `tokens.json`; the old dark map had light values). The default documents are compared without injection on Swift (macOS + iOS ×3) and Android.
- **R2-D6 — VERIFIED.** Retained updates on both hosts, and the transition is observable across an update.

## Gate 1 — source contract matrix

Re-run of `work/audit/r2/tools/contract.py` and `tools/matrix.mjs` on `r2-tree2`: the catalog's source hash (sha256 of TSX + CSS) matches, and all 15 contract rows have a SwiftUI and a Compose implementation, Laboratory exposure and tests (zero cells were checked by hand).

## Re-run counts (2026-11-05)

| Suite | Recorded / first audit | r2 re-check | Job |
|---|---|---|---|
| Web spec + axe | 36 | 36/36 | r2-A023 |
| Swift macOS `test-native-status-dot.sh` | 1687 + 1001 (10-31) | 1687 + 1997 (incl. default palette) | r2-022 |
| iOS ×3 runtimes | 1687 + 1001 ×3 | 1687 + 1997 ×3, 0 FAIL | r2-025 |
| Swift live hosts | 15 / — | 15/15, communication updates 42/42 | r2-024 |
| Android device: Parity (4), host, communication host | 3 + 1 | 4/4 + 1/1 + 5/5 | r2-A021 |
| Android unit | 5 | 5/5 | r2-A021 |
| Examples | 11 + 11 | Swift macOS + iOS-sim typecheck, Kotlin compile | r2-024, r2-025, r2-A021 |
| tools/ax | 0 open | 0 open on all three native platforms (Android in 2 batched runs) | r2-026, r2-A026 |

## Gate 3 — Laboratory

Sessions open on both platforms; the retained `update` returns 200 and a new frame revision on SwiftUI and Compose (`../../../../audit/r2/runs2/lab/lab-probe.json`, r2-A022). There are no methods.

## Gate 6 — runtime and accessibility

tools/ax: [`../../../../audit/r2/runs2/ax2/md-status-dot/report.md`](../../../../audit/r2/runs2/ax2/md-status-dot/report.md) — 3 cases, captured with Chrome 153 (Web), the macOS host, the iOS 26.3 probe on AWC-r2 (r2-026) and Android (r2-A026, two full batches): 0 open findings.

## Exception decisions

None needed.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

None open.

## History

2026-10-31: FAIL (gates 3, 5: R2-D5, R2-D6). 2026-11-05: both verified fixed → PASS.
