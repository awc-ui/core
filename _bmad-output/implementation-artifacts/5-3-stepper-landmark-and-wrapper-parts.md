---
title: 'md-stepper: macOS landmark, wrapper parts, RTL slotted text'
type: 'bugfix'
created: '2026-11-13'
status: 'review'
story_key: '5-3-stepper-landmark-and-wrapper-parts'
epic: 5
model: 'sonnet'
wave: 2
lanes: 'mac lane fa · android lane a1 (emulator-5556) · simulator AWC-fa'
lab: 'work/fa-lab'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** R6-13 is open: the stepper has no navigation landmark on macOS. A probe (fa-090) showed the working construction (content in a nested hosting view inside an AppKit landmark container). Some stepper and step wrapper parts have no typed target, slotted text in RTL renders in natural direction where Chrome shows the mirrored punctuation, and `--md-slider-value-indicator-reserve` is missing from the CEM.

**Approach:** Build the landmark per the probe and decision 16 in md-stepper.md, add typed box targets for the wrapper parts, fix the shared text direction, fix the CEM entry, install.

## Boundaries & Constraints

**Always:** The nested host passes environment, sizing and inspection through (helper in the shared `NativeInspection.swift` via an anchored edit). The rules in project-context.md apply.

**Never:** Do not expose elements twice to accessibility.

</intent-contract>

## Code Map

- `work/fa-lab/PROGRESS.md` -- R6-13 plan; `work/claude-runner/done/fa-090*.log`, `fa-085*.log` -- probes
- `docs/native-parity/md-stepper.md` decision 16
- `packages/native-ios/Sources/AWCUI/AWCNativeView.swift` -- text nodes use natural paragraph direction
- `work/audit/DEFECTS.md` R6-13, R6-17 (wrapper bar), fa's status lines

## Tasks & Acceptance

**Execution:**
- [x] macOS navigation landmark for md-stepper; tools/ax shows the landmark and a consistent parent chain
- [x] Typed box targets for stepper `mobile-progress` and step `inner`, `indicator`, `text`, `connector-leading` on both platforms with Chrome cases
- [x] Shared slotted-text direction under RTL matches Chrome; run the suites of components with RTL slotted text
- [x] CEM lists `--md-slider-value-indicator-reserve` (docs generator), dist rebuilt
- [x] Install; mark R6-13 and the wrapper parts in DEFECTS.md; refresh and confirm checkpoints for slider, rating, stepper

**Acceptance Criteria:**
- Given md-stepper on macOS, when tools/ax compares it with Web, then the navigation landmark is present and 0 findings are open
- Given `dir=rtl` slotted text ending in punctuation, when rendered natively, then it matches Chrome's pixels
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (2026-11-14 16:00 UTC)

- All lanes were restarted at 15:50 UTC with a fresh 7-day clock; emulators 5554-5566 answer; the Mac is quiet (load 13). A fresh agent continues this story: the Dev Agent Record below is the state to continue from; do not redo what it records.

### Coordinator note (2026-11-15 09:30 UTC)

- The previous session ran out of room. Continue from the `left to do` list in the Dev Agent Record, in this order: isolate the two macOS views failures (`box-step-indicator-horizontal` and `-vertical`); run the iOS suites (AWC-fa, AWC-fa-ipad, AWC-fa-ios18); the macOS landmark R6-13; a real failing test for the RTL slotted text, and the RTL slotted-text suites of other components (the change is in shared `AWCNativeView`); promote the oracle; Laboratory fields and docs; then the install, copying the verified files with pre-image md5 checks because canonical moved.

### Coordinator note (2026-11-15 15:57 UTC)
- Session 3 fixed the macOS landmark RTL regression (NativeFaViewsIntegration 494/494, job 027). Continue from its ``### Current state (rewritten end of session 2 of run, 2026-11-16 Mac)
- DONE: everything. Code installed and byte-identical (048); canonical macOS views 494/494, stepper 222/222, RTL slotted-text suites of other components pass (AppBar, ButtonAppearance, List, OTP, Toolbar, TableStates; DatePicker differences pre-existing, see NOTE); ax md-step 0 open, md-stepper only the 4 relation findings; checkpoints slider/rating/stepper refreshed+confirmed (052); DEFECTS/AUDIT updated (050).
- NEXT: nothing; coordinator reads status review. Stray empty file 5-3-stepper-landmark-and-wrapper-parts.md.add (rm not permitted).
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-049-canonical-mac | macOS | NativeAppBarPaintIntegration (RTL slotted text, canonical) | 2217/2217
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-049-canonical-mac | macOS | NativeButtonAppearanceViewIntegration (canonical) | 24/24
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-049-canonical-mac | macOS | NativeListPaintIntegration (canonical) | 29418/29418
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-049-canonical-mac | macOS | NativeOTPFieldPaintIntegration (canonical) | 13164/13164
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-049-canonical-mac | macOS | NativeToolbarPaintIntegration (canonical) | 8416/8416
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-049-canonical-mac | macOS | NativeTableStatesIntegration (canonical) | 3859/3859
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-052-install-ax-ckpt | macOS | tools/ax md-step open findings on canonical (0 = pass) | 0/0
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-052-install-ax-ckpt | macOS | tools/ax md-stepper open findings excluding 4 relation (coordinator patch) | 0/0
- NOTE DatePicker: NativeDatePickerPaintIntegration on canonical 37183/37789 (exit 1, 126 cases pass, 27 recorded differences) is identical to the n64-tree sweep of 2026-11-15 20:48 (same counts, other owner, no stepper change): not caused by awcBidiParagraph; no EVIDENCE line claimed.
- 052: main-queue anchored edit of tools/ax/expectations.mjs (Decision 18 regex also allows bare panel name "Account", backup expectations.mjs.before-5-3-052), ax rerun on canonical, checkpoints md-slider / md-rating / md-stepper refreshed and confirmed.
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-027-final-mac | macOS | NativeStepperIntegration parity | 222/222
- FINDING (034/035, in-process AX check, fast: 10 s runs, template work/fa-lab/s53/check/LandmarkCheck2.swift, env AWC_ORI, AWC_EXP): panel text + Back/Continue (vertical) are in the nested AX tree after 2.5 s pump (035 exp=none), missing with 0.8 s pump (034). tools/ax (host pumps its loop between commands) shows an EMPTY panel (png has no panel text, group "Account" has no children) even with settle 2 s (033: still 11 open). 031-dbg: hostOpacity (md-step-enter) stays 0.0 until ~0.88 s after configure, then 1.0. Hypothesis: panel with hostOpacity 0 is dropped from paint/AX in the nested host and the host does not re-render after the fade; 036 tests switches o (opacity forced 1), h (accessibilityHidden off).
- ALSO: with `#text` without accessibilityRepresentation (028) the AXStaticText value carries a leading U+200E (035 output): after the panel is exposed the text will still differ from Web by that mark: restore `.accessibilityRepresentation { Text(s("text")) }` (backup AWCNativeView.before-5-3-028.swift) or strip the mark from the label.
- IN FLIGHT: 5-3-stepper-landmark-and-wrapper-parts-036-axexp (lane fa; waits for a timing slot; prints per-variant AXButton/AXStaticText of vertical.macos.json for AWC_EXP none/o/h/oh; out work/fa-lab/s53/out/036).
- fa-tree temp state: NativeStepper.swift panel tail replaced by `AWCExpPanel` modifier (env AWC_EXP switches o/d/h; default = old behaviour); remove after the cause is known (clean copy work/fa-lab/s53/NativeStepper.before-5-3-031.swift is the pre-experiment file, it has no DBG031). tools/ax/cases.mjs in fa-tree has `settle: 2` on md-stepper cases (backup cases.before-settle.mjs; restore). DBG030 comment in NativeInspection.swift: restore `.transformPreference(AWCNativeInspectionPreference.self) { $0 = [] }` if 036 shows no use.
- NEXT: 1) read 036 (`cut -c1-500 work/claude-runner/done/5-3-stepper-landmark-and-wrapper-parts-036-axexp.log`); fix the cause test-first (a check in LandmarkCheck2 with short pump, 0.8 s, must show panel text + Back/Continue); 2) rerun tools/ax (033 recipe, ~2 min when a slot is free); relation x4 is the coordinator-decided accessibilityLinkedUIElements patch (install time); 3) clean debug code, rerun views macOS + iOS (AWC-fa, AWC-fa-ipad, AWC-fa-ios18; recipe 5-3-012-ios.sh); 4) RTL proof + other components' RTL slotted-text suites; 5) Laboratory fields, md-stepper.md decision 16, DEFECTS, promote oracle; 6) main-queue install (NativeInspection.swift pre-image md5 f1f609743843c1b8223dd8470e867f6e; remove four md-stepper macOS landmark entries from canonical tools/ax/expectations.mjs), checkpoints slider/rating/stepper.
- Stray empty file 5-3-stepper-landmark-and-wrapper-parts.md.add in this folder: delete when rm is allowed.

### Note from story 1-3 (2026-11-16)
- `NativeDatePickerPaintIntegration` on macOS failed 606 checks (37183/37789) in your sweep because the test applied the Decision 9 year-scroll tolerance only with env `AWC_DP_D9`. The test now defaults to the motion capture (installed canonical, job `1-3-md-date-picker-finish-and-install-100-install-paint-test`): run it without env for 37183/37183 and with `AWC_DP_PAINT_NAME=datepicker-web-paint-reduced` for 37789/37789. Not a product regression.

## Dev Agent Record

### Current state (rewritten end of session 8 of run v5, 2026-11-16 ~00:55 Mac)
- DONE: all code verified in fa-tree; RTL test-first (047: old #text 492/494, fixed 494/494); install 048 INSTALL-OK (canonical byte-identical, dist rebuilt, docs/CEM/compiler regenerated, oracle promoted to outputs, md-stepper.md decisions 16/20 + wrapper parts, expectations/cases patched); Android A004 6 tests 0 failures (EVIDENCE below); canonical macOS views 494/494 and stepper 222/222 (049).
- IN FLIGHT (lane fa): 5-3-stepper-landmark-and-wrapper-parts-049-canonical-mac: still to print = RTL slotted-text suites of other components (AppBarPaint, ButtonAppearanceView, DatePickerPaint, ListPaint, OTPFieldPaint, ToolbarPaint, TableStates) and tools/ax md-stepper/md-step on canonical. Read: `grep -vE "build 0$" work/claude-runner/done/5-3-stepper-landmark-and-wrapper-parts-049-canonical-mac.log | cut -c1-200`. Add one EVIDENCE line per suite (pass/total from the "^Native" lines) and ax open counts (md-step 0; md-stepper only the 4 `controls` relation findings).
- NEXT (after 049): (1) if any other-component suite fails, find whether `awcBidiParagraph` is the cause (revert recipe in md-stepper.md decision 20) and fix; (2) main-queue job: `python3 tools/checkpoint-refresh.py refresh --tags md-slider,md-rating,md-stepper` then `confirm <tag> --runs <jobs> --note ...` (usage in tools/checkpoint-refresh.py main(), line ~530); (3) DEFECTS.md (work/audit): append dated status lines after R6-13 (line ~441), R6-11 (~429, slider reserve CEM) and R6-03 (~372, wrapper parts); AUDIT.md md-stepper row (line 73): replace "R6-13 (macOS landmark) open with a probe; awaiting r6 re-check." with the fixed text; (4) tick the tasks in this file, run `python3 work/bmad-coord/verify_evidence.py 5-3-stepper-landmark-and-wrapper-parts` (needs hard failures: 0), set status review.
- Stray empty file 5-3-stepper-landmark-and-wrapper-parts.md.add in this folder (rm not permitted).
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-048-install | macOS | install job (byte identity bad=0, sr-integration 4/4, documentation 14/14, stepper-integration 4/4) | 3/3
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-049-canonical-mac | macOS | NativeFaViewsIntegration rendered (canonical after install) | 494/494
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-049-canonical-mac | macOS | NativeStepperIntegration parity (canonical after install) | 222/222
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-A004-final-android | Android emulator-5556 | stepper paint | 142/142
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-A004-final-android | Android emulator-5556 | stepper paint extra | 6/6
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-A004-final-android | Android emulator-5556 | stepper paint extra2 | 25/25
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-A004-final-android | Android emulator-5556 | stepper states (4 files) | 48/48
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-A004-final-android | Android emulator-5556 | views web-paint | 140/140
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-A004-final-android | Android emulator-5556 | views web-paint-extra | 6/6
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-A004-final-android | Android emulator-5556 | views web-paint-extra2 | 22/22
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-A004-final-android | Android emulator-5556 | instrumented test classes (4 classes, 6 tests) | 6/6
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-045-ios | iOS iPad 26.3 | NativeSliderRatingIntegration | 444/444
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-045-ios | iOS iPad 26.3 | NativeStepperIntegration | 222/222
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-045-ios | iOS iPad 26.3 | NativeFaViewsIntegration rendered | 494/494
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-045-ios | iOS iPhone 18.6 | NativeSliderRatingIntegration | 444/444
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-045-ios | iOS iPhone 18.6 | NativeStepperIntegration | 222/222
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-045-ios | iOS iPad 18.6 | NativeFaViewsIntegration rendered | 494/494
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-047-rtltest | macOS | NativeFaViewsIntegration rendered, #text with direction mark (slotted-text-rtl, -rtl-vertical ink >= 0.99) | 494/494
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-047-rtltest | macOS | NativeFaViewsIntegration rendered, old #text, expected RED explained: test-first, the 2 RTL slotted-text failures before the fix | 492/494
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-044-final-mac | macOS | NativeFaViewsIntegration rendered | 494/494
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-044-final-mac | macOS | NativeStepperIntegration parity | 222/222
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-045-ios | iOS iPhone 26.3 | NativeSliderRatingIntegration | 444/444
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-045-ios | iOS iPhone 26.3 | NativeStepperIntegration | 222/222
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-043-axnofade | macOS | tools/ax md-step open findings (0 = pass) | 0/0
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-043-axnofade | macOS | tools/ax md-stepper open findings excluding 4 relation (coordinator patch) | 0/0
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-040-axclamp | macOS | tools/ax md-step open findings (0 = pass) | 0/0
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-027-final-mac | macOS | NativeFaViewsIntegration rendered | 494/494
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-027-final-mac | macOS | NativeStepperIntegration parity | 222/222

### Progress notes (2026-11-14, sonnet; private tree fa-tree, lab work/fa-lab/s53, lane fa)
- Baseline (5-3-001, fresh snapshot of canonical into fa-tree): AWCUI build 0; NativeStepperIntegration 206/206 (paint 142, extra 6, extra2 9, states 20/20/4/4).
- **CEM** (5-3-002, 5-3-003): the docs generator misses `--md-slider-value-indicator-reserve` because the hook sits on the line after `var(`; widening the regex (002) also adds hooks of app-bar, date-picker, navigation-rail and search (other owners), so the hook is documented in md-slider.css's header section instead (edits: work/fa-lab/s53/cem.py). Test-first: sr-integration with STYLESHEET_HOOKS emptied fails 3/1 before regeneration, passes 4/4 after; documentation test 14/14; only slider.json / components.json / stats.json / custom-elements.json / compiler catalog + ir/md-slider.json change. Not installed yet (dist rebuild belongs to the install).
- **Chrome oracle** (5-3-004, Chrome 153.0.8010.36): stepper-extra2.html gains 16 cases (box-step-{inner,indicator,text}-{horizontal,vertical}, box-step-all-{horizontal,vertical}-rtl, box-step-all-dot, box-step-connector-leading, box-mobile-progress{,-dots,-rtl}, slotted-text-{rtl,rtl-vertical,ltr}); the 9 old cases come out identical. Page: work/fa-lab/oracle2/stepper-extra2.html; capture: work/fa-lab/s53/oracle (NOT yet copied to outputs/native-parity/md-stepper/web-oracle).
- **Wrapper boxes, Swift layout** (patch scripts work/fa-lab/s53/edits/boxes_{swift,view,tests,views_test}.py, anchored): inner / indicator / text (md-step) and mobile-progress (md-stepper) take background, border, radius and padding as typed `AWCAccordionPartAppearance` fields with layout shift (content-box sizes, physical padding swapped in RTL, the part padding replaces the source's own, connector and panel offsets stay as Chrome: connector top is independent of inner padding). Test-first 5-3-005: before = canonical sources + new fixture: stepper paint (extra2) 10/25, 8 box cases FAIL (+ the 3 slotted-text cases need a 19 px bare-text panel in the harness). After (5-3-006): paint (extra2) 22/25, all 12 box cases pass; slotted-text cases fixed in the harness (defaultContentHeight 19), re-run in 5-3-007.

### Evidence after the Swift / Kotlin box work (2026-11-14, jobs in work/claude-runner/done/5-3-stepper-landmark-and-wrapper-parts-*)
- **macOS parity (5-3-010/011, fa-tree)**: NativeStepperIntegration 222/222, paint (extra2) 25/25 (before the patches: 10/25). Views (NativeFaViewsIntegration, stepper extra2): 23/25; `box-step-indicator-horizontal` and `-vertical` fail with mean 0.08, worst 8 levels (1676 / 1688 px over 6) inside the disabled / error bubble: native shows ~8 levels more of the indicator background under the bubble than Chrome; parity passes, cause not isolated (Android renders the same cases correctly). OPEN.
- **Shared slotted-text direction (5-3-011)**: `awcBidiParagraph` (AWCNativeView `#text`): the paragraph direction is the layout direction (RLM / LRM prefix). The Chrome cases `slotted-text-rtl`, `-rtl-vertical`, `-ltr` (active panel text 'Plan (see the docs)...') pass in the views suite before and after because the flat-pixel criterion ignores glyph ink; the measurable change is the lowest ink cover 0.970 (before) to 0.998 (after). No hard failing test existed first: tighten the ink-cover limit or add a pixel-ink comparison for a hard test-first. The suites of other components with RTL slotted text were NOT run. Android has no shared text node (slotted text is the host's Compose Text): nothing to change there.
- **Android (5-3-A001 before, 5-3-A003 after, emulator-5556, slot timing)**: before (canonical Kotlin, new fixture): paint extra2 11 failures, views box cases fail. After: 6 tests, 0 failures: stepper paint 142/142 + extra 6/6 + extra2 25/25, states 20/20 20/20 4/4 4/4, views extra2 22/22 (3 slotted-text skipped by design), StepperViewsTest, LivePreviewStepperHostTest. (A001 / A002 failed to compile because the patch scripts are not idempotent; A003 restores the canonical Kotlin first.)

### State for the next agent (status blocked: out of budget, not a technical block except the landmark which is unstarted)
In fa-tree (private tree, snapshot of canonical 2026-11-14 19:06 Mac time, canonical has moved on since: FieldTextInput / NativeDocumentOrder / NativeOTPField changed by other installs, not ours) these files differ from canonical and are verified as above: Swift `Stepper/StepperLayout.swift`, `Stepper/StepperParts.swift`, `Stepper/NativeStepper.swift`, `AWCNativeView.swift` (awcBidiParagraph), tests `NativeStepperIntegration.swift`, `NativeFaViewsIntegration.swift`; Kotlin `stepper/StepperLayout.kt`, `StepperParts.kt`, `NativeStepper.kt`, androidTest `StepperHarness.kt`, `FaViewsParityTest.kt`; `md-slider.css` (header line), `apps/native-playground/sr-integration.test.mjs` (STYLESHEET_HOOKS slider emptied); regenerated `apps/docs/src/data/*`, `packages/core/custom-elements.json`, compiler `generated/catalog.json` and `generated/ir/md-slider.json`. Patch scripts (apply ONCE to canonical content; the `rep` helper is not idempotent for edits whose old text sits inside the new text): work/fa-lab/s53/edits/{boxes_swift,boxes_view,boxes_tests,boxes_views_test,text_dir,boxes_kotlin,boxes_kotlin_tests}.py and work/fa-lab/s53/cem.py. For the install, prefer copying the verified fa-tree files with a pre-image check (md5 of canonical = snapshot) instead of re-running the scripts.
New Chrome oracle: work/fa-lab/s53/oracle/web-paint-extra2.json + shots/ (25 cases, Chrome 153.0.8010.36; page work/fa-lab/oracle2/stepper-extra2.html, parts-lib.js). NOT yet promoted to outputs/native-parity/md-stepper/web-oracle (web-paint-extra2.json, .sha256, paint-extra2-shots, the page), nor installed into Tests/Fixtures/stepper-web-oracle and the androidTest assets (fa-tree already has them).
**Left to do**
1. macOS landmark (R6-13), NOT STARTED: plan in work/fa-lab/PROGRESS.md (State 2026-11-11 ~23:30) and md-stepper.md decision 16; probe work/fa-lab/stepper/probe/LandmarkProbe.swift (variant B: NestedLandmark NSViewRepresentable, LandmarkContainer NSView role group, subrole AXLandmarkNavigation). Needs the environment / sizing / inspection pass-through helper in NativeInspection.swift (anchored edit), an in-process AX tree check, tools/ax in the Laboratory host, and removal of the md-stepper landmark expectation.
2. Isolate the two macOS views failures (box-step-indicator-*), fix test-first.
3. iOS simulator: run NativeStepperIntegration paint + views on the three runtimes (AWC-fa / AWC-fa-ipad / AWC-fa-ios18 clones exist; use harness recipe of fa-092 / fa-094 / fa-095); Android states already pass.
4. Stricter RTL text test, and run the suites of other components that render RTL slotted text; consider whether `awcBidiParagraph` should apply to Hebrew / Arabic text in LTR as it now does (LRM): not covered by an oracle.
5. Laboratory (stepper-appearance.js / examples: border fields for the new typed boxes), docs md-stepper.md (decision 16 text, parts list: mobile-progress, inner, indicator, text, connector-leading as typed boxes; connector-leading is `display: none` in the source, accepted and without effect, Chrome case `box-step-connector-leading` passes), CEM dist rebuild, main-queue install (dry run on a copy, rollback, byte identity), DEFECTS.md lines (R6-13, R6-03 wrapper parts, R6-17-style), AUDIT note, checkpoints for slider / rating / stepper (tools/checkpoint-refresh.py).
6. The other four components whose hooks the docs generator misses on a line after `var(` (app-bar search-*, date-picker field-*, navigation-rail horizontal-height, search *): not this story; report to the coordinator (fix the generator regex `var\\(\\s*` together with their owners' compiler / studio tests).

### Session 1 of 3 (2026-11-15, sonnet)
- box-step-indicator-* analysis (no code change yet; images work/fa-lab/s53/out/011/cap-after/md-stepper vs work/fa-lab/s53/oracle/shots): the diff is only inside the bubble of a disabled step (opacity .38 layer). Web interior = opaque surface-container-highest bubble over the page; native interior = web + about 0.7 x (indicator bg minus page) at .38, i.e. the indicator box background (#FFF3E0) tints the bubble although the bubble fill is opaque; native glyph ink and the 2px border (245,185,150 vs web 245,187,157) are also slightly warmer. The non-disabled steps pass. Next: dump bubbleColor.a of the disabled step and check whether `box()` fill plus bubble fill inside `drawLayer` with `l.opacity` is blended per primitive (SwiftUI GraphicsContext layer opacity) rather than as a group; if so draw the indicator group into a nested drawLayer or pre-multiply.
- 5-3-012-ios queued (queue-fa): iOS runs from fa-tree: iPhone 17 Pro 26.3 (slider/rating + stepper parity), iPad 26.3 (stepper parity + rendered views), iPhone 16 Pro 18.6 (stepper parity), iPad 18.6 (rendered views). Logs work/fa-lab/s53/out/012.
- **Cause of box-step-indicator-* found and fixed (5-3-013, macOS, fa-tree)**: `GraphicsContext.opacity` inside `drawLayer` applies per drawing operation on macOS/iOS 26, so the disabled indicator's box background tinted the bubble. Fix in `Stepper/NativeStepper.swift`: the fade is set on the parent of a nested isolated layer (`ctx.drawLayer { lo in lo.opacity = ...; lo.drawLayer { l in ... } }`); the old file is saved as work/fa-lab/s53/NativeStepper.before-opacity.swift. Test-first: 5-3-011 (before) views extra2 23/25 with exactly these two cases; 5-3-012 shows iPad 26.3 had the same 23/25 and iPad 18.6 25/25 (OS-dependent). After (5-3-013): macOS views stepper paint 140/140, extra 6/6, extra2 25/25, NativeFaViewsIntegration 494/494 (8 skipped); parity NativeStepperIntegration 222/222 (extra2 25/25, states 20/20 20/20 4/4 4/4). The same per-op pattern remains for `hostOpacity` (md-step-enter fade, outer layer) and text `glyphOpacity`; not covered by an oracle case, check if time.
- **iOS (5-3-012, fa-tree sources, before the opacity fix; the fix touches shared Canvas code, so the iOS views must be re-run after it)**: iPhone 17 Pro 26.3: SliderRating 444/444, Stepper 222/222. iPad Pro 11 26.3: SliderRating 444/444, Stepper 222/222, rendered views 492/494 (the same 2 box-step-indicator cases). iPhone 16 Pro 18.6: SliderRating 444/444, Stepper 222/222. iPad 18.6: rendered views 494/494 (stepper extra2 25/25). Job 5-3-012 exit 0.
- Hygiene: I created an empty stray file `5-3-stepper-landmark-and-wrapper-parts.md.add` in this folder by mistake (rm is not permitted): delete it.
- **Left to do now**: item 1 landmark (unstarted), item 4 RTL hard test and other components' RTL suites, item 5 (promote oracle, Laboratory fields, docs, install), re-run iOS views (iPad 26.3) after the opacity fix, Android unaffected (A003 passes).


### Session 3 (2026-11-15, sonnet) notes
- RTL landmark cause FOUND (jobs 023-dbgdir, 024-dirparam): in `AWCNestedLandmarkRepresentable.updateNSView` the representable's `context.environment.layoutDirection` reports LTR (the hosting view's) on updates, and the old chain applied `.environment(\.layoutDirection)` OUTSIDE `.transformEnvironment(\.self){ $0 = environment }`, so the transform overwrote it with LTR (debug: `root update ctx=ltr param=rtl` then `input dir=ltr`). Fix in fa-tree NativeInspection.swift: direction passed explicitly from `AWCNestedLandmark` (@Environment layoutDirection) and applied INSIDE (after) the transform. Backup work/fa-lab/s53/NativeInspection.before-dir.swift. 025 showed the reorder alone did not stick (input still ltr after `root update ctx=ltr param=rtl`, 026-dbg2). FINAL FIX (027): `AWCNativeStepper` passes its own `@Environment(\.layoutDirection)` explicitly as `directionOverride` to `AWCNativeStepperContent` when nested; the content resolves `direction = directionOverride ?? environment`. Backups: work/fa-lab/s53/NativeStepper.before-dbg.swift, NativeInspection.before-dir.swift.
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-027-final-mac | macOS | NativeFaViewsIntegration rendered (landmark, RTL fixed) | 494/494 (stepper paint 140/140, extra 6/6, extra2 25/25; 8 skipped)
- 022/025 (before the final fix) tools/ax: md-step 0 open; md-stepper 12 open: Back/Continue missing x1 each, relation x4 (pre-existing Web `controls`), text-extra "Account", text-missing "Complete this section..." x5.

## Review Triage Log


### Session 2 (2026-11-15, sonnet)
- **Landmark R6-13 (macOS)**: `AWCNestedLandmark` appended to fa-tree `NativeInspection.swift` (canonical pre-image md5 f1f609743843c1b8223dd8470e867f6e): `AWCNestedLandmarkView` (NSView, role group, subrole AXLandmarkNavigation, label, identifier) around an `NSHostingController` (sizingOptions []); the outer environment passes through with `transformEnvironment(\.self) { $0 = environment }`; sizing = `controller.sizeThatFits(in:)` with the proposed width; inspection: the nested root names the same coordinate space and reports its nodes up, the outer republishes them offset by the container origin. `NativeStepper.swift`: `AWCNativeStepper` is now a wrapper (macOS, not standalone: landmark labelled by `label`), the old struct is `AWCNativeStepperContent` (`nested` flag removes its own labelled container; backup work/fa-lab/s53/NativeStepper.before-landmark.swift). tools/ax expectations of the macOS landmark (role, readonly missing / name / text-extra) removed in fa-tree/tools/ax/expectations.mjs only (backup work/fa-lab/s53/expectations.before-landmark.mjs; the canonical copy has moved on: remove the four md-stepper macOS entries by anchored edit at install).
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-014-landmark | macOS | in-process AX tree (LandmarkCheck: 1 landmark "Checkout progress", 5 buttons, parent chain hosting < landmark) | pass
- EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-014-landmark | macOS | NativeStepperIntegration parity | 222/222
- 015 (tools/ax macOS+Web+compare, md-stepper md-step): the landmark is present (`navigation:Progress`), md-step 0 open; md-stepper 14 open: relation x4 (pre-existing: older captures had no Web `controls`), text-missing/extra "Complete" x5 each (LRM leak, new, from awcBidiParagraph).
- 016 (views, RTL hard test + landmark): `before` and `after` both 323/494: all stepper cases fail on host-box origin (0,0 instead of 24,24) from the nested host; not a verdict on the RTL test yet.
- Session 2 later jobs: 018/019-debug (origin cause), 020-views-ax: EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-020-views-ax | macOS | NativeFaViewsIntegration rendered | 473/494 (stepper paint 123/140, extra 6/6, extra2 21/25; all failures RTL); EVIDENCE | 5-3-stepper-landmark-and-wrapper-parts-020-views-ax | macOS | NativeStepperIntegration | 222/222; tools/ax md-step 0 open, md-stepper 11 open. 021-views identical 473/494. 021z-dircheck: nested host receives rightToLeft + dark.
