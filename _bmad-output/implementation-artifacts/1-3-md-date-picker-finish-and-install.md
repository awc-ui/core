---
title: 'md-date-picker: finish and install'
type: 'feature'
created: '2026-11-13'
status: 'review'
story_key: '1-3-md-date-picker-finish-and-install'
epic: 1
model: 'sonnet'
wave: 1
lanes: 'mac lane n4 · android lane a4 (emulator-5562) · simulator AWC-n4'
lab: 'work/n4-lab/dp (tree work/n4-tree)'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** md-date-picker is close on SwiftUI (macOS 127/129 paint cases, states 10402/10413) and has a Compose port and Laboratory files, but nothing is installed and several items are open.

**Approach:** Read the newest n4 results (n4-070 to n4-077, n4-A042), close the open items, then install.

## Boundaries & Constraints

**Always:** All three Web variants are native (no system pickers). Decisions 1-9 in `n4-lab/dp/docs/decisions.md` stand unless a test proves them wrong. The rules in project-context.md apply.

**Never:** No exception for Arabic or Hebrew text width if the shared font fallback (`n4-lab/dp/scripts/font-fallback.py`) makes it match; an exception needs the full record.

</intent-contract>

## Code Map

- `work/n4-lab/PROGRESS.md` -- state and the list of open items
- `work/n4-lab/dp/src` -- Swift and Android sources; `dp/scripts/dp-sync*.py` -- installers into a tree
- `work/n4-lab/dp/docs` -- decisions.md and md-date-picker.md draft with placeholders
- `outputs/native-parity/md-date-picker/web-oracle-mac` -- oracles

## Tasks & Acceptance

**Execution:**
- [x] Read n4-0765, n4-0766, n4-0767, n4-077, n4-A042 results; record counts here
- [x] Fix: docked year pick settling ~300 ms late; intermittent year-Enter focus on macOS; iOS mode-toggle tap during entry editing; iOS inspection left after reduced-motion commit-on-select close
- [x] Android: paint and a states test against the same fixtures, to full pass
- [x] Shared Arabic/Hebrew font fallback: verify against Chrome and run every suite whose fixtures contain Arabic or Hebrew
- [x] Laboratory gate 3 run, Android host test, Kotlin and Swift examples compile
- [x] tools/ax (closed, open, docked) run and recorded (closed 0 open; open / docked still carry findings: see open items); docs without placeholders, AUDIT row, checkpoint.json
- [x] Main-queue install (dry run of dp-sync on a copy, then canonical, byte identity), confirm checkpoint

**Acceptance Criteria:**
- Given the 129 paint cases and 24+24 state runs, when they run on macOS, iPhone 26.3, iPad 26.3 and Android, then all checks pass
- Given the font fallback touches shared label code, when the regression suites with Arabic or Hebrew fixtures run, then none regresses
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (09:11 UTC 2026-11-16, reopened: macOS paint 37183/37789)
- The coordinator reopens this story. `NativeDatePickerPaintIntegration` on macOS canonical fails 606 checks: 37183/37789, exit 1, with the same count in three runs since 2026-11-15 20:48 UTC (story 6-4 sweep on work/n64-tree and on its baseline; story 5-3 job `5-3-stepper-landmark-and-wrapper-parts-049-canonical-mac`). Log with the failing lines: `work/n64-tree/out/sweep/NativeDatePickerPaintIntegration.log`. The lines I read are all in case `hook-year-block-size`: the year grid and the year cells are 15 px off in y (`year-grid y -1487.0 vs -1472.0`, `year 1925 y -1479.0 vs -1464.0`).
- Your evidence had this suite at a full pass when you installed (job 100, 2026-11-14). So a later install or a changed fixture broke it. Find which: compare the date-picker sources and the paint fixture on canonical with the post-images of your install, and look at the installs after it that touch the date picker or shared sources (story 1-5 date-picker accessibility, story 1-4 iPad focus entry). The failure was already there at 20:48 on 11-15, so the 6-4 install of 11-16 is not the cause.
- Fix it failing-first: the suite fails 606 checks before the change and passes all after it. If another story's install caused it, fix it here and add a dated note to that story's Handover. Check whether iPhone, iPad and Android show the same 15 px in that case.
- Then once each on the fixed tree: macOS paint and states, iPhone and iPad paint, Android paint. One main-queue install (dry run, rollback, byte identity), confirm the md-date-picker checkpoint, EVIDENCE lines, verify_evidence.py, back to `review`. The gate-7 audit 7-11 starts when you are in review.
- Set `status: in-progress` while you work.

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Current state
- 2026-11-16 reopen CLOSED (all tasks done; status review). Cause: not a product regression. The paint test shows the Decision 9 year-scroll tolerance only with env `AWC_DP_D9`; the 6-4 sweep and 5-3 job 049 ran without it, so 3 x 202 hook-year cases (hook-year-block-size, -grid-gap, -grid-viewport-block-size) failed 606 checks (15 px = the bloom offset of Decision 9). My and 1-5's jobs always set D9 (iOS via IOS_ENV, Android awcDpD9=1).
- Fix (test only): `packages/native-ios/Tests/NativeDatePickerPaintIntegration.swift` treats the motion capture as the default (D9 on unless `AWC_DP_PAINT_NAME` contains "reduced"). Installed by main-queue job 100-install-paint-test (pre-image check, backup, byte identical with n4-tree). Renderer sources unchanged. Checkpoint confirmed (current, 27/27 pins).
- Failing-first: job 011 on canonical sources without env: 37183/37789, 606 fails (3 cases x 202); after the fixed test 37183/37183. iPhone, iPad, Android showed no 15 px difference (they pass with the same sources).
- Nothing in flight. Next: gate-7 audit 7-11. Note for 6-4 and 5-3 sweeps: no env needed any more.

Fail-first (job 011, macOS, canonical sources, no env): paint 37183/37789, 606 fails in 3 hook-year cases; not an EVIDENCE line because it is the reproduced defect.
Android paint counts (31436/31436, 32042/32042) are in outputs/native-parity/md-date-picker/r16/android-canon/paint-evidence.log and paint-r-evidence.log (job A012 prints only case names).
EVIDENCE | 1-3-md-date-picker-finish-and-install-011-mac-paint-d9-default | macOS | paint (motion fixture, no env) after fix | 37183/37183
EVIDENCE | 1-3-md-date-picker-finish-and-install-011-mac-paint-d9-default | macOS | paint reduced | 37789/37789
EVIDENCE | 1-3-md-date-picker-finish-and-install-011-mac-paint-d9-default | macOS | states | 10417/10417
EVIDENCE | 1-3-md-date-picker-finish-and-install-100-install-paint-test | macOS | canonical paint (no env) | 37183/37183
EVIDENCE | 1-3-md-date-picker-finish-and-install-100-install-paint-test | macOS | canonical paint reduced | 37789/37789
EVIDENCE | 1-3-md-date-picker-finish-and-install-012-canon-ios-paint | iPhone | canonical paint (no env) | 37181/37181
EVIDENCE | 1-3-md-date-picker-finish-and-install-012-canon-ios-paint | iPhone | canonical paint reduced | 37787/37787
EVIDENCE | 1-3-md-date-picker-finish-and-install-012-canon-ios-paint | iPad | canonical paint (no env) | 37181/37181
EVIDENCE | 1-3-md-date-picker-finish-and-install-012-canon-ios-paint | iPad | canonical paint reduced | 37787/37787
EVIDENCE | 1-3-md-date-picker-finish-and-install-A012-canon-android-paint | Android | canonical paint | 31436/31436
EVIDENCE | 1-3-md-date-picker-finish-and-install-A012-canon-android-paint | Android | canonical paint reduced | 32042/32042
EVIDENCE | 1-5-md-date-picker-accessibility-101-canon-iphone | iPhone | canonical states (earlier session, sources unchanged) | 10417/10417
EVIDENCE | 1-5-md-date-picker-accessibility-103-canon-ipad-rerun | iPad | canonical states (earlier session, sources unchanged) | 10417/10417
EVIDENCE | 1-3-md-date-picker-finish-and-install-A004-android-final3 | Android | states (earlier session, sources unchanged) | 10417/10417

### Progress notes (dev agent, 2026-11-13)
- Results read (all exit 0 unless noted): n4-0765/0767 iOS full: states 10416/10417, paint 37181/37181 (129 cases) and 37787/37787 (reduced); n4-0766 macOS: states 10416/10417, paint 37183/37183 and 37789/37789, debug docked/year/entry runs 2488/2488 x2; n4-077 Laboratory: live date picker 42 checks, picker-integration 6/6, studio suite 868 pass / 6 fail (3 flagged NEW vs baseline: avatar hooks, ai-instructions, picker README test; to triage); n4-A042 Android: states 10404/10417 (year keyboard scroll off by 1.7 px, drag scroll 0 px: Modifier.scrollable era); n4-A043 Android: compile failed (NativeDatePicker.kt:698 `value` resolved to an outer String).
- Root causes: (1) the single Apple failure `year-scroll: rows in view >= 21` is a test defect: 288 px viewport at 52 px pitch (36 + 16) touches 6 rows of 3 = 18 cells (verified by arithmetic: rows 2..7 for scrollTop 120). Threshold set to 18. (2) Android compile: `this.value` in the fling decay loop.
- Queued: 1-3-md-date-picker-finish-and-install-001-mac-ios-states-17 (lane n4), 1-3-md-date-picker-finish-and-install-A001-android-final (lane a4).


## Review Triage Log


### Progress notes 2 (dev agent, 2026-11-14, after the Mac sleep)
- Jobs 1-3-...-001-mac-ios-states-17 and ...-A001-android-final ran across the sleep and the CPU-hog window (11-12 08:45 to 11-14 00:06 Mac time); timing results are not trusted. Counts: 001 macOS states 10417/10417, iOS states 10417/10417; macOS docked/year/entry debug runs 2392/2488 and 2359/2488 (docked-pointer/pick-sep calendar bloom, under load: to re-run). A001 Android: compile ok, paint-9 31436/31436 (637 recorded differences), paint-9r 32042/32042 (31), states-9 10416/10417 (the one failure: `year-scroll: a 120 px drag scrolls the years (1466 -> 1466)`). The Android year keyboard-scroll failures of n4-A042 are gone (Modifier.scrollable era).
- Android drag defect: the parent `draggable` never saw the moves (the year md-buttons consume their pointer moves). Fix in dp/src/android/NativeDatePicker.kt: a touch `pointerInput` on the Initial pass (touch slop, consume while dragging so the cell's press is cancelled and its click suppressed, VelocityTracker fling). Backup: dp/backup-NativeDatePicker-android-1114.kt. First attempt failed to compile (`awaitEachGesture` is a PointerInputScope extension, qualified call invalid); fixed.
- Studio-suite triage (n4-077 "3 new failures"): avatar-integration (25 vs 11 hooks) and ai-instructions fail in the canonical tree too (run in the VM against work/awc-native: 2 fail), so they are not mine (another story / baseline timing). picker-integration "both pickers cover every source part" fails only in n4-tree: n4-tree packages/core is stale (10-30), so the compiler regenerated 21 IR files with a different md-color-picker cssParts order (popover last); the committed canonical IR passes. Cause: n4-077 did not resync packages/core. Fix: job 003-dp-lab-refresh = n4-077 plus an rsync of packages/core. The install must not carry regenerated files other than md-date-picker's.
- Queued: n4 lane 002 (macOS + iOS states-18 + 3 debug runs, clean machine), 003 (lab refresh), 004 (tools/ax mac/web/ios/compare); a4 lane A004 (Android compile, paint-11/11r, states-11), then A003 (lab androidTest + host tests + ax android; must run after n4-003).

### Progress notes 3 (dev agent, 2026-11-14)
- Clean evidence (machine free of the hog processes): `...-002-mac-ios-states-18`: macOS states 10417/10417 (all motion latencies printed), three docked / year / entry debug runs 2488/2488 each, iOS (AWC-n4) states 10417/10417. `...-A004-android-final3`: compile ok, paint-11 31436/31436 (637 recorded differences), paint-11r 32042/32042 (31), states-11 10417/10417 (the drag fix works; the year keyboard scroll matches Chrome). The earlier paint evidence (n4-0766/0767, A001: macOS 37183 / 37789, iOS 37181 / 37787, 129 cases each) stands: the renderer sources did not change in this session, only test thresholds and the Android drag gesture.
- n4-tree was stale (core, compiler inputs): `-003` aborted on a moved anchor in LiveRenderer/main.swift (md-autocomplete was added to the guard list); the lab patch anchor and marker were updated. `-005` on the refreshed tree: baseline 872 pass / 0 fail on canonical; with the patch 877 pass / 1 fail (new: ai-instructions "retain the original README"); live date picker 42 checks pass; date-picker-integration 6/6; Swift examples typecheck 0; test-preview-presentation fails identically on the canonical binary (md-autocomplete row click: not this story).
- Root cause of that one failure: the shared appearance guide (component-appearance-guide.mjs) samples `iconSize: 24` (a number, meant for md-badge); the date picker's `icon-size` hook is CSS text, so `getAIInstructions('md-date-picker')` threw "Icon size must be CSS text" (reported as unavailable). Fix: anchored edit in lab-patch-date-picker.py adding `md-date-picker -> { iconSize: '20px' }` to the guide's per-tag samples; `getAIInstructions` now succeeds for all 81 tags in the VM check.
- tools/ax first run (`-006`): web/macOS/iOS closed captured; macOS `open` and `docked`: "host exited" (to diagnose: job -008). Findings on closed: locale (native DD/MM/YYYY vs Web MM/DD/YYYY: the cases did not pin a locale; now `locale: 'en-US'` in all three cases) and the empty notch Legend (same accepted record as md-time-picker; an md-date-picker entry is added to tools/ax/expectations.mjs by the lab patch). A005 ran before the tree was prepared (no cases): invalid, to re-run.
- Queued: `-007` lab refresh (picks up the guide / ax edits), `-008` host diagnosis.

### Final record (dev agent, 2026-11-14) — status: review
**What changed (all in canonical, installed by main-queue job `1-3-md-date-picker-finish-and-install-100-install-md-date-picker`, exit 0, 03:55-03:57 Mac time):**
- md-date-picker dedicated renderers: SwiftUI (`NativeDatePicker.swift`, `DatePickerModel.swift`, `DatePickerAppearance.swift`, dispatch, md-button symbol size, composite keys, button focus ring, shared Arabic / Hebrew fallback faces in `NativeFonts.swift`) and Compose (`NativeDatePicker.kt`, model / appearance / runtime, `AWCComponent` dispatch); tests, fixtures, suite registration; Laboratory gate 3 (40 hooks, live hosts, 28 + 28 examples, registries, policies, tools/ax cases); component doc, AUDIT row, `checkpoint.json`.
- Fixed in this session: Android compile (`this.value` in the fling loop); Android year-grid touch drag (the md-buttons consume their pointer moves, so a parent `draggable` never saw them: touch `pointerInput` on the Initial pass with slop, consume, velocity-tracker fling); test defect in the Apple year-scroll check (6 rows x 3 = 18 cells at a 52 px pitch, not 21); lab patch anchors (md-autocomplete guard), shared appearance guide sample for `iconSize` (the studio test `ai-instructions` failed because `icon-size` is CSS text), `locale: en-US` and the legend record for the ax cases, AX capture thread stack (64 MB; a 512 KB stack overflowed in the live macOS host when the date picker's overlay was read: SIGBUS, "host exited"); Android host test node names (`day-<iso>`, docked trigger `md-text-field`).
- Earlier root causes (from n4-072 / n4-073, verified by the runs below): iOS entry-toggle (`applyInputMode` bumps `rt.settle`), docked year-pick settle (harness reveal lead, ripple bound, exit wait, grid preload).

**Evidence (job: counts):**
- macOS: `n4-0766` paint 37,183/37,183 (129 cases, 633 recorded differences), reduced 37,789/37,789 (27); `1-3-...-002-mac-ios-states-18` states 10,417/10,417 and three docked / year / entry debug runs 2,488/2,488 (clean machine, after the hog processes were killed).
- iPhone 17 Pro iOS 26.3 (AWC-n4): `n4-0767` paint 37,181/37,181 (635), reduced 37,787/37,787 (29); `-002` states 10,417/10,417.
- iPad Pro 11-inch (M5) iOS 26.3 (AWC-n4-ipad, own clone): `-010-ios-ipad` states 10,417/10,417, paint 37,181/37,181, reduced 37,787/37,787. Simulator shut down on exit.
- Android (emulator-5562): `-A004-android-final3` compile ok, paint 31,436/31,436 (637 recorded), reduced 32,042/32,042 (31), states 10,417/10,417.
- Arabic / Hebrew fallback: `n4-063` (macOS paint 129/129 with the ar-EG / he-IL toggle) and `-011-ff-regress` on canonical-now + dp sources: avatar 2,950/2,950, dialog paint 2,249/2,249, meter 5,085/5,085, accordion browser-state exit 0; no regression. The font exception (Android ar / he, iOS he) is proposed in the doc, acceptance pending gate 7.
- Laboratory: `-007` (refreshed tree incl. packages/core): studio 878 pass / 0 fail, date-picker-integration 6/6, live SwiftUI 42/42 (`-009`, canonical `-100`), Swift examples typecheck 0 (28), Compose androidTest compile with 28 examples (A009), `LivePreviewDatePickerHostTest` 2/2 and `LivePreviewPickersHostTest` 2/2 (A009). `test-preview-presentation` fails identically on the canonical binary (md-autocomplete row click, not this story).
- Install: dry run (--check of every anchored edit on a copy) passed; byte identity: 51 files against n4-tree + 584 fixture files, generated compiler files identical; canonical studio 878/0, playground build 0, live date picker 42, Android debug APK installed on emulator-5554 (build 18 s), 4177 server restarted, six probes 200, `checkpoint-refresh report`: md-date-picker current, 27/27 pins.

**Decisions:** decisions 1-9 stand. The ax tooling findings on the Apple closed case were resolved by pinning `locale: en-US` in the cases and adding the notch-legend record (same wording as md-time-picker); no other ax record was added.

**Open items (honest list):**
1. tools/ax is not at zero: closed 0 open; open / docked: macOS 26, iOS 99 (84 are the day buttons exposed as buttons where the Web has gridcells), Android 185 (79 ATF touch-target checks on the 40 dp days). Categories: tooltip descriptions missing (the Web's `md-tooltip` text; `awcTooltipDescription` is the hook on Apple, Android needs the equivalent), weekday header read as "S M T W F" (aria-hidden on the Web), no grid / row / dialog counterpart on macOS, Tab order of the overlay, Cancel / "Start" naming. Not accepted as exceptions; needs a fix task (it changes the renderers, so paint / states must be re-run for it) or gate-7 acceptance records. Evidence: `outputs/native-parity/md-date-picker/ax`.
2. The intermittent macOS `modal-year-keyboard-ltr/Enter` focus seen once on 11-06 (states-9) was not reproduced in the five full macOS runs and three debug runs since the focus-retry fix; no isolated cause, so it stays a watch item.
3. Fonts exception (Arabic / Hebrew widths on Android, Hebrew on iOS) awaits gate-7 acceptance.
4. The final iOS / Android suites ran on private packages synced from canonical plus the dp sources; canonical itself was verified by byte identity, the studio suite, the playground build and the live host test, not by re-running the paint / states suites on the installed tree.
