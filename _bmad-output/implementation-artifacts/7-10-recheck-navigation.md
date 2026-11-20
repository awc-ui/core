---
title: 'Gate-7 re-check: breadcrumbs, tabs, navigation-bar, toolbar'
type: 'chore'
created: '2026-11-13'
status: 'done'
story_key: '7-10-recheck-navigation'
epic: 7
model: 'sonnet'
wave: 3
lanes: 'mac lane d6b · android lane a3 (emulator-5560) · simulator AWC-d6b'
lab: 'work/audit (your folder: work/audit/s7-10)'
depends_on: ['5-1-nav-wrapper-parts-and-android-label', '5-2-web-slotted-text-accessibility']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md', '{project-root}/../audit/AUDIT-PROTOCOL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Fixes for these components are marked ready for re-check: md-breadcrumbs, md-tabs, md-navigation-bar, md-toolbar: R6-15, R6-17, R6-18 (iPad), R6-22, R6-23.

**Approach:** Act as the independent gate-7 reviewer. Follow AUDIT-PROTOCOL.md exactly: build the contract matrix, match claims to logs, re-run paint, states, iOS, Android, Laboratory and tools/ax on a fresh snapshot, decide exceptions, write verdicts. Earlier reviewer folder: work/audit/r6/recheck3.

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

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- Session 1 (s7-10, 2026-11-15). Folder work/audit/s7-10; snapshot work/audit/s7-10-tree.
- ALL runs DONE and read: macOS 002, Lab 004, iOS 005 (26.3 / 18.6 / iPad), ax 006 + A004 (0 open), examples 007 + A002, checkpoint report 008, R6-15 009 + 011 (24/24, panels 12/12), inventory 010, Android A001 (+A003 rerun of rail flake).
- Verdicts: PASS for md-breadcrumbs, md-tabs, md-navigation-bar, md-toolbar. No blocking finding. Non-blocking: S7-10-01 (stale checkpoints), S7-10-02 (rail PixelCopy flake, info).
- INSTALLED: s7-10-001-install-audit-navigation exit 0 (4 docs, 4 AUDIT.md cells, DEFECTS.md lines; backup work/audit/s7-10/install-backup-20261115-173858). status set to done.
- NEXT: confirm done/s7-10-001-install-audit-navigation.exit is 0 and grep "s7-10, 2026-11-15" in AUDIT.md (4 rows); then set status done. If exit non-zero, read the log (pre-image mismatch = another install changed AUDIT.md/DEFECTS.md/the audit docs: adjust install.py anchors and requeue a new main-queue job).

### Evidence
EVIDENCE | s7-10-002-macos | macOS | NativeBreadcrumbsPaintIntegration | 6799/6799
EVIDENCE | s7-10-002-macos | macOS | NativeTabsPaintIntegration | 16111/16111
EVIDENCE | s7-10-002-macos | macOS | NativeNavigationBarPaintIntegration | 17429/17429
EVIDENCE | s7-10-002-macos | macOS | NativeToolbarPaintIntegration | 8416/8416
EVIDENCE | s7-10-002-macos | macOS | NativeBreadcrumbsStatesIntegration | 76449/76449
EVIDENCE | s7-10-002-macos | macOS | NativeTabsStatesIntegration | 137124/137124
EVIDENCE | s7-10-002-macos | macOS | NativeNavigationBarStatesIntegration | 189386/189386
EVIDENCE | s7-10-002-macos | macOS | NativeToolbarStatesIntegration x3 full | 2396/2396 each; fab-light-ltr only x2 66/66 each; FRAMEWAIT 0
EVIDENCE | s7-10-004-lab | SwiftUI live host | breadcrumbs 55, tabs 46, navbar 27, toolbar 29 (+ nav-rail 33, app-bar 19) | all pass, frames pass schema
EVIDENCE | s7-10-004-lab | 4177 | probe-lab2 18/18 sessions; probe-lab4/5/6: R6-22 (Android crumb disabled/current repaint at +0.8 s) and R6-23 (panel ink #1C1B1F both platforms) hold
EVIDENCE | s7-10-004-lab | macOS | SwiftUI examples typecheck | 16+20+17+12+51 views exit 0
EVIDENCE | s7-10-A001-android | Android a3 emulator-5560 | tabs paint 12814, tabs states 136956, toolbar paint 7816, toolbar states 1904, breadcrumbs paint 6362 (label ink measured 291), states 22306, ink updates 12, navbar paint 15777, states 189338 | 0 failures each; all in-scope host tests ok (tabPanelPage, crumbLabelInkFollowsStateChanges, breadcrumbItemStandaloneHooksAndUpdates, toolbar*)
EVIDENCE | s7-10-A001-android | Android | LivePreviewNavHostTest.railHooksUpdatesAndMethods FAIL ("Native PixelCopy failed with code 2") - md-navigation-rail, outside scope; s7-10-A003 rerun of the class: all ok (7 tests) => capture flake (KNOWN-CAUSES 12)
EVIDENCE | s7-10-A002-kotlin-examples | Android | Compose examples compile: 16+20+17+12+51 + 27 typed part composables, exit 0, classes produced, clean recompile leaves 0
EVIDENCE | s7-10-005-ios | iPhone 17 Pro 26.3 (AWC-d6b) | paint 6799/16111/17429/8416, states 76465/132004/189386/2396 | all pass, ax=1/1/0
EVIDENCE | s7-10-005-ios | iPhone 16 Pro 18.6 (AWC-d6b-18) | paint same four; states 76426, 132004, navbar 189362 x3, toolbar 2396, breadcrumbs run2 76473 | all pass
EVIDENCE | s7-10-005-ios | iPad Pro 26.3 (AWC-d6b-ipad) | toolbar states x3 2396/2396 each; navigation-bar states 189386/189386
EVIDENCE | s7-10-006-ax | macOS/Web/iOS | tools/ax compare nine navigation tags | 0 open findings
EVIDENCE | s7-10-A004-ax-android | Android | tools/ax compare nine navigation tags | 0 open findings
EVIDENCE | s7-10-009-r615 | Web | 24 cold loads: breadcrumbs collapsed/trail, tab-panel, stepper x5 | 24/24 each; s7-10-011 md-tab-panels active 12/12
EVIDENCE | s7-10-007 | macOS | SwiftUI 27 typed part examples typecheck | exit 0
Note: breadcrumbs states is 76449 now vs 76426 claimed in 5-1 (23 more checks; canonical fixtures changed since, all pass).

## Review Triage Log

