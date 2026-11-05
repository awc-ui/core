# md-segmented-button (+ md-segmented-button-set) — gate-7 independent audit

Reviewer: gate-7 reviewer r1, 2026-10-31 ([protocol](../../../../audit/AUDIT-PROTOCOL.md)). Everything below was re-run by r1 on the
snapshot `work/audit/r1-tree` (canonical tree at 2026-10-31 00:15 UTC after 42 install jobs, latest `fx-072-install-orgchart-apk`; hash
manifest `work/audit/r1/snap/manifest.sha256`), except the Laboratory probes, which use the running 4177 server (canonical). Job logs:
`work/claude-runner/done/r1-*.log`; outputs: `work/audit/r1/runs/`; gate-1 matrices: `work/audit/r1/matrix/`; defects:
[`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md) (section r1). Mac load average during the runs: 110–940 on 16 cores.
None of these components has a `checkpoint.json`, so freshness rests on these re-runs (R1-10).

## Verdict: FAIL

Blocking: **R1-03e** (Chrome evidence is light-theme geometry only, the main 35-case reference predates a source change; no state/motion
comparison), **R1-04** (no retained Laboratory property updates). Non-blocking: R1-09 (the doc still lists the Swift narrow comparison and
copied-example checks as open — both are done), R1-10. The supporting tag md-segmented-button-set shares this verdict.

## Gate 1 — source contract

Segment: 13 properties, `mdSegmentClick {value, selected}`, 0 methods, default + `icon` slots, 4 parts (`state-layer`, `checkmark`, `icon`,
`label`), 7 hooks = 27 rows; set: 2 properties, `mdChange: string[]`, default slot = 4 rows
([segment](../../../../audit/r1/matrix/md-segmented-button.md), [set](../../../../audit/r1/matrix/md-segmented-button-set.md)). All rows have
SwiftUI and Compose implementations, Laboratory exposure (catalog, `segmented-button-appearance.js`, standalone/set context) and tests;
`segmentIndex`/`segmentTotal` are injected by the set (NativeSegmentedButtonSet.swift:28) and covered by the set geometry cases. Met.

## Re-run counts (claimed → r1)

| Suite | Claimed | r1 macOS | r1 iOS 26.3 | r1 Android |
|---|---|---|---|---|
| `NativeSegmentedViewIntegration` (35 + 12 narrow Web fixtures) | 370 (iOS 370×3; doc text 286) | **370/370** | **370/370** | — |
| Live host `test-live-segmented` | 12 | **12/12** | — | — |
| Android device | 5 renderer + 1 host methods | — | — | `NativeSegmentedParityTest` **6/6** + `LivePreviewHostTest#segmentedContext…` **1/1** |
| Android unit | 7 segmented contracts | — | — | `NativeSegmentedContractTest` **8/8** |
| Web | 87 source tests | e2e segmented **10/10**, set **3/3** (r1-009) | | |

## Gates 2/5 — against Chrome (R1-03e)

The references are 35 + 12 Chrome 152 computed-geometry configurations (2026-10-20, light only). The 35-case file was recorded at 15:31
before `md-segmented-button.tsx`/`.css` changed at 18:52 (their hashes differ from `web-evidence.json`; the 12-case narrow file matches today's
source). No Chrome paint (dark, selected/disabled pixels), no state run (hover/focus/pressed layers, focus ring) and no motion or reduced-motion
run (checkmark/selection transition).

## Gate 3 — Laboratory

r1-003: in set mode, clicking Day returns one `mdChange ["day"]` from the set on SwiftUI and Android (no leaked `mdSegmentClick`), with the
selection vector `[true,false,false]`. r1-010: a density edit through a new session changes the frame on both (row height stays 40, as the
Web `set-local-density` case shows for a stretched grid row). Retained `update` refused (R1-04). Examples: r1 generic segment 10 + set 5 and
the fork generator's 20 per platform compile (Swift exit 0; Kotlin BUILD SUCCESSFUL).

## Gate 6 — runtime and accessibility

tools/ax: segment 1 case, set 2 cases (single/multiselect), 0 open, 0 accepted, all three platforms; identical to the installed reports
(iOS encodes radios as buttons with a checked value — comparator convention).

## Exceptions

None proposed. The ≈1.6 pt accumulated text-shaping difference across three columns is a measured boundary with unchanged tolerances.

## Findings

R1-03e, R1-04 (blocking); R1-09, R1-10. See [DEFECTS.md](../../../../audit/DEFECTS.md).
