# md-fab — gate-7 independent audit

Reviewer: gate-7 reviewer r1, 2026-10-31 ([protocol](../../../../audit/AUDIT-PROTOCOL.md)). Everything below was re-run by r1 on the
snapshot `work/audit/r1-tree` (canonical tree at 2026-10-31 00:15 UTC after 42 install jobs, latest `fx-072-install-orgchart-apk`; hash
manifest `work/audit/r1/snap/manifest.sha256`), except the Laboratory probes, which use the running 4177 server (canonical). Job logs:
`work/claude-runner/done/r1-*.log`; outputs: `work/audit/r1/runs/`; gate-1 matrices: `work/audit/r1/matrix/`; defects:
[`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md) (section r1). Mac load average during the runs: 110–940 on 16 cores.
None of these components has a `checkpoint.json`, so freshness rests on these re-runs (R1-10).

## Verdict: FAIL

Blocking: **R1-03a** (Chrome evidence covers rest paint only — no state, motion or reduced-motion comparison), **R1-04** (no retained
Laboratory property updates). Non-blocking: R1-09, R1-10.

## Gate 1 — source contract

`md-fab.tsx`/`.css`: 10 properties (optional `extended`), `mdClick`, async `setMenuIcon(string|null)`, `icon` slot, 3 parts, 5 hooks = 21 rows
([matrix](../../../../audit/r1/matrix/md-fab.md)); all have SwiftUI/Compose implementations, Laboratory exposure (catalog + `fab-appearance.js`,
Methods panel for `setMenuIcon`) and tests. The DOM `MouseEvent` detail is replaced by a null detail plus separate native activation metadata
(documented native equivalent, observed in the Laboratory on both hosts). Met.

## Re-run counts (claimed → r1)

| Suite | Claimed | r1 macOS | r1 iOS 26.3 | r1 Android |
|---|---|---|---|---|
| Chrome FAB paint (37 + 2 cases inside the md-button paint run) | pass (in 1086 / 712) | **1086/1086** | **1086/1086** | **712/712** |
| `NativeFabViewIntegration` | 94 (iOS 94×3) | **94/94** | **94/94** | — |
| ButtonMain (141 FAB contracts inside) | 1073 | **1073/1073** | **1073/1073** | — |
| Live host `test-live-fab` | pass | **pass** | — | — |
| Android device | 11 scoped cases | — | — | `NativeFabParityTest` **10/10** + `LivePreviewHostTest#fabHost…` **1/1** |
| Android unit | 5 FAB contracts | — | — | `NativeFabContractTest` **5/5** |
| Web | e2e 27 | e2e **27/27** (r1-009) | | |

## Gates 2/5 — against Chrome (R1-03a)

Chrome 153 covers the resting paint (7 variants × raised/lowered × icon/extended, medium/large, dark, disabled, soft-disabled, RTL) and the
2026-10-20 Chrome 152 snapshot covers 56 geometry cases. There is no Chrome state run (hover elevation 3→4 and lowered 1→2, focus ring and
focus layer, pressed layer and ripple), no motion run (extended↔collapsed 500 ms overshoot, label 200 ms, `setMenuIcon` 120 ms cross-fade)
and no reduced-motion run; the native suites check these against values taken from the source, not against Chrome frames.

## Gate 3 — Laboratory

r1-003: sessions open on SwiftUI and Android; a click returns one `mdClick` (detail null, pointer activation metadata); `setMenuIcon(["close"])`
changes the frame on both and `setMenuIcon([null])` restores Android's original frame exactly (SwiftUI's differs only after the preceding
click — focus state; `test-live-fab` asserts the clear). r1-010: tertiary/large/no-label via a new session gives 96×96 on both. Retained
`update` refused (R1-04). Examples: r1 generic 9 + fork generator 10 per platform — Swift typecheck exit 0 (r1-004/005), Kotlin compile
BUILD SUCCESSFUL (r1-A003); regenerated sources are byte-identical to the 2026-10-20 files, now compiled against today's APIs.

## Gate 6 — runtime and accessibility

tools/ax: 4 cases (extended, icon-only, disabled, soft-disabled), 0 open, 0 accepted, all three native platforms; identical to the installed report.

## Exceptions

None proposed. The measured label widths (Web 147.97 vs SwiftUI 148; 164 vs 165 with icon size 40) are text-shaping boundaries.

## Findings

R1-03a, R1-04 (blocking); R1-09, R1-10. See [DEFECTS.md](../../../../audit/DEFECTS.md).
