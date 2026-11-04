# md-split-button — gate-7 independent audit

Reviewer: gate-7 reviewer r1, 2026-10-31 ([protocol](../../../../audit/AUDIT-PROTOCOL.md)). Everything below was re-run by r1 on the
snapshot `work/audit/r1-tree` (canonical tree at 2026-10-31 00:15 UTC after 42 install jobs, latest `fx-072-install-orgchart-apk`; hash
manifest `work/audit/r1/snap/manifest.sha256`), except the Laboratory probes, which use the running 4177 server (canonical). Job logs:
`work/claude-runner/done/r1-*.log`; outputs: `work/audit/r1/runs/`; gate-1 matrices: `work/audit/r1/matrix/`; defects:
[`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md) (section r1). Mac load average during the runs: 110–940 on 16 cores.
None of these components has a `checkpoint.json`, so freshness rests on these re-runs (R1-10).

## Verdict: FAIL

Blocking: **R1-03f** (Chrome evidence is light-theme geometry only; no paint, state or motion comparison), **R1-04** (no retained
Laboratory property updates), **R1-11** (SwiftUI turns an empty additive-slot text into an extra flex item: the default Laboratory preview is
8 pt wider than Web and Android). Non-blocking: R1-09, R1-10.

## Gate 1 — source contract

`md-split-button.tsx`/`.css`: 14 properties, `mdLeadingClick` (void) and `mdTrailingClick {checked}`, 0 methods, 1 additive default slot,
7 parts, 6 hooks = 30 rows ([matrix](../../../../audit/r1/matrix/md-split-button.md)). All rows have SwiftUI and Compose implementations,
Laboratory exposure (catalog, `split-button-appearance.js`, captured `splitButtonChecked`) and tests (the two state-layer parts are built by
name concatenation and asserted in NativeSplitButtonViewIntegration.swift:110-111 / NativeSplitButtonParityTest.kt:211-213). `controls`
maps to a mounted `AWCPopupTargetScope` (native equivalent with tests). Met.

## Re-run counts (claimed → r1)

| Suite | Claimed | r1 macOS | r1 iOS 26.3 | r1 Android |
|---|---|---|---|---|
| `NativeSplitButtonViewIntegration` (50 Web fixtures) | 945 (iOS 945×3) | **945/945** | **945/945** | — |
| Live host `test-live-split-button` | 13 | **13/13** | — | — |
| Android device | 11 methods (10 + corrected pixel method) | — | — | `NativeSplitButtonParityTest` **6/6** + `LivePreviewHostTest#splitButton…` **1/1** |
| Android unit | 98 (module, then) | — | — | `NativeSplitButtonContractTest` **6/6** (module 195/195) |
| Web | 69 source tests; e2e 12 | e2e **12/12** (r1-009) | | |

## Gates 2/5 — against Chrome (R1-03f)

50 Chrome 152 computed-geometry/colour configurations (2026-10-20, light only). No Chrome paint (elevated shadows clipped at the inner
edges, dark theme, outlined border pixels), no state run (100 ms state layers per half, focus ring), no motion run (200 ms inner-corner
morph, trailing-icon 180° rotation on check) and no reduced-motion run.

## Gate 3 — Laboratory

r1-003: a click on the leading half returns one `mdLeadingClick` (null detail) on SwiftUI and Android with `splitButtonChecked:false`.
r1-013: the default recipe (label "Create project", icon add, size md; the Laboratory sends `slots {"": ""}`) measures 240.5×56 on SwiftUI
(leading 182.5 = 20 + 24 + 8 + 102.5 + **8** + 20) against Web 232.219×56 (leading 174.219, fixture `md-density0`) and Android 233×56
(leading 175): the empty slot text is laid out as an item with its own gap (R1-11).
r1-010: outlined/lg through a new session changes the frame and root (240.5×56 → 365.5×96 SwiftUI, 233×56 → 358×96 Android). Retained
`update` refused (R1-04). Examples: r1 generic 13 and the fork generator's 16 per platform compile.

## Gate 6 — runtime and accessibility

tools/ax: 4 cases (default, expanded, disabled, soft-disabled), 0 open, 0 accepted, all three platforms; identical to the installed report.

## Exceptions

None proposed.

## Findings

R1-03f, R1-04, R1-11 (blocking); R1-09, R1-10. See [DEFECTS.md](../../../../audit/DEFECTS.md).
