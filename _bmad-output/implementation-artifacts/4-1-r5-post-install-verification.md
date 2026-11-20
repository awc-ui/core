---
title: 'R5: verify the install, fix studio tests, produce the status table'
type: 'bugfix'
created: '2026-11-13'
status: 'review'
story_key: '4-1-r5-post-install-verification'
epic: 4
model: 'sonnet'
wave: 1
lanes: 'mac lane d5 · android lane a6 (emulator-5566) · simulator AWC-d5'
lab: 'work/d5-lab'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The R5 install (d5-030) printed INSTALLED and d5-031 ran the canonical suites and tools/ax, but nobody read the results, the DEFECTS marks were never applied and three Studio tests fail on canonical (md-line-chart getInstance; org-chart hooks and state-layer).

**Approach:** Read d5-030 and d5-031, fix the three Studio tests, and write an exact per-finding status for R5-01..R5-17 so stories 4-2 and 4-3 can start from facts.

## Boundaries & Constraints

**Always:** A finding is FIXED only with canonical evidence. Record PARTIAL honestly. The rules in project-context.md apply.

**Never:** Do not start the open table or chart items here; hand them to 4-2 and 4-3.

</intent-contract>

## Code Map

- `work/claude-runner/done/d5-030-install-r5.log`, `d5-031-canonical-ax-suites.log` -- unread results
- `work/d5-lab/PROGRESS.md` (older than the last jobs), `work/d5-lab/install/` (install-d5.py, defects-d5.py, checkpoints-d5.py)
- `work/claude-runner/notes/n4-to-d5-md-table.md`, `work/d5-lab/REQUESTS.md` (fx's five macOS md-table ax findings)
- `apps/native-playground/*.test.mjs` -- the three failing Studio tests

## Tasks & Acceptance

**Execution:**
- [x] Read d5-030 and d5-031; list suite counts and tools/ax open findings per component
- [x] Fix the three Studio failures (tests or generated metadata, whichever is wrong) and install
- [x] Append status lines for R5-01..R5-17 in DEFECTS.md; run checkpoints-d5.py and confirm with tools/checkpoint-refresh.py
- [x] Write the exact open-item list into the 'Handover' section of stories 4-2 and 4-3

**Acceptance Criteria:**
- Given canonical, when the full Studio suite runs, then it has 0 failures
- Given R5-01..R5-17, when DEFECTS.md is read, then each has a dated status with an evidence path
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Evidence (2026-11-13/14, canonical `work/awc-native`, read-only verification; no product file changed by this story)
Jobs: `4-1-r5-post-install-verification-002-mac-canonical` (d5 lane), `-003-ios-canonical` (simulator AWC-d5, tree `work/d5-ios-tree-canon` = canonical bytes, no lab overlay), `-A002-android-canonical` and `-A003-rerun-android` (a6 / emulator-5566, tree `work/d5-android-tree` rsynced from canonical; `NativeTable.kt` md5 equals canonical), `-004-rerun-mac-states`, `-005-checkpoints`. Logs: `work/claude-runner/done/4-1-*.log`, `work/d5-lab/out/4-1/`. Orphan CPU hogs ran 11-12..11-14 00:06 Mac time; every timing failure below was re-run after that (004, A003) and reproduced unchanged except the Android chart paint timeout, which passed.

| Suite | macOS | iOS (AWC-d5) | Android (5566) |
|---|---|---|---|
| Studio (apps/native-playground `node --test`) | 872 tests, 872 pass, 0 fail | - | - |
| Chart paint | 1045/1045 | 1045/1045 | pass: 22 case groups, 2092 checks, 0 failures (A003; A002 ComposeTimeout under load) |
| Org chart paint | 1644/1644 | 1644/1644 | pass (1640 checks, 0 failures) |
| Org chart states | 1253/1253 | 1253/1253 | not part of 4-1 |
| Table paint | 7397/7397 | 7397/7397 (141 cases) | pass, 0 failures |
| Table states | 3813/3859 FAIL (3 runs: 002, 004 x2; identical) | 3859/3862 FAIL (3: pagination click-prev focus) | 3674/3725 FAIL (A002, A003; identical) |
| tools/ax (compare, 002) | md-table-pagination: 5 open on macOS; md-organization-chart, md-line-chart, md-table: 0 open | iOS 0 open | Android 0 open |

### What I did
- Read d5-030/d5-031: d5-030 printed INSTALLED; its Studio run had 852 pass / 3 fail, already fixed by main-queue d5-033 (chart-integration getInstance, orgchart hooks and parts tests; Studio 872/872). Re-run on today's canonical: 872/872 (job 002). AC "Studio 0 failures": met.
- Unreported in d5-031: `NativeTableStatesIntegration` was already 3842/3859 on canonical.
- Appended a dated status line to each of R5-01..R5-17 in `work/audit/DEFECTS.md` (script `work/d5-lab/out/4-1/defects-4-1.py`). FIXED: R5-01..R5-08, R5-10, R5-11, R5-15, R5-16, R5-17. PARTIAL: R5-09 (macOS), R5-12, R5-13. OPEN: R5-14.
- Checkpoints (job 005): `refresh` re-pinned md-organization-chart and md-table; `confirm md-organization-chart` with runs 002/003/A002 (verdict current); charts already current; md-table is `stale-recorded` on purpose because its suites do not pass on canonical (not confirmed).
- Decision (coordinator): the macOS tb-keyboard failure and the three uninstalled lab files are not installed here; exact items are in the 4-2 Handover.

### Open items / what is not done
- AC "full chain byte-identical": no install was made by this story; the verified trees are canonical bytes (iOS tree `d5-ios-tree-canon`, Android tree rsynced from canonical, macOS ran in canonical). `d5-033` is the only install covering this story's fix.
- AC "every claim has pass counts": met for suites above; the table states suite fails on all three platforms (see 4-2 Handover). R5-01 server route re-probe and R5-04 tableLabels assertions were not re-run.
- Not verified in 4-1: Laboratory part fields/compiled examples (none found for charts, org chart, table in `appearance-part-rules.js` / `native-api-examples.js`), `area-colors-hex` root cause.
- New regression found: macOS `tb-sort-rtl` fails 29 checks on canonical (absent in d5-031), see 4-2 Handover.


## Review Triage Log

