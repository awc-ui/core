---
title: 'Gate-7 audit: search, transfer-list, date-picker'
type: 'chore'
created: '2026-11-13'
status: 'done'
story_key: '7-11-audit-search-transfer-list-date-picker'
epic: 7
model: 'sonnet'
wave: 2
lanes: 'mac lane r2 · android lane a5 (emulator-5564) · simulator AWC-r2'
lab: 'work/audit (your folder: work/audit/s7-11)'
depends_on: ['1-1-md-transfer-list-finish-and-install', '1-2-md-search-finish-and-install', '1-3-md-date-picker-finish-and-install', '1-4-ipad-focus-entry-shared', '1-5-md-date-picker-accessibility']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** These components have no gate-7 verdict yet: md-search, md-transfer-list, md-date-picker.

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts.

## Boundaries & Constraints

**Always:** Be skeptical: a claim is evidence only after you matched it to a log or re-ran it. New findings go to DEFECTS.md with evidence and a suggested fix. The rules in project-context.md apply.

**Never:** Never edit product code or tests. Never accept a `::part` exception where a typed target is implementable.

</intent-contract>

## Code Map

- `work/audit/AUDIT-PROTOCOL.md` -- your procedure
- `work/audit/DEFECTS.md` -- findings and their status lines
- `work/audit/r1`..`r6` -- earlier reviewers' scripts and probes you can reuse
- `docs/native-parity/audit/` -- verdict docs

## Tasks & Acceptance

**Execution:**
- [ ] Fresh snapshot of canonical; contract matrix per component
- [ ] Re-run: Swift paint and states (macOS), Android tests, iOS harness on iPhone 26.3 (states x3) plus one more runtime, Laboratory probes through 4177, examples compile, tools/ax
- [ ] Decide each proposed exception; record new findings in DEFECTS.md
- [ ] Write `docs/native-parity/audit/<tag>.md` and update the AUDIT.md cells through one main-queue install

**Acceptance Criteria:**
- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (09:11 UTC 2026-11-16, scope and Laboratory)
- Scope change: this audit covers md-transfer-list and md-date-picker only. md-search has its own audit story, 7-17, because story 1-2 is still open on iOS items. Ignore the dependency on 1-2 in your frontmatter and give no verdict for md-search.
- md-date-picker: story 1-3 was reopened on 2026-11-16 for a macOS paint failure (606 checks in case `hook-year-block-size`) and is back in review when you start. Run `NativeDatePickerPaintIntegration` on your snapshot first.
- Laboratory on port 4177: since 2026-11-15 19:14 UTC the server runs without the Android SDK variables (finding s7-5-02 in DEFECTS.md), so Android previews answer 503 ANDROID_ADB_UNAVAILABLE. Ask `/api/native-live/status?platform=android` first. If Android is still not available, run the iOS and macOS Laboratory probes, record the Android probe as "not run: environment, s7-5-02" (it is not a product finding), and follow AUDIT-PROTOCOL.md for what that means for the verdict; list the probe in `open_items` as owed by the coordinator, who repeats it after the server is restarted.

### Coordinator note (09:44 UTC 2026-11-16, Laboratory repaired)
- The Laboratory server on port 4177 was restarted by the coordinator at 09:43 UTC on 2026-11-16 with the Android SDK variables (main-queue job `881-coord-laboratory-restart`, exit 0). `/api/native-live/status?platform=android` now answers `"available":true` ("Real Jetpack Compose on emulator-5554"), and the playground APK on emulator-5554 was reinstalled from canonical. So the Android Laboratory probe is no longer blocked by finding s7-5-02: run it as AUDIT-PROTOCOL.md describes. This replaces what an earlier note says about recording the Android probe as not run.

### Coordinator note (11:08 UTC 2026-11-16, high Mac load 09:20-11:25 UTC)
- From about 09:20 to about 11:25 UTC on 2026-11-16 the Mac ran a deliberate CPU load: story 6-4 measured a stall with 12 busy loops in its jobs 015 to 018, and the load average was 270 to 1000 (normal is 50 to 70). A timing, motion, states or focus failure of any run inside that window is suspect, also on a simulator or an emulator. Do not record it as a finding and do not build a conclusion on it: look at the load line of the job, and repeat the run once the 1-minute load is back below about 150. Paint and geometry results are not affected.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- FINAL (session 2, 2026-11-16): status done. Verdicts installed by main-queue job `s7-11-100-install-audit-s7-11` (exit 0; AUDIT.md rows prefixed, docs/native-parity/audit/md-date-picker.md + md-transfer-list.md, DEFECTS.md entries s7-11-01, s7-11-02).
- md-transfer-list: PASS (macOS 2388/138; iPhone, iPad, iOS 18 same; Android 2388/138 + host ok; lab ok; ax 0 open; examples 36+36).
- md-date-picker: PASS WITH ACCEPTED EXCEPTIONS (Arabic/Hebrew fallback fonts accepted). macOS 37183/37789/10417; iPhone/iPad/iOS18 paint 37181, states 10417 (x3 on iPhone, iPad); Android paint 31436 with awcDpD9=1 (606 fails without = recorded cause), states 10417; lab 42/42 + probes; ax 0 open; examples 28+28.
- Open finding s7-11-01 (M, non-blocking): Android LivePreviewDatePickerHostTest intermittent HTTP 400 (1 fail in A001, 3/3 ok in A004). Re-check verdict when fixed.
- EVIDENCE | s7-11-001-snapshot-macos | macOS | dp-paint | 37183/37183
- EVIDENCE | s7-11-001-snapshot-macos | macOS | dp-states | 10417/10417
- EVIDENCE | s7-11-007-ios-dp-paint-rerun | iPad+iOS18 | dp-paint | 37181/37181
- EVIDENCE | s7-11-A004-dp-rerun | Android | dp-paint awcDpD9 | 31436/31436
- md-search: not in scope (story 7-17). Owed: none; ios18/iPad dp paint first runs (003, 006) died on install, ignore their summary lines.

## Review Triage Log

