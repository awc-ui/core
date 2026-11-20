# Gate 7 audit — `md-list`

Reviewer: gate-7 reviewer s7-22, 2026-11-19 (re-check of s7-20 after story 9-31). Independent; no product code changed.

**Verdict: FAIL** — blocking findings s7-22-01 (macOS, full states suite fails in 6 of 10 runs) and S931-01..03 / s7-22-02 (iOS, open in story 9-31). s7-20-02 (detection limit) is fixed in itself, see below.

Method: snapshot `work/audit/s7-22-tree` with the 9-31 install; lane fi3, simulators AWC-fi3 / AWC-fi3-ios18. Jobs `7-22-recheck-accordion-list-3-*`.

## s7-20-02 checks
- Constants: list test early -34 ms / late +40 ms = checkbox states test; no second tier, no new known-gap list; crossing-offset check exists (late limit 17 ms, early -34 ms; Chrome gaps over 34 ms printed, not compared).
- Mutation sweep, state layer delayed (`-004`): +17 ms fails 3/3 (offset 18.2 ms vs limit 17), +33 ms fails 3/3 (14 to 16 checks), +50 ms fails 3/3 (20). Smallest failing delay: 17 ms.
- Own offset measurement x10 (`-005`): standard list n=40 median -2.9 ms, range -11.9..+8.6; segmented n=20 range -11.2..+7.0: inside -34/+17, agrees with the check.

## Why FAIL
- `-003-list-full-x10` (macOS): 4 of 10 runs pass, 6 fail one check, `select-options-standard-single-select-light-ltr r0 corners` (native 10.7 to 13.1 against Chrome bracket from 11.4 to 13.7 at web ~1500; Chrome frame gap 100 ms). Same 4 of 8 in 9-31 job `9-31-027`; the claim of 10 of 10 is not reproduced. Finding s7-22-01.
- iOS (`-007`, one run each): iPhone 26.3 77433/77443 (10 fails), iOS 18.6 74734/74736 (2 fails). Same as S931-01..03, open.

## Passing evidence
| Platform | Suite | Job | Result |
| --- | --- | --- | --- |
| macOS | list native paint | `-008` | 29418/29418 |
| iOS 26.3 | list paint | `-008` (paint-p26) | 0 fails |
| Android | ax list single, multi, none | `-A010` | ok |
| macOS, iOS, web | ax list | none in this audit | not captured: jobs `-009` and `-010-ax-macos-web` captured nothing (AWCLivePreview is not built in the snapshot). The captures of s7-20 (2026-11-18, 0 open findings) are reused; the only list change since then, the drop rest in NativeListItemView.swift (story 9-31), does not touch roles, labels, states or actions |
| Laboratory | open, 5 updates, selectItem, getSelectedIndices on Android | `-009` | all 200 |

Android list suites were not re-run: story 9-31 changed only `NativeListItemView.swift`.

## Findings
s7-22-01, s7-22-02, S931-01..03 (DEFECTS.md).
