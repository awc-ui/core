# `md-badge` — gate 7 independent audit

**Verdict (re-check 2026-11-05): PASS WITH ACCEPTED EXCEPTIONS (E1 emoji glyph advance; E3)**

R2-D1 (default paint) and R2-D6 (in-place updates) are verified fixed. Every suite passes on macOS, all three iOS runtimes and Android.

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
| 1 Source contract | PASS | 6 properties, slot `icon`, 10 hooks, 2 parts: complete |
| 2 Implementation | PASS | The error / on-error role selection is now verified against Web pixels in both themes |
| 3 Laboratory | PASS | Retained in-place updates on both platforms (value 8 → 42 widens the same badge from 16 to 22); 11+11 examples compile |
| 4 Behaviour | PASS | Web 64/64; Swift 264 contracts; Android 4 unit + 7 device methods |
| 5 Visual | PASS | 75 geometry cases plus the fresh default palette, light and dark (container/label/icon ink, no token injection): Swift 126 cases, Android `allDefaultPaletteCasesPaintLibraryContainerAndInkLightAndDark` |
| 6 Runtime + AX | PASS | macOS, iPhone 26.3, iPad 26.3, iPhone 18.6, Android; tools/ax 3 cases, 0 open on macOS, iOS and Android |
| 7 Final audit | PASS WITH ACCEPTED EXCEPTIONS | E1, E3 |

## Re-check of the 2026-10-31 findings

- **R2-D1 — VERIFIED.** The fresh Chrome 153 font-only captures `Tests/Fixtures/BadgeWebDefault-{light,dark}.json` (75 cases each) hold the library values (light container rgb(179,38,30) / ink #FFF; dark rgb(242,184,181) / rgb(96,20,16)). `NativeBadgeViewIntegration` compares 126 default-palette cases without injected colours on macOS and all three iOS runtimes, and Android `allDefaultPaletteCasesPaintLibraryContainerAndInkLightAndDark` passes.
- **R2-D6 — VERIFIED** (non-blocking for badge): retained updates work on both Laboratory hosts; `test-live-communication-updates.mjs` (42/42) and Android `LivePreviewCommunicationHostTest#badgeContentAndVariantAreRetainedUpdates` pass.

## Gate 1 — source contract matrix

Re-run of `work/audit/r2/tools/contract.py` and `tools/matrix.mjs` on `r2-tree2`: the catalog's source hash (sha256 of TSX + CSS) matches, and all 19 contract rows have a SwiftUI and a Compose implementation, Laboratory exposure and tests (zero cells were checked by hand).

## Re-run counts (2026-11-05)

| Suite | Recorded / first audit | r2 re-check | Job |
|---|---|---|---|
| Web spec | 64 | 64/64 | r2-A023 |
| Swift macOS `test-native-badge.sh` | 264 + 834 (10-31) | 264 + 1053 (incl. 126 default-palette cases), 1 recorded emoji boundary | r2-022 |
| iOS iPhone 26.3 / iPad 26.3 / iPhone 18.6 | 264 + 834 ×3 | 264 + 1053 ×3, 0 FAIL | r2-025 |
| Swift live hosts `test-live-badge` / `test-live-communication-updates` | 12 / — | 12/12, 42/42 (shared with loading, meter, status-dot) | r2-024 |
| Android device: `NativeBadgeParityTest`, host, communication host | 5 + 1 | 6/6 (incl. default palette) + 1/1 + 5/5 (shared) | r2-A021 |
| Android unit `NativeBadgeContractTest` | 4 | 4/4 | r2-A021 |
| Examples (regenerated, byte-identical) | 11 + 11 | Swift macOS + iOS-sim typecheck, Kotlin compile | r2-024, r2-025, r2-A021 |
| Studio tests | 59 / 173 | 59/59 component, 174/174 shared | r2-A023 |
| tools/ax | 0 open | 0 open on all three native platforms (Android in 2 batched runs) | r2-026, r2-A026 |

## Gate 3 — Laboratory

SwiftUI and Compose sessions open with the recipe; the retained `update` returns 200 and a new frame revision on SwiftUI and Compose (`../../../../audit/r2/runs2/lab/lab-probe.json`, r2-A022). The edited `value` widens the badge in place (16 → 22 pt/dp). There are no methods.

## Gate 6 — runtime and accessibility

Runtime: see the table above. tools/ax: [`../../../../audit/r2/runs2/ax2/md-badge/report.md`](../../../../audit/r2/runs2/ax2/md-badge/report.md) — 3 cases, captured with Chrome 153 (Web), the macOS host, the iOS 26.3 probe on AWC-r2 (r2-026) and Android (r2-A026, two full batches): 0 open findings.

## Exception decisions

**E1 — Emoji glyph advance — ACCEPTED (unchanged from 2026-10-31):** the OS emoji fonts (CoreText AppleColorEmoji 39 pt, Android Noto 36.95 dp, versus Chrome 32 px for "😀😀") set the label width; height, padding and anchoring are checked against Web. Scope: emoji glyph advances only.

**E3 — Extreme-input representable bounds — ACCEPTED (unchanged from 2026-10-31).** Lengths beyond the platform's representable layout range (Compose constraints 32,766 px; SwiftUI bounded at Chrome's measured 16,777,214) saturate, and inspection reports the applied geometry; the source itself saturates. There is no impact at representable sizes.

## Findings

Defect records: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate 7 reviewer r2".

None open.

## History

2026-10-31: FAIL (gate 5, R2-D1; R2-D6 non-blocking). 2026-11-05: R2-D1 and R2-D6 verified fixed → PASS WITH ACCEPTED EXCEPTIONS.
