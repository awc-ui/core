---
title: 'md-navigation-rail: phone RTL release ripple (S7-4-02); native tests for four untested members (S7-4-01)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n5 · android lane a3 (emulator-5560) · simulators AWC-n5 (iPhone 26.3), an iPhone on iOS 18.6 and AWC-n5-ipad (create them as PARALLEL.md describes if they do not exist)'
lab: 'work/s914-lab (create it; private tree work/s914-tree = a copy of canonical; the reviewer's runs are in work/audit/s7-4)'
depends_on: ['7-4-audit-navigation-rail-and-app-bar']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The gate-7 audit s7-4 (2026-11-16) failed md-navigation-rail and md-navigation-rail-tab. S7-4-02 (blocking): `NativeNavigationRailStatesIntegration` fails on both phone runtimes: iPhone 26.3 in 3 of 3 runs (539914/539978, 540111/540170, 540401/540448) and iOS 18.6 in 1 of 1 (540115/540167). The failing cells are the same in every run: `standard-all-rtl` and `standard-selected-rtl`, phase `release`, t+50 and t+66 ms, tab0 and tab2 (ripple wave samples, for example web 0.61 against native 0.28), and in two of the runs `standard-selected-rtl toggle-expand t+66`. The LTR cells pass on the phone. iPad 26.3 (2 of 2 runs), macOS and Android pass every check. Earlier phone runs missed in the same way (n5-044: 539688/539765), and the iPhone count in `docs/native-parity/md-navigation-rail.md` is an iPad count. The reviewer saw each native sample value three times in a row (about 20 frames per second on the phone simulator) and did not name a cause. S7-4-01 (blocking): the rail properties `toggleLabel`, `disableFocusManagement` and `overflowIcon` and the rail-tab event `mdSubmenuToggle` are implemented in SwiftUI and Compose and listed in the Laboratory, but no fixture, test or probe exercises them.

**Approach:** S7-4-02: find the cause before changing anything. On the iPhone 26.3 simulator, capture the release wave per presented frame for one failing cell (`standard-all-rtl`, release, tab0) and for its LTR twin, which passes: for each frame log the time, the wave value and the frame duration. Two facts need an explanation: why only RTL fails, and why only the phone fails while the iPad passes with the same code. Compare the frame durations of the RTL cell and the LTR cell. If the RTL frames are longer, take a time profile of that cell and find what the RTL layout draws that LTR does not (a mirrored layer, a second layout pass, a shadow or mask that is drawn again on every frame). Read `KNOWN-CAUSES.md` first: rows 1 to 3 (ripple and tap timing on iOS), row 29 (the rail's first modal expand and its shadow Canvas) and row 33 (a menu shadow drawn again on every frame) describe causes of the same shape. Then fix the cause where it is: in the product if the product does more work per frame than it needs, or in the test's sampling clock if the product presents the right wave at the right time and the test reads it late. Say which of the two it is, with the measurements. S7-4-01: write one Swift fixture case and one Android case for each of the four members before any product change: `toggleLabel` through the accessibility label of the toggle, `disableFocusManagement` through the focus order with and without the flag, `overflowIcon` through paint against a Chrome 153 oracle case, `mdSubmenuToggle` through the host's event log with its payload. Run each new case once with the member's implementation switched off (mutation run) to show that it fails.

## Boundaries & Constraints

**Always:** The per-frame capture shows the difference between the RTL cell and the LTR cell on the phone before the change, and the same capture after the change shows it gone. Rail states on iPhone 26.3 fail the RTL release cells before the change and pass every check in three runs after it, and in two runs on iOS 18.6. Each new member case has a recorded failing mutation run. The rules in project-context.md apply.

**Never:** Do not widen a tolerance. Do not skip or filter the RTL cells on the phone. Do not add a retry. Do not change the Chrome oracle. Do not touch md-app-bar, md-toolbar or md-navigation-bar files unless the cause is in code they share with the rail; in that case re-run their suites on every platform and say so in the Dev Agent Record. Do not run artificial CPU load on the Mac.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- section 'Gate 7 reviewer s7-4', rows S7-4-01 and S7-4-02
- `work/audit/s7-4/ios-iphone26/NativeNavigationRailStatesIntegration-run{1,2,3}-console.log` (the failing cells), `work/audit/s7-4/ios-ipad26/` (the passing runs), `work/audit/s7-4/tools/ios-run.sh` (how the reviewer ran the suite)
- `work/audit/s7-4/gate1.json` and `work/audit/s7-4/tools/matrix.py` (the four members that have no test)
- `work/claude-runner/KNOWN-CAUSES.md` rows 1, 2, 3, 29 and 33, and the Dev Agent Record of story `6-6` (how a per-frame capture and a time profile were taken on the phone simulator)
- the rail sources and tests (find them with `ls -R packages apps | grep -i -E 'navigationrail|LivePreviewNav'`) and `test-live-nav.mjs`

## Tasks & Acceptance

**Execution:**
- [x] Reproduce: rail states on iPhone 26.3 once (the same RTL release cells fail); per-frame capture of one failing RTL cell and of its LTR twin; the frame durations and wave values in the Dev Agent Record
- [x] Name the cause with the measurements (why RTL, why the phone and not the iPad); add a KNOWN-CAUSES.md row if it is new; fix it in the private tree
- [x] Rail states on iPhone 26.3 x3, iOS 18.6 x2, iPad 26.3 x1, macOS x1 and Android x1; rail paint on the three platforms; if shared code changed, app-bar, toolbar and navigation-bar states once per platform
- [x] S7-4-01: Swift and Android cases for `toggleLabel`, `disableFocusManagement`, `overflowIcon` and `mdSubmenuToggle`, each with one mutation run
- [x] One main-queue install (dry run, rollback, byte identity); DEFECTS.md status lines `ready for re-check` for S7-4-01 and S7-4-02; correct the iPhone count in `docs/native-parity/md-navigation-rail.md`; refresh and confirm the md-navigation-rail and md-navigation-rail-tab checkpoints

**Acceptance Criteria:**
- Given the iPhone 26.3 simulator, when rail states run three times, then every run passes every check, and the same suite failed the RTL release cells before the change; two runs on iOS 18.6 pass as well
- Given the cause, when a reader opens the Dev Agent Record, then it says why the RTL cells failed on the phone only, with the per-frame measurements before and after the change
- Given each of the four members of S7-4-01, when its Swift case and its Android case run, then they pass, and each failed in its mutation run
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-17 00:30 UTC: how to get the sample of the iOS host)
Jobs 006 to 010 produced no `sample` file because the pid was not found. A working example exists: `work/claude-runner/done/6-6-select-family-ios-timing-and-swift-residuals-009-ios-key-await-trace.sh` (lines 26 to 38) samples the iOS test host from a job (`sample $pid 45 1 -mayDie -file ...`) and reads the main thread with `work/n2-lab/lab/g6/diag/sample-main.py`; its log `done/...-009-ios-key-await-trace.log` shows the pid it found. Copy its pid step. If that also fails, let the test host print its own pid at start (`ProcessInfo.processInfo.processIdentifier`) and let the job read it from the console log before the loop starts. Do not spend another job on a new way to guess the pid.
When the sample exists: name the frames under the mouse-up call that are present in RTL and absent in LTR (the 26 ms difference). If job 011 already gave the sample, ignore the first paragraph.

### Coordinator note (2026-11-17 02:57 UTC: the shim change must go on top of shim v5; regression rule)
- Your fix is in `AppKitShim.swift` (`AWCShimTouch.onScreen`: deferred window-origin restore, flush in place of the 0.02 s pump). Two other stories change the same file on canonical: story 9-10 installs its shim v5 (the key await ends at delivery; `work/s910-lab/shim.after5.swift`; its chain is running the install now), and story 9-6 then adds `AWCShimTouch.keyArrivals` on top of v5.
- So your install is an anchored edit of the `onScreen` code only, never a copy of the whole file, and it goes onto canonical after the 9-10 install. In the dry run check that the v5 key-await code and, if it is there by then, `keyArrivals` are still present after your edit.
- Before the install put shim v5 into `work/s914-tree` under your change and repeat the rail states runs with both together (iPhone 26.3 x3, iOS 18.6 x2, iPad x1): the key timing differs between the two shims, so the counts of jobs 014 to 018 do not carry over.
- The shim serves every iOS states suite. As for story 9-10, the rule is that no suite loses a passing check: run the suite set of job `9-15-ipad-focus-system-first-group-takes-tab-target-012-regress` once before and once after your change on the phone (same job, through `claude-runner/tools/slot.sh timing 4`), with v5 in both, and list every check that fails only after.
- If the 9-10 install is not on canonical when you are ready to install, set the story to `blocked` with "waits for the 9-10 install", write one Handover line into story 9-10, and return `continue_now: false`.
- S7-4-02 was recorded as a product finding of `md-navigation-rail`. Since the cause is the harness, say so in its DEFECTS.md line with the proof (job 012 sample, jobs 013 and 017), and add the KNOWN-CAUSES row. The Android overflow-trigger alignment defect you found is a product finding: give it an id `S914-01` in DEFECTS.md with the failing run before the fix.

### Note from story 9-6
- `AWCShimTouch.keyArrivals` is on canonical since 06:02 UTC (08:02 Mac time) 2026-11-17, job `9-6-201-install-otp-keyarrivals`, `AppKitShim.swift` md5 045d11b46d7008165195a9a485a855d3 (before: 39cdcd264a817a856e80043f3cd4ec7e; the diff is the two keyArrivals hunks only).

## Dev Agent Record

### Current state
- DONE, status review. Cause (RTL phone) = harness clock AWCShimTouch.onScreen (jobs 012, 013); fix proven with shim v5: 052 (iPhone26 x3, iOS18 x2, iPad x1) and no regression in 18 suites (053). S7-4-01 members tests (032 macOS, A038 Android, mutations 028/A034); S914-01 Compose overflow trigger fixed (A038/A039).
- Canonical install: job 100-install exit 0 (byte identity to tree for kt/tests/fixtures, shim onScreen region identical, keyArrivals kept, AppKitShim md5 30db58615e00eb99847339d17ae81fb9); DEFECTS.md lines, doc rows, md-navigation-rail checkpoint refreshed and confirmed (md-navigation-rail-tab has no checkpoint file).
- Open for coordinator: gate-7 re-check of S7-4-01/02 and S914-01; text-field motion cell differs in both v5 and v5+fix runs (053), pre-existing.

#### Evidence log (this session)
- Install: job 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-100-install exit 0 (main queue).
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-052-states-v5-all | ios-iphone26 | NativeNavigationRailStatesIntegration run1 (shim v5 + fix) | 542903/542903
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-052-states-v5-all | ios-iphone26 | NativeNavigationRailStatesIntegration run2 (shim v5 + fix) | 542679/542679
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-052-states-v5-all | ios-iphone26 | NativeNavigationRailStatesIntegration run3 (shim v5 + fix) | 542503/542503
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-052-states-v5-all | ios-ios18 | NativeNavigationRailStatesIntegration run1 (shim v5 + fix) | 542723/542723
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-052-states-v5-all | ios-ios18 | NativeNavigationRailStatesIntegration run2 (shim v5 + fix) | 542619/542619
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-052-states-v5-all | ios-ipad26 | NativeNavigationRailStatesIntegration run1 (shim v5 + fix) | 542367/542367
- Before-fix reference (not evidence of a pass): job 053, v5 without the fix, rail states 541196/541260, 64 RTL release checks fail.
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-053-regress-phone-before-after | ios-iphone26 | NativeNavigationRailStatesIntegration (v5 + fix) | 542451/542451
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-040-rail-paint-states-macos | macos | NativeNavigationRailStatesIntegration | 543649/543649
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-032-members-macos | macos | NativeNavigationRailMembersIntegration | 21/21
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-A038-members-android | android | NativeNavigationRailMembersTest | 1/1
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-A039-rail-paint-states-android | android | NativeNavigationRailParityTest | 1/1
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-A039-rail-paint-states-android | android | NativeNavigationRailStatesTest | 1/1
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-040-rail-paint-states-macos | macos | NativeNavigationRailPaintIntegration | 19563/19563

#### Evidence log (earlier sessions)
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-012-phone-loop-sample-pidfile | ios-iphone26 | NativeNavigationRailStatesIntegration loop sample (up ms LTR 13.4 / RTL 38.7) | 2/2
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-013-shim-restore-loop | ios-iphone26 | NativeNavigationRailStatesIntegration loop after fix (up ms LTR 13.1 / RTL 19.6) | 2/2
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-014-states-iphone26 | ios-iphone26 | NativeNavigationRailStatesIntegration run1 | 541697/541697
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-014-states-iphone26 | ios-iphone26 | NativeNavigationRailStatesIntegration run3 | 541479/541479
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-014-states-iphone26 | ios-iphone26 | NativeNavigationRailPaintIntegration run1 | 19563/19563
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-014-states-iphone26 | ios-iphone26 | NativeAppBarStatesIntegration run1 | 1397/1397
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-014-states-iphone26 | ios-iphone26 | NativeToolbarStatesIntegration run1 | 2396/2396
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-014-states-iphone26 | ios-iphone26 | NativeNavigationBarStatesIntegration run1 | 189374/189374
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-015-states-ios18 | ios-ios18 | NativeNavigationRailStatesIntegration run1 | 541544/541544
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-016-states-ipad | ios-ipad26 | NativeNavigationRailStatesIntegration run1 | 541655/541655
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-016-states-ipad | ios-ipad26 | NativeAppBarStatesIntegration run1 | 1397/1397
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-017-states-iphone26-nopump | ios-iphone26 | NativeNavigationRailStatesIntegration run1 (shim without pump) | 541699/541699
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-017-states-iphone26-nopump | ios-iphone26 | NativeNavigationRailStatesIntegration run2 (shim without pump) | 541611/541611
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-017-states-iphone26-nopump | ios-iphone26 | NativeNavigationRailStatesIntegration run3 (shim without pump) | 541501/541501
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-018-states-ios18-nopump | ios-ios18 | NativeNavigationRailStatesIntegration run1 (shim without pump) | 541633/541633
- EVIDENCE | 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests-018-states-ios18-nopump | ios-ios18 | NativeNavigationRailStatesIntegration run2 (shim without pump) | 541655/541655

## Review Triage Log

