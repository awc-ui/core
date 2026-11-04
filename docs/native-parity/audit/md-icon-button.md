# md-icon-button — gate-7 independent audit

Reviewer: gate-7 reviewer r1, 2026-10-31 ([protocol](../../../../audit/AUDIT-PROTOCOL.md)). Everything below was re-run by r1 on the
snapshot `work/audit/r1-tree` (canonical tree at 2026-10-31 00:15 UTC after 42 install jobs, latest `fx-072-install-orgchart-apk`; hash
manifest `work/audit/r1/snap/manifest.sha256`), except the Laboratory probes, which use the running 4177 server (canonical). Job logs:
`work/claude-runner/done/r1-*.log`; outputs: `work/audit/r1/runs/`; gate-1 matrices: `work/audit/r1/matrix/`; defects:
[`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md) (section r1). Mac load average during the runs: 110–940 on 16 cores.
None of these components has a `checkpoint.json`, so freshness rests on these re-runs (R1-10).

## Verdict: FAIL

Blocking: **R1-03d** (no Web/Chrome fixture at all — every visual expectation is transcribed from the source; no state/motion comparison),
**R1-04** (no retained Laboratory property updates), **R1-07** (`selectedIcon` untested on Android). Non-blocking: R1-09, R1-10.

## Gate 1 — source contract

`md-icon-button.tsx`/`.css`: 19 properties, `mdClick {selected}`, 0 methods, default + `selected` slots, 3 parts (`state-layer`, `icon`,
`selected-icon`), 9 hooks = 34 rows ([matrix](../../../../audit/r1/matrix/md-icon-button.md)). All rows have SwiftUI and Compose
implementations and Laboratory exposure (catalog; 9 fields in `icon-button-appearance.js`). Test gap: `selectedIcon` is implemented on
Android (NativeIconButton.kt:293-319) but no Android test sets it (Swift: NativeIconButtonViewIntegration.swift:115-119) — R1-07.

## Re-run counts (claimed → r1)

| Suite | Claimed | r1 macOS | r1 iOS 26.3 | r1 Android |
|---|---|---|---|---|
| `NativeIconButtonViewIntegration` | 284 (iOS 284×3; doc text 268) | **284/284** | **284/284** | — |
| ButtonMain (icon-button contracts inside) | 1073 | **1073/1073** | **1073/1073** | — |
| Live host `test-live-icon-button` | pass | **pass** | — | — |
| Android device | 12 | — | — | `NativeIconButtonParityTest` **12/12** + `LivePreviewHostTest#iconButtonHost…` **1/1** |
| Android unit | — | — | — | `NativeIconButtonContractTest` **6/6** |
| Web | 58 Jest; e2e — | e2e **4/4** (r1-009) | | |

## Gates 2/5 — against Chrome (R1-03d)

`outputs/native-parity/md-icon-button` holds Laboratory screenshots and `browser-verification.json` (a 96×96 / 80×56 box check), but no
Web geometry, paint or state fixture is shared with the native tests: the Swift suite asserts sizes from the source formulas and colours as
"pixels of the source theme role > 500", the Android suite likewise, light theme only. There is no Chrome comparison of the four variants ×
selected × toggle states, dark theme, RTL, hover/focus/pressed layers, shape morph, ripple or reduced motion.

## Gate 3 — Laboratory

r1-003: a click returns one `mdClick {selected:true}` on SwiftUI and Android; r1-010: outlined/lg through a new session changes the frame
and the inspected border (0 → 1) on both. Retained `update` refused (R1-04). Examples: r1 generic 9 Swift + 9 Kotlin compile (r1-005, r1-A003).

## Gate 6 — runtime and accessibility

tools/ax: 6 cases, 0 open, 0 accepted, all three platforms; identical to the installed report (iOS reports the toggle with the switch trait,
iOS 40 pt targets as info — comparator conventions).

## Exceptions

None proposed.

## Findings

R1-03d, R1-04, R1-07 (blocking); R1-09, R1-10. See [DEFECTS.md](../../../../audit/DEFECTS.md).
