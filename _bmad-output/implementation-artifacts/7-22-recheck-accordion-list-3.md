---
title: 'Gate-7 re-check: accordion, list (s7-20 findings)'
type: 'chore'
created: '2026-11-15'
status: 'done'
story_key: '7-22-recheck-accordion-list-3'
epic: 7
model: 'sonnet'
wave: 7
lanes: 'mac lane fi3 · android lane a2 (emulator-5558) · simulators AWC-fi3 and AWC-fi3-ios18'
lab: 'work/audit (your folder: work/audit/s7-22)'
depends_on: ['9-30-accordion-android-modal-scope-registration-order', '9-31-list-states-suite-extra-timing-tier']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-accordion (+item) (s7-20-01), md-list (s7-20-02).

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folders: work/audit/s7-20, work/audit/s7-12 and work/audit/s7-8. Re-check s7-20-01 on a new snapshot: the modal-scope variants of the Initialization and Dispatch classes three times and the originals three times; your own probe with a defaultExpanded accordion inside a real dialog, a real bottom sheet and a real side sheet (first mdItemToggle: index 0 and 1, first expanded true); every Android test class whose name starts with NativeAccordion once (unit and instrumented); the accordion paint and states suites and the dialog, bottom-sheet and side-sheet classes on Android once; with the fix reverted in a copy of the snapshot the modal-scope tests fail. Show that the Swift accordion sources of the snapshot equal those of the s7-20 snapshot. Re-check s7-20-02: read the list states test and name its timing constants next to those of the checkbox states test (no tier wider than the shared rule, no new known-gap list that takes its place); the full list states suite 10 times on macOS (before a failing run counts, check it against the power log, the timeout and its duration), 3 times on iPhone 26.3 and twice on iOS 18.6; your own mutation sweep on macOS with the state-layer start delayed by 17, 33 and 50 ms, three runs each (33 ms must fail in every run; report the smallest delay that fails); the crossing-offset check exists with a 17 ms limit and your own offset measurement over 10 runs agrees with it; if a product list source changed, the Android list suites once and list paint once per platform. Write the Mac load at the start of each run. The verdict of md-avatar (PASS, s7-12) stands.

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

### Coordinator note (Coordinator note 2026-11-19 07:52 UTC: state of accordion and list for the re-check)
For your re-check. Accordion: story 9-30 installed the modal-scope fix on Android (job 9-30-100; canonical re-run 13 of 13, 0 of 80 differing traces): re-check s7-20-01 as your story says. List: story 9-31 installs for macOS the deletion of the tier, a crossing-offset check (early limit -34 ms, late limit 17 ms; crossings in Chrome frame gaps over 34 ms counted and printed, not compared) and a drop rest of 4 ms instead of 16 ms in NativeListItemView.swift (the hover layer after a drop started 17-20 ms after Chrome); macOS full suite 10 of 10 and reorder subset 20 of 20, mutations +17, +33, +50 failing 3 of 3. Check that install first (name 'list states: tier removed, crossing check, drop rest 4 ms' in claude-runner/done); if it is not there yet, do the accordion part and wait with the list part. On the iOS simulators the list suite without the tier fails in every run (open findings S931-A, B, C in DEFECTS: 66 ms frame hole after a key reorder, drag-up crossing 17-25 ms late, single misses): story 9-31 is still working on them, so md-list cannot pass yet; make one confirmation run per iOS runtime, not more, and give the list verdict from the state you find. The switch finding of 9-31 (its suite passed a 33 ms delay) belongs to story 9-39 and re-check 7-23, not to you.

### Coordinator note (Coordinator note 2026-11-19 13:27 UTC: closing session: the accessibility capture of job 010 must be read, not its exit code)
Closing session. Job 010-ax-macos-web has ended with exit 0, but its log holds a spawn error for AWCLivePreview (the binary is not built in the snapshot tree audit/s7-22-tree), the same reason the iOS capture of job 009 failed. An accessibility capture that did not run is not a pass, whatever the exit code says. Read the whole log and say per platform and component what was really captured. Then one of two, with the reason written in the audit docs:
(a) build AWCLivePreview in the snapshot and repeat the capture (a short job: build, then the two components), or
(b) reuse the captures of s7-12, which is allowed only where the sources that feed accessibility are unchanged since then: for the accordion you have shown 27 Swift files with 0 differing; for the list say which files the 9-31 install changed (NativeListItemView.swift: drop rest) and that the change does not touch roles, labels, states or actions.
The md-accordion PASS stands only with no open accessibility finding; if (a) or (b) brings one, the verdict changes and the audit install is repeated. md-list stays FAIL either way. Then set status done. S7-22-01 is the same failure as S931-05 and has its cause and its ruling in story 9-31 (the Web recording has a 100 ms frame hole at the selection step; no gap rule; the recording is made again); add one line to the DEFECTS entry of s7-22-01 that points there.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Reviewer s7-22 (session 5). DONE. Verdicts installed (job 100-install-audit): md-accordion PASS, md-list FAIL (s7-22-01 = S931-05, s7-22-02, S931-01..03).
- Accessibility: job 010-ax-macos-web exit 0 but captured NOTHING (AWCLivePreview not built in audit/s7-22-tree, same as 009 iOS). Real captures: Android only (A010, ok). Option (b) used: s7-20 captures (2026-11-18, audit/s7-20/out/ax, macos/ios/web/android, 0 open for md-accordion and md-list) are reused. Accordion: 27 Swift files 0 differing vs s7-20 snapshot. List: the only 9-31 change is the drop rest in NativeListItemView.swift (hover layer timing after a drop), which does not touch roles, labels, states or actions. No open accessibility finding, verdicts unchanged.
- Nothing left for this story.

## Review Triage Log

