---
title: 'Navigation: wrapper parts, Android crumb label, iPad fixture'
type: 'bugfix'
created: '2026-11-13'
status: 'review'
story_key: '5-1-nav-wrapper-parts-and-android-label'
epic: 5
model: 'sonnet'
wave: 1
lanes: 'mac lanes d6 and d6b · android lane a6 (emulator-5566) · simulator AWC-d6'
lab: 'work/d6-lab (r6b/ and later patch folders)'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The four navigation components fail gate 7 on R6-17 (five layout-wrapper parts without typed targets; the exceptions were rejected), R6-22 (Compose standalone md-breadcrumb-item repaints its label one update late), R6-23 (md-tab-panel Laboratory copy colour differs between platforms) and the iPad half of R6-18 (fixture helper buttons at 1% opacity).

**Approach:** d6 had started the R6-17 patches. Finish them with Chrome ::part box cases, fix R6-22 test-first with a label-pixel test, pick the token on-surface colour for R6-23, and install di's ready fixture patch.

## Boundaries & Constraints

**Always:** Wrapper parts take a typed box target (background, border, radius, padding with layout shift), as breadcrumbs `list` already does. The rules in project-context.md apply.

**Never:** No exception records for the five wrapper parts.

</intent-contract>

## Code Map

- `work/d6-lab/PROGRESS.md` (R6-17 plan) and the newest `work/claude-runner/done/d6-05*.log`
- `work/di-lab/patch/r618-ipad-edge-opacity.py` -- ready fixture patch (5% opacity); same 1% pattern in the navigation-bar and tabs state tests
- `work/audit/DEFECTS.md` R6-17, R6-18, R6-22, R6-23; `work/audit/r6/recheck3/` -- reviewer probes
- `work/d6-lab/REQUESTS.md` -- d2's note that R6-22 is the renderer, not the host

## Tasks & Acceptance

**Execution:**
- [x] R6-17: typed box targets for breadcrumbs overflow, tab content, navigation-tab container and icon-container, toolbar fab-container on SwiftUI and Compose; Chrome cases in the four harnesses; paint checks; Laboratory visualParts and examples; docs
- [x] R6-22: Android test that reads label pixels after `disabled` and `current` updates (fails first), then the renderer fix; check trails in production composition too
- [x] R6-23: one token-based colour on both platforms, recorded as a decision
- [x] Install di's opacity patch in the toolbar, navigation-bar and tabs state tests; run iPad toolbar states x6
- [x] Install; mark R6-17, R6-18 (iPad), R6-22, R6-23 in DEFECTS.md; refresh and confirm the four checkpoints

**Acceptance Criteria:**
- Given each of the five wrapper parts, when a box style is set, then the native box matches Chrome's ::part case on macOS, iOS and Android
- Given a standalone md-breadcrumb-item on Android, when `disabled` or `current` changes, then the label colour changes in the same update
- Given iPad 26.3, when toolbar states run six times, then all pass
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Progress notes (2026-11-13/14, sonnet)
- Started from the previous agent's jobs. Lane logs d6/d6b ended 11-11; Mac was asleep for a while on 11-13/14 (bridge down).
- Already INSTALLED on canonical (d6-054-install-r622-623, 11-11): R6-22 Compose crumb link<->static swap, R6-23 md-tab-panel copy in on-surface token colour, R6-18 iPad 5 % helper-button opacity in toolbar/navbar/tabs states tests. Evidence: states toolbar 2396, navbar 189386, tabs 137124 (macOS); live tabs 46, live breadcrumbs 55; Android d6-A010 (5566) crumbLabelInkFollowsStateChanges ok, breadcrumbs paint 6106/0 failures; iPad toolbar d6b-021 x4 runs 2396/2396 each (+ d6b-023 iPad/-18 runs).
- R6-17 lives in private tree d6-tree (NOT installed yet). macOS d6-055: paint bc 6799, tb 8416, nav 17429, tabs 16111; states bc 76426, tb 2396, nav 189386, tabs 137124; examples typecheck; live 55/27/19/46. iOS d6b-023 (3 sims): paint 6799/8416/17429/16111, states tabs 132004, nav 189386 (189374 on AWC-d6-18), tb 2396, bc 76473 (76465 iPad), all exit 0. Android d6-A011 (5566): 8/9 pass; navigationBarMatchesChromePaint FAIL: box-container-ltr, box-container-dark-rtl, box-both-selected-labels flat pixels.
- Diagnosis (hypothesis): container box is 100 % tab width + border + padding and overflows the bar; Compose `Modifier.size` is clamped by the tab's fixed constraints, cutting the overflow (AWCNavigationBar.kt ~l.685). Fix: requiredSize (r617/android3.py).
- NOTE: d6-055/d6-A011/d6b-023 timing runs and anything 11-12 08:45 -> 11-14 00:06 Mac time ran under orphaned CPU-hog load; re-run timing suites before relying on them.

### Evidence / open items
(updated below as work proceeds)

### 2026-11-14 interim
- Verified R6-22 test-first: d6-A009 `before` (canonical Compose renderers): crumbLabelInkFollowsStateChanges FAIL (4 of 12 label-ink checks), breadcrumbItemStandaloneHooksAndUpdates FAIL, LivePreviewTabsHostTest.tabPanelPage FAIL ("panel's copy: label ink #000000 ... expected #1C1B1F"); `after`: crumbLabelInkFollowsStateChanges ok 3.28 s, tabPanelPage ok; later d6-A010: 3 tests 0 failures, paint 6106 checks 0 failures.
- R6-23 decision (to record in md-tabs.md / DEFECTS): inherited text in an md-tab-panel uses the theme's `on-surface` token colour on both platforms (SwiftUI already did; Compose now matches), reversible by removing the Compose panel colour in AWCTabs.kt (r6c/r622_623_fix.py).
- 5-1-A012 (emulator-5566, d6-tree): `requiredSize` was NOT enough: navbar container box still fails 3 flat-pixel cases (mean 2.32 -> 1.03, over6 774 -> 324; (437,32) still background). Cause: requiredSize centres the oversized content inside the clamped size, so offset + requiredSize shifts the box left and the right overflow is still missing. Fix now: paint the container / icon-container with `drawBehind` of a tab-sized layer at the box rect (r617/android3.py, rewritten) — no clamp, no clip.
- Queued: 5-1-001 (fresh snapshot of canonical into d6-tree, whole r617 pipeline + docs3.py, macOS suites), 5-1-A013 (Android fresh), 5-1-002 (iOS 3 sims + iPad toolbar states x6), then main-queue install d6-lab/install/5-1-install-r617.sh.

### Final record (2026-11-14)
All evidence below was produced AFTER the orphaned CPU-hog processes were killed (Mac 11-14 00:06); earlier d6-055 / d6-A011 / d6b-023 results are superseded.
- **Pipeline**: fresh rsync snapshot of canonical into d6-tree (5-1-001, 2026-11-14 13:39 Mac), then r617 scripts (swift_tests, swift, swift2, lab3, docs3, android, android_tests, android3) + merge2 fixtures + compiler build. Compiler tests 12/12.
- **macOS (5-1-001)**: paint breadcrumbs 6799, toolbar 8416, navigation-bar 17429, tabs 16111; states 76426 / 2396 / 189386 / 137124 (all pass); playground build; 27 SwiftUI part examples typecheck; studio 878/878; live breadcrumbs 55, navbar 27, nav 19, tabs 46.
- **iOS (5-1-002)**: iPhone 17 Pro 26.3, iPad Pro 26.3, iPhone 16 Pro 18.6 x 8 suites, all exit 0: paint 6799 / 8416 / 17429 / 16111; states tabs 132004, nav 189386 (189374 on 18.6), toolbar 2396, breadcrumbs 76473. R6-18 iPad toolbar states x6 (tbx1..6): 2396/2396 each.
- **Android (5-1-A013, emulator-5566, slot timing)**: 15/15 tests, 0 failures: four parity classes + LivePreviewTabsHostTest + LivePreviewBreadcrumbsHostTest + crumbLabelInkFollowsStateChanges; navbar paint 15777, tabs 12814, toolbar 7816, breadcrumbs 6362; states 189338 / 136956 / 1904 / 22306; breadcrumbs ink updates 12. Test-first for the Android container-box defect: d6-A011 FAIL (3 flat-pixel cases) -> 5-1-A012 (`requiredSize`, still FAIL, mean 2.32->1.03) -> draw-at-rect (android3.py) -> 5-1-A013 PASS. Compile of the 27 Compose part examples included.
- **R6-22 / R6-23**: installed earlier by d6-054-install-r622-623; test-first confirmed in d6-A009 (before: crumbLabelInkFollowsStateChanges FAIL 4 of 12, breadcrumbItemStandaloneHooksAndUpdates FAIL, tabPanelPage FAIL "#000000 expected #1C1B1F"; after: all ok). R6-23 decision (on-surface token colour on both platforms) recorded in md-tabs.md (this story), DEFECTS.md R6-23 and above.
- **Install**: main-queue 5-1-100-install-r617: dry run on a copy of canonical, 88 changed/new files byte-identical to the dry-run copy and to the tested d6-tree, generated files identical, then on canonical: compiler tests 12/12, paint x4 6799/8416/17429/16111, states x4 76403/2396/189386/137124, playground build, studio 878/878, live x4 55/27/19/46, Android test compile, APK on 5554, 4177 restarted and probed 200. Rollback armed (not needed). Byte identity re-verified with cmp.
- **Post-install (5-1-101-post)**: DEFECTS.md status lines on R6-17, R6-18 (iPad), R6-22, R6-23; AUDIT.md rows noted (verdict left to r6); md-tabs.md and md-breadcrumbs.md decisions; docs: the five exception records replaced by typed-box-target sections (md-toolbar "Exceptions": none); documentation test 14/14; checkpoints md-tabs, md-breadcrumbs, md-navigation-bar, md-toolbar refreshed and confirmed (report: current 4, stale none).
- **Open items**: (1) gate-7 re-check by r6 is pending (verdicts not changed by this story); (2) R6-22 "trails in production composition": trail crumbs are covered by the paint matrix label-ink checks, a separate non-Laboratory production run of a trail was not made; (3) d6-lab docs under docs/native-parity/audit/* are reviewer-owned and still show the old R6-17 text until r6 re-checks; (4) the Android states suites have not been re-run on canonical itself (they ran on the byte-identical tested tree; canonical got macOS suites, build, live hosts, Android compile).

## Review Triage Log

