# Gate 7 audit — `md-transfer-list`

Reviewer: gate-7 reviewer s7-11, 2026-11-16. Independent of the implementing forks; no product code changed.

**Verdict: PASS** — no exception proposed, no open finding.

## Method

- Snapshot `work/audit/s7-11-tree` of canonical (job `s7-11-001-snapshot-macos`, 2026-11-16). Lanes: Mac r2, Android a5 (emulator-5564), simulators AWC-r2 (iPhone 26.3), AWC-r2-pad (iPad 26.3), AWC-r2-18 (iOS 18.6). Everything below was re-run on the snapshot.
- Contract matrix regenerated from the inventory (`audit/s7-11/tools/matrix.py`, `audit/s7-11/matrix.json`, 57 rows). The script matches by name; the rows it lists as missing in the Laboratory are properties and methods that the Laboratory probe exercises (below) and CSS parts that the typed part API covers, so they are naming artefacts, not gaps.
- Checkpoint: all 23 source hashes in `outputs/native-parity/md-transfer-list/checkpoint.json` match canonical today.

## Re-run evidence

| Platform | Suite | Job | Result |
| --- | --- | --- | --- |
| macOS | `NativeTransferListPaintIntegration` / `...StatesIntegration` | `s7-11-001-snapshot-macos` | 2388/2388, 138/138 |
| iPhone 26.3 | paint, states x3 | `s7-11-002-ios-iphone` | 2388/2388; 138/138 three times |
| iPad 26.3 | paint, states x3 | `s7-11-006-ios-ipad` | 2388/2388; 138/138 three times |
| iOS 18.6 | paint, states | `s7-11-003-ios-ios18` | 2388/2388, 138/138 |
| Android | `NativeTransferListPaintTest`, `NativeTransferListStatesTest`, `LivePreviewTransferListHostTest` | `s7-11-A001-android` | 2388/2388, 138/138, host test ok |
| Laboratory | `test-live-transferlist`, studio integration test, 4177 probes (iOS and Android: session, update, moveSelectedRight, moveSelectedLeft, frame) | `s7-11-005-lab-ax` | all ok |
| Examples | 36 Swift typecheck, 36 Kotlin compile (class files produced) | `s7-11-004-examples-swift`, `s7-11-A006-examples-kotlin2` | 0 errors |
| tools/ax | 6 cases | `s7-11-005-lab-ax`, `s7-11-A003-ax-android` | macOS pass (21 accepted), iOS pass (11 accepted), Android compare 0 open |

The claimed counts in `md-transfer-list.md` and the AUDIT row (2,388, 138, 886 studio) match these logs.

## Exceptions

None proposed; none needed.

## Open items

None. Note for the coordinator: the machine load was 71-390 during several runs; no result depended on a retry.
