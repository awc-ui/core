# `md-radio` — gate 7 independent audit

**Verdict (re-check 2026-11-06): PASS**

R4-07 (shared `<fieldset disabled>` / `aria-invalid` decisions) and R4-17 (Android Laboratory no-op update) are verified fixed. Every
suite passes on macOS, the iOS simulator and Android.

Reviewer: gate-7 reviewer r4. First audit 2026-10-31 (FAIL); re-check 2026-11-06 after the fix forks marked the r4 findings fixed
(d4: R4-01, 02, 04–10, 17, 18, 20; di: R4-11, R4-19; n2: R4-12–16, R4-21; R4-03 is still open, owner d3). Independent of the
implementing forks; no product code, tests or fixtures were changed.

Re-check snapshot: `work/audit/r4-tree`, refreshed from the canonical tree by job `r4-050-snapshot2` on 2026-11-06 16:03 UTC (rsync,
83 install jobs present, latest `di-045-install-ax-runtime`; file manifest `work/audit/r4/snap2/manifest.sha256`; no git commands).
Build products were rebuilt incrementally in the private tree. Devices: macOS (AppKit host), iOS simulator `AWC-r4` (iPhone 17 Pro,
iOS 26.3.1), Android emulator `emulator-5566` (AwcNative7, API 36), Chrome 153.0.8010.36 for the tools/ax Web reference.
Timing-sensitive suites (states/motion/stack, iOS harness, Android device runs, tools/ax) ran through `tools/slot.sh timing 4`;
the simulator was shut down on every job exit. Raw outputs: `work/audit/r4/runs2/` (first audit: `runs/`); job logs
`claude-runner/done/r4-05*`, `r4-A05*`, `r4-06*`.

## Gates

| Gate | Result | Basis |
|---|---|---|
| 1 Source contract | PASS | 8 properties, 4 events, 8 methods, 0 slots, 7 hooks, 4 parts; IR = CEM = inventory = source (`3c6bedf2…`); every row has SwiftUI, Compose, Laboratory and a test (`matrix2/md-radio.txt`; mdFocus/mdBlur confirmed live) |
| 2 Implementation | PASS | dedicated renderers with the group registry |
| 3 Laboratory | PASS | live previews, retained and no-op updates, all 8 methods, examples compile |
| 4 Behaviour | PASS | states + group keyboard runs on three platforms |
| 5 Visual | PASS | 161 Chrome paint cases on three platforms |
| 6 Runtime + AX | PASS | macOS, iPhone 26.3, Android; tools/ax 5 cases |
| 7 Final audit | PASS | all r4 findings verified |

## Re-check of the 2026-10-31 findings

- **R4-07 — VERIFIED.** md-radio-source-review.md "Decisions (autonomous, 2026-10-31, reversible)" references the shared decisions in
  md-checkbox-source-review.md (`aria-invalid` for a required group follows the source; `<fieldset disabled>` → per-control `disabled`).
- **R4-17 — VERIFIED.** Android md-radio `{softDisabled:false}` (unchanged) → 200 and the session lives (r4-051a, previously 502 ×3);
  `LivePreviewNoOpUpdateHostTest#radio` passes; in that same session `setFocus()` → `mdFocus`, `setBlur()` → `mdBlur` on Compose.
- R4-18 — hygiene: single gate-6 entry; checkpoint hashes stale again after later installs (non-blocking).

## Re-run counts (2026-11-06)

| Suite | Claimed / first audit | r4 re-check | Job |
|---|---|---|---|
| macOS `NativeRadioPaintIntegration` (161) | 3,335 | **3,335/3,335** (0 skipped) | r4-051 |
| macOS `NativeRadioStatesIntegration` | 21,780 (r4 10-31) | **21,782/21,782** | r4-052 |
| Android `NativeRadioParityTest` / `NativeRadioInteractionTest` (states + group) | 3,177 / 16,131 + 121 | **3,177/3,177**, **16,131/16,131**, group **121/121** | r4-A050 |
| iOS sim paint / states (iPhone 17 Pro 26.3) | 3,335 / 11,387 | **3,335/3,335**, **11,487/11,487** | r4-053 |

## Gate 3 — Laboratory

4177 probe (r4-051a): both platforms; update `{checked:false}`; `select()` → `mdChange {checked:true}`; `checkValidity()` → `true`;
SwiftUI `setFocus`/`setBlur` → `mdFocus`/`mdBlur` (children probe), Compose the same after a no-op update (radio probe).
Examples (selection set): Swift 0 errors (r4-052a); Compose BUILD SUCCESSFUL. Studio 110/110 (r4-052a); `test-live-selection` **38/38 in 4 of 6 runs**; 2 runs (r4-052a, r4-056 run 3) failed "valid again hides the message" (md-checkbox, R4-26).

## Gate 6 — runtime and accessibility

tools/ax re-run (`runs2/ax/md-radio/report.md`): 5 cases — macOS pass (1 accepted), iOS pass, Android pass, **0 open**.
Expectation accepted (convention): macOS `AXRequired`.

## Exception decisions

None proposed. Document-order arrow navigation and per-scope groups reviewed as named native equivalents of the document-wide
name-scoped group.

## Findings

None blocking. Non-blocking: R4-22 (Compose reports `detail: {}` for the void `mdFocus` / `mdBlur`, SwiftUI and the source `null`); R4-18.

## History

First audit 2026-10-31: FAIL (R4-07, R4-17; R4-18 hygiene); `work/audit/r4/runs/`, `work/audit/r4/audit/md-radio.md`.
