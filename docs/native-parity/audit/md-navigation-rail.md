# Gate 7 audit (s7-24, 2026-11-20): md-navigation-rail (re-check after story 9-40)

**Verdict: PASS for md-navigation-rail.** Scope: the members test hang S9-40-01 (story 9-40 changed only the members TEST file, no product code). All other s7-18 gate results stand (section below). md-navigation-rail-tab has no checkpoint of its own; covered by the parent. No new blocking finding.

Reviewer: gate-7 reviewer s7-24, 2026-11-20, snapshot `work/audit/s7-24-tree`, lanes r4 / a6 (emulator-5566) / simulator AWC-r4. Jobs are `claude-runner/done/7-24-recheck-navigation-rail-2-<job>.log`.

## s7-24 re-run counts (own runs)
| Suite | Platform | Result | Job |
|---|---|---|---|
| Members fixture x20 | macOS | 20 of 20 runs 21/21, exit 0; process time 10-11 s each (runs 1 and 12 show 197 s and 695 s wall time only because they waited for the timing slot: "slot timing acquired" lines in members-run1/12.log; the run after acquiring took 10 s) | 002-macos |
| Members mutations (toggleLabel, disableFocusManagement, overflowIcon, mdSubmenuToggle) | macOS | each of the four fails with named checks (e.g. "toggleLabel custom", "ArrowDown does not move focus", "mdSubmenuToggle open then close payloads: []", "overflow-icon ... pixels match Chrome") | 003 |
| Rail paint | macOS / iPhone 26.3 | 19563/19563 each | 002, 005 |
| Rail states | macOS | 543503/543503 | 002 |
| Rail states | iPhone 26.3 x3 | 542701, 542785, 542785, all pass (run 1 has 84 fewer checks than runs 2-3; all pass, no failed check, so the one-frame class is not needed) | 005 |
| Rail states | iOS 18.6 x1 | 542435/542435 at load 321 | 007-ios18 |
| Rail paint | Android emulator-5566 x3 | 19416/0 failures x3 (A001 once showed one failure at load 363, not repeated: load class) | A001, A007 |
| Laboratory (4177 read-only) | live-nav x2 19 checks; preview-presentation x2; probe 6/6 sessions incl. rail update, expand/collapse on iOS and Android | pass | 006 |
| Examples | 68 Swift typecheck (S74ApiExamples) exit 0; 68 Compose compile BUILD SUCCESSFUL | pass | 006, A008 |
| tools/ax | macOS pass, iOS pass (4 accepted), Android pass (8 accepted), 4 cases; captures read (28 json+png in lab/ax-cmp, 0 error rows, every case has web and native elements, none "no web capture") | pass | 006, A003, A009 |

Side task from story 9-40 (not part of the rail verdict): CardStates 174047 and 172055 checks pass, TransferListPaint 2388 and 2388 pass, on macOS at load 22 to 224. No miss in 4 runs, so nothing is filed against md-card or md-transfer-list (job 004-side-card-transfer).

## Decisions
- S9-40-01: closed. The fault was the test (NSMenu.popUp runs a modal loop); 20 of 20 runs 21/21 in 10-11 s, four mutations fail. No product change, so no Web contract check was needed beyond the unchanged Laboratory probe.
- S7-4-02: stays closed (s7-18 proof); iPhone 26.3 x3 and iOS 18.6 states pass again here.
- Exceptions: none; the accepted ax conventions are those of s7-18.

## Findings
None new. S7-18-01 (non-blocking, iPhone one-check intermittent) did not recur in 3 iPhone runs and 1 iOS 18 run.

---

# Earlier audit: Gate 7 audit (s7-18, 2026-11-18): md-navigation-rail and md-navigation-rail-tab

**Verdict: PASS for md-navigation-rail and md-navigation-rail-tab.** This re-check supersedes the s7-4 FAIL of 2026-11-16 (blocking S7-4-01 and S7-4-02). The md-app-bar verdict and other s7-4 gate results stand. One non-blocking finding, S7-18-01.

Reviewer: gate-7 reviewer s7-18, 2026-11-18, snapshot `work/audit/s7-18-tree` (canonical with shim v5, keyArrivals and the `onScreen` fix as installed at that time).

## Re-run counts (own runs)
| Suite | Platform | Result | Job |
|---|---|---|---|
| Rail paint | macOS / iPhone 26.3 | 19563/19563 each | s7-18-...-002, -004 |
| Rail states | macOS | 543473/543473 | -002 |
| Rail states | iPhone 26.3, 11 runs | 9 of 11 fully pass; 3 runs have one failed check each (542075/542076, 542458/542459, 539796/539797), none in an RTL release cell | -004, -011 |
| Rail states | iOS 18.6 x2 / iPad 26.3 x1 | 542506/542506, 542546/542546 / 542475/542475 | -005, -006 |
| Rail states, no-fix copy (onScreen fix removed) | iPhone 26.3 x2 | 539149/539220 and 540980/541042: `standard-all-rtl release t+50 tab0` fails again (the S7-4-02 cells) | -009-ios-nofix-proof-v2 |
| Members tests (4 members, 21 cases) | macOS | 21/21; mutations (icon, submenu) fail as required | -002, -003 |
| Members, paint, states, mutation | Android emulator-5566 | members 21/21, paint 19416/0 fail, states 542487/0 fail, mutations fail as required | A001, A002 |
| tools/ax rail | macOS, iOS, Android | pass, 0 open findings (conventions as in s7-4) | -008, A003 |
| Laboratory test-live-nav | 4177 | 19 checks x2 | -008 |
| Laboratory probe (6 sessions, expand() with update order fixed) | iOS + Android | 6/6 (first rerun 010 had one Android 502 ANDROID_HOST_FAILED, passed on rerun) | -010, -012 |
| Kotlin examples | compile | BUILD SUCCESSFUL | A005 |

`test-preview-presentation` exit 1 ("Click inside the native preview") is the same as in s7-4-005 and outside this story.

## Decisions
- S7-4-01: closed. The four members (`toggleLabel`, `disableFocusManagement`, `overflowIcon`, `mdSubmenuToggle`) have tests on macOS and Android; a mutation run on each platform fails as required.
- S7-4-02: closed. Cause proof in both directions: with the `onScreen` fix the RTL release cells pass on iPhone 26.3 (11 runs), iOS 18.6 and iPad; with the fix taken out they fail again in both runs of job 009. The cause is the test harness, not the product.
- S914-01: closed. Android paint passes 19416/0 with the centred overflow trigger; macOS members/paint cover the same trigger (overflow-icon cases).
- md-navigation-rail-tab has no checkpoint file; child tags (md-table-cell is the same) are covered by the parent checkpoint. Not a finding.
- tools/ax conventions (no `navigation` landmark on iOS/Android; Android text extra) accepted as conventions, not defects.

## Findings
- S7-18-01 (non-blocking): iPhone 26.3 states suite has 1 failed check in 3 of 11 runs (focus t+66 tab2 frame sample; hover frames cover samples; toggle-expand frames cover samples), at loads 48 to 431. Same family as S7-6-02 and S96-01; not the RTL release cells. See DEFECTS.md.
