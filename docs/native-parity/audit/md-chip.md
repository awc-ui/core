# md-chip — gate 7 independent audit

**Verdict: FAIL (findings R4-02, R4-08, R4-09, R4-10, R4-11, R4-17)** — gate-7 reviewer r4, 2026-10-31.

Scope: md-chip (no supporting tags). Snapshot audited: `work/audit/r4-tree` (canonical copy 2026-10-31 02:12 Mac time,
job r4-001). Re-runs by r4 on that snapshot (Mac lane r4, Android lane a6 / emulator-5566, simulator AWC-r4 = iPhone 17 Pro,
iOS 26.3.1). Working files: `work/audit/r4/`.

## Evidence freshness

Stale: `outputs/native-parity/md-chip/native-swift/checkpoint.json` hashes differ for `NativeChip.swift`,
`ChipAppearance.swift`, `AWCNativeView.swift`, both chip fixtures and `test-native-views.sh`; the Android checkpoint differs
for `NativeChip.kt`, `AWCComponent.kt`, `NativeChipInteractionTest.kt`; `source-tests/checkpoint.json` differs for
`md-chip.tsx`. Shared files changed 2026-10-30 23:12 (after iOS r8 and tools/ax). Counts below are r4 re-runs. Oracles
`chip-web-*.json` / `ChipWeb*.json` byte-identical and identical to `outputs/native-parity/md-chip/web-oracle/`.

## Gate 1 — source contract matrix

IR current; CEM = IR = inventory: 14 properties, 3 events, 0 methods, 3 slots, 12 hooks, 8 parts (AUDIT 14/3/0/3/12).

| Rows | SwiftUI | Compose | Laboratory | Test |
|---|---|---|---|---|
| 14 properties (`variant`, `icon`, `trailingIcon`, `selected`, `selectable`, `appearance`, `color`, `elevated`, `disabled`, `softDisabled`, `removable`, `label`, `contentAlign`, `density`) | NativeChip.swift | NativeChip.kt | `CHIP_UPDATE_PROPERTIES` | chip-web-paint (452), states (45 + 5 runs), `chipHooksAndRetainedUpdates` |
| 3 events (`mdClick`, `mdSelect` `{selected}`, `mdRemove` cancelable) | yes | yes | event stream | states runs (order, detail, prevented) |
| 3 slots (default, `leading-icon`, `trailing-icon`) | yes | yes | content slots | paint cases (early-slotted icons) |
| 12 hooks | `AWCChipHookAppearance` | same | selection-appearance.js | paint hook cases |
| 8 parts | 7 typed targets | 7 | `SELECTION_PARTS` (8 listed) | paint part cases |

Gap: **`primary` part has no native styling target** (md-chip.md: "seven typed part targets (the primary part has no
native styling target)"); no exception record (R4-09). Everything else has all four (`matrix/md-chip.txt`).

## Gates 2, 4, 5 — re-runs

| Suite | Claimed | r4 result | Job |
|---|---|---|---|
| macOS `NativeChipPaintIntegration` (452 cases) | 9,930/9,930 | **9,930/9,930** | r4-005 |
| macOS `NativeChipStatesIntegration` (45 + 5 runs) | 131,791/131,792 ("quiet" 143,027/143,027) | **149,765/149,834** (69 failures, see R4-11); rerun: **146,719/146,719** on a quieter rerun (r4-039): the r4-005 failures were load timing | r4-005, r4-032 |
| Android `NativeChipParityTest` | 11,786/11,786 | **11,786/11,786** | r4-A004 |
| Android `NativeChipInteractionTest` | 36,754/36,754 | **36,754/36,754** | r4-A004 |
| Android `NativeChipGlyphTest`, `NativeChipRemoveSemanticsTest` | pass | ok (4/4 tests in the run) | r4-A004 |
| iOS sim paint | 9,930/9,930 | **9,930/9,930** | r4-030 |
| iOS sim states | 151,923/151,923 | **151,922/151,923** (r4-030) and **151,772/151,780** (r4-035): click2/clickBody phase-shot means 1.02–1.34 (limit 1.0) and one state-layer frame (R4-11) | r4-030 |

Test-side allowances reviewed:
- Android local density (`density-local-wins`) is skipped: `AWCComponent` passes only the resolved density (R4-02).
- Keyboard activation that widens a filter chip: ripple origin/diameter check skipped (R4-10).
- Android arrow keys move focus (2D focus search) and the arrow is not sent (R4-08).
- Android label advances differ from Chrome by up to 1 px (font shaping): explained raster difference, accepted.
- Phase shots compared inside Chrome's recorded capture window (best-of): test methodology, accepted.

## Gate 3 — Laboratory

- 4177 probe (r4-002a): SwiftUI + Compose sessions; update `{label:'Audit chip', selected:true}` accepted (no methods).
- **R4-17**: Android no-op update `{softDisabled:false}` → 502, session lost (r4-006a); SwiftUI accepts.
- Examples (part of the 118 + 118 selection set): Swift typecheck 0 errors (r4-007); Compose BUILD SUCCESSFUL (r4-A006; re-verified by r4-A007: the compile task executed and the example classes were produced); Studio 110/110;
  `chipHooksAndRetainedUpdates` ok (r4-A002); **failed once** in r4-020 (checkbox "valid again hides the message": the frame was read before the retained `{checked:true}` update rendered, under load); two reruns 38/38 (r4-034) — not counted.

## Gate 6 — runtime and accessibility

- iOS re-run on iPhone 17 Pro 26.3 only; documented iPad (164,369/164,370, 1 open click shot) and iOS 18.6 r8 runs predate
  the 2026-10-30 shared changes.
- tools/ax re-run: 6 cases (filter, filter-selected, assist, input, disabled, soft-disabled): macOS pass (2 accepted), iOS pass, Android pass; 0 open. Expectation "group disabled → ∅" on macOS **accepted** (AppKit groups carry no enabled
  state; the chip control reports `AXEnabled false`). Touch-target info entries (32 pt chips, 18 pt remove button) follow
  the source's sizes; informational.

## Exceptions

None proposed. Not acceptable as silent platform differences: R4-08 (would need a complete exception record with a
tested native equivalent), R4-09 (implementable typed part fields).

## Findings

- **R4-02** (gates 2/5, Android): resolved-density-only hand-off; Chrome case skipped.
- **R4-08** (gates 2/6, Android): arrow keys move focus; untested; no exception record.
- **R4-09** (gates 1/3): `::part(primary)` has no native target.
- **R4-10** (gate 5): width-changing keyboard ripple check skipped.
- **R4-11** (gates 5/6, iOS): chip states fail on the iPhone simulator in both r4 runs (1 and 8 checks; the documented iPad r8 run also had 1); macOS passes on the quiet rerun.
- **R4-17** (gate 3): Android Laboratory host drops the session on a no-op retained update.
- R4-18 (hygiene): stale checkpoints; duplicate gate-6 AUDIT entries.
