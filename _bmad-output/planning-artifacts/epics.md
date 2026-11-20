---
status: approved
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['docs/native-parity/AUDIT.md', '../audit/DEFECTS.md', '../claude-runner/PARALLEL.md']
---

# awc-native - Epic Breakdown (remaining work, 2026-11-13)

## Overview

53 of the 56 Laboratory components are installed natively (SwiftUI macOS + iOS, Compose) with Laboratory integration; 14 pass the independent gate-7 audit. This breakdown covers everything left: the last three components, the open gate-7 findings, the first audits of components without a verdict, the re-checks, and closure. Every story contains implementation and testing with acceptance criteria. One fresh agent runs one story.

## Requirements Inventory

### Functional Requirements

- FR1: every component matches the Web source contract (properties, events, methods, slots, CSS hooks, parts) on SwiftUI and Compose.
- FR2: every supported property, style, part, slot and method is exposed in the Laboratory with compiled SwiftUI and Compose examples.
- FR3: every component has a dated gate-7 verdict of PASS or PASS WITH ACCEPTED EXCEPTIONS.

### NonFunctional Requirements

- NFR1: paint, states and motion match Chrome 153 oracles on macOS, iPhone iOS 26.3, iPad 26.3, iOS 18.6 and Android within Chrome's own measured variance.
- NFR2: accessibility trees match Web (tools/ax) with 0 open findings or reviewed platform conventions.
- NFR3: canonical changes only through verified, reversible main-queue installs; no git commands by agents.

### FR Coverage Map

FR1/NFR1/NFR2: epics 1-6. FR2: epics 1, 4, 5, 6. FR3: epic 7. NFR3: all epics, checked in epic 8.

## Epic List

- Epic 1: Finish the last three components and their follow-ups
- Epic 2: Button family on iOS (gate-7 R1)
- Epic 3: Containment components (gate-7 r3)
- Epic 4: Charts, organization chart and table (gate-7 R5)
- Epic 5: Navigation, slider, rating and stepper (gate-7 R6)
- Epic 6: Inputs and pickers hardening
- Epic 7: Independent gate-7 audits
- Epic 8: Closure
- Epic 9: Gate-7 fix rounds

## Epic 1: Finish the last three components and their follow-ups

md-transfer-list, md-search and md-date-picker are the only components not yet installed in canonical. Bring each to the full definition of done.

### Story 1.1: md-transfer-list: finish and install

Model: sonnet · Wave: 1 · mac lane n1 · android lane a2 (emulator-5558) · simulator AWC-n1

md-transfer-list has SwiftUI and Compose renderers, tests and 12 typed parts in a private tree, but it is not installed in canonical and a few behaviours were still failing.

**Acceptance Criteria:**

- Given the Chrome oracle runs, when the native paint and states suites run on macOS, iOS and Android, then every check passes or is a documented Chrome sampling gap
- Given a tap on an enabled mover, when it moves items, then focus is on the mover as in Chrome, on every platform that has focus
- Given the Laboratory server on 4177 after install, when an md-transfer-list preview opens on iOS and Android, then frames are valid and a property update and a part style apply in place
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/1-1-md-transfer-list-finish-and-install.md`

### Story 1.2: md-search: finish and install

Model: sonnet · Wave: 1 · mac lane n3 · android lane a3 (emulator-5560) · simulator AWC-n3

md-search has SwiftUI and Compose renderers that went through ten fix rounds, but typed parts, Laboratory gate 3, accessibility, docs and the canonical install are not finished.

**Acceptance Criteria:**

- Given the Mac Chrome oracles, when paint and states run on macOS, iPhone 26.3, iPad 26.3 and Android, then all checks pass (states x3 per iOS runtime)
- Given each of the 19 parts, when a part style is set natively, then the rendered box matches Chrome's ::part case
- Given the md-text-field suites, when they run after the install, then their counts are unchanged
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/1-2-md-search-finish-and-install.md`

### Story 1.3: md-date-picker: finish and install

Model: sonnet · Wave: 1 · mac lane n4 · android lane a4 (emulator-5562) · simulator AWC-n4

md-date-picker is close on SwiftUI (macOS 127/129 paint cases, states 10402/10413) and has a Compose port and Laboratory files, but nothing is installed and several items are open.

**Acceptance Criteria:**

- Given the 129 paint cases and 24+24 state runs, when they run on macOS, iPhone 26.3, iPad 26.3 and Android, then all checks pass
- Given the font fallback touches shared label code, when the regression suites with Arabic or Hebrew fixtures run, then none regresses
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/1-3-md-date-picker-finish-and-install.md`

### Story 1.4: iPadOS: keyboard focus entry and wrap when nothing is focused (shared focus bridge)

Model: opus · Wave: 2 · mac lane di · no Android lane · simulator AWC-di-ipad (create it as a clone of iPad Pro 11-inch (M5), iOS 26.3, the way AWC-n1-ipad was made)

On iPad, when no AWC view is first responder, the UIKit focus system picks the entry view itself: Shift+Tab from the page's first control re-enters at that control's neighbour instead of wrapping to the last stop, and Tab after a tap on empty space enters near the tap or at the remembered row (in RTL at the target search) instead of the first stop in loop order. md-transfer-list fails 25 of 136 states checks and 6 of 2388 paint checks on iPad because of it (jobs 1-1-...-019, 021, 024). The cause is in shared code: `AWCNativeButtonFocusView` in `NativeFocusBridge.swift`, with the same pattern in `AccordionScrollBridge.swift`.

**Acceptance Criteria:**

- Given no AWC view is first responder on iPad, when Tab or Shift+Tab is pressed on a hardware keyboard, then focus enters at the stop Chrome's oracle shows, in LTR and RTL
- Given a tap on empty space, when Tab is pressed, then the focused stop matches the oracle
- Given the fix, when the iPad states suites of the other bridge users run, then their counts are unchanged
- Given 8 iterations pass without a full pass, when the agent stops, then no product file is left changed and the story holds a complete exception record proposal with measurements

Story file: `_bmad-output/implementation-artifacts/1-4-ipad-focus-entry-shared.md`

### Story 1.5: md-date-picker: accessibility tree parity for the open and docked cases

Model: sonnet · Wave: 2 · mac lane n4 · android lane a4 (emulator-5562) · simulator AWC-n4 (iPad clone AWC-n4-ipad) · Depends on: 1-3-md-date-picker-finish-and-install

md-date-picker is installed (story 1-3) and its paint and states suites pass on macOS, iPhone, iPad and Android, but tools/ax compare is clean only for the closed case. The open and docked cases have 26 open findings on macOS, 99 on iOS and 185 on Android: tooltip descriptions the Web exposes and the native header buttons do not, the weekday header read as 'S M T W F', missing dialog, grid and row roles on macOS, day buttons where the Web has gridcells on iOS, the overlay's Tab order, and 79 Android touch-target checks.

**Acceptance Criteria:**

- Given the three tools/ax cases, when compare runs on Web, macOS, iOS and Android, then there are 0 open findings, and each reviewed expectation names one platform convention and its reason
- Given the renderer changes, when paint, reduced and states run on macOS, iPhone, iPad and Android, then the counts equal story 1-3's or each difference is explained
- Given the open picker, when the accessibility tree is read in order, then the weekday header, the grid and the action buttons come in the Web's order
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/1-5-md-date-picker-accessibility.md`

## Epic 2: Button family on iOS (gate-7 R1)

Five button-family components fail gate 7 only on iOS. Close R1-12, R1-13, R1-14, R1-16 and the stale records.

### Story 2.1: Button family: iOS motion and capture findings

Model: sonnet · Wave: 1 · mac lane fx · android lane a1 (emulator-5556) · simulator AWC-fx

md-fab, md-button-group, md-icon-button, md-segmented-button and md-split-button fail gate 7 on iOS only: R1-12 (FAB extend/collapse 2-3 frames behind Chrome), R1-13 (fast-click and Enter pixel shots), R1-16 (button-group disabled-child width), plus R1-14, R1-09, R1-10.

**Acceptance Criteria:**

- Given family states on iPhone 26.3 and iOS 18.6, when run three times each, then every run passes in full
- Given a property change that starts the FAB extend, when the first frames are late, then each native width matches Chrome's curve for that timestamp
- Given macOS and Android, when the family suites run after install, then counts equal the pre-change counts
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/2-1-button-family-ios-motion-and-captures.md`

### Story 2.2: SwiftUI TimelineView tick skip: the remaining sites

Model: sonnet · Wave: 2 · mac lane fx · no Android lane · simulator AWC-fx (and its iOS 18.6 clone) · Depends on: 2-1-button-family-ios-motion-and-captures

Story 2-1 found that `TimelineView(.animation(minimumInterval: 1/60))` skips a display tick when ticks arrive slightly under 16.67 ms apart, which produced one-frame-late motion samples in the button family (KNOWN-CAUSES.md row 1). The same construct remains at 6 sites in 5 files: `NativeButtonLoading.swift` (2), `NativeStatusDot.swift`, `NativeSkeleton.swift`, `NativeMeter.swift`, `NativeLoadingIndicator.swift`. (`NativeMenu.swift` has one more; story 6-6 owns it.) Four of these components already have a gate-7 PASS, so nothing may change there without a failing test.

**Acceptance Criteria:**

- Given each of the 6 sites, when the story ends, then it is either fixed with a test that failed before, or recorded with five clean runs per target
- Given a changed component that had a gate-7 PASS, when its suites run again, then the counts equal its checkpoint or the difference is explained
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/2-2-timelineview-tick-skip-remaining-sites.md`

## Epic 3: Containment components (gate-7 r3)

Land the verified fixes for divider, avatar, card, list, accordion and dialog, and solve window-level stacking.

### Story 3.1: Containment: land batch 3 and window-level stacking

Model: sonnet · Wave: 1 · mac lane d3 · android lane a5 (emulator-5564) · simulator AWC-d3

Most r3 findings and R4-03 are fixed in d3's tree but some are marked FIXED* because their canonical install (batch 3, including the Web fixes r3-25 and r3-26) has not run. r3-19 (floating accordion panel and dragged card stack only among siblings) is designed but not finished.

**Acceptance Criteria:**

- Given a floating accordion panel or a dragged card inside nested app containers, when it overlaps content outside its parent, then it paints above it as in Chrome on SwiftUI and Compose
- Given the batch-3 install, when the r3 suites run on canonical, then every count equals the rehearsal's
- Given the DEFECTS.md r3 table, when read after the story, then no row is FIXED* and each FIXED row cites an installed job
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/3-1-containment-batch-install-and-stacking.md`

## Epic 4: Charts, organization chart and table (gate-7 R5)

Confirm what the R5 install closed, then finish the open table, chart and org-chart items.

### Story 4.1: R5: verify the install, fix studio tests, produce the status table

Model: sonnet · Wave: 1 · mac lane d5 · android lane a6 (emulator-5566) · simulator AWC-d5

The R5 install (d5-030) printed INSTALLED and d5-031 ran the canonical suites and tools/ax, but nobody read the results, the DEFECTS marks were never applied and three Studio tests fail on canonical (md-line-chart getInstance; org-chart hooks and state-layer).

**Acceptance Criteria:**

- Given canonical, when the full Studio suite runs, then it has 0 failures
- Given R5-01..R5-17, when DEFECTS.md is read, then each has a dated status with an evidence path
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/4-1-r5-post-install-verification.md`

### Story 4.2: md-table family: close the open items

Model: sonnet · Wave: 2 · mac lane d5 · android lane a6 (emulator-5566) · simulator AWC-d5 · Depends on: 4-1-r5-post-install-verification

md-table still has open items after the R5 install: Android row glide starting 2-3 frames late (tb-sort), Android tb-contract top region 5 px taller, macOS tb-contract select-all first frame late, iOS pagination focus after click-prev, pagination accessibility (R5-09), and five macOS tools/ax findings (rows named where Web leaves them unnamed).

**Acceptance Criteria:**

- Given tb-sort and tb-contract runs, when they run on Android, iOS and macOS, then they pass in full three times
- Given md-table-pagination, when tools/ax compares platforms with Web, then names, roles and Tab order match
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/4-2-md-table-open-items.md`

### Story 4.3: Charts and organization chart: typed parts and remaining R5 items

Model: sonnet · Wave: 2 · mac lane d4 · android lane a6 (emulator-5566) · simulator AWC-d4 · Depends on: 4-1-r5-post-install-verification

Chart parts (R5-06) were wired on SwiftUI only for some sites; Compose chart parts, zoom part sites, the 14 org-chart parts, Laboratory part fields and examples, and the `area-colors-hex` fill colour difference were open before the install.

**Acceptance Criteria:**

- Given every published chart and org-chart ::part case, when rendered natively on macOS, iOS and Android, then boxes and pixels match Chrome
- Given the five charts' paint suites, when they run on all platforms, then every case passes
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/4-3-charts-and-org-chart-parts.md`

## Epic 5: Navigation, slider, rating and stepper (gate-7 R6)

Close the remaining R6 findings for breadcrumbs, tabs, navigation bar, toolbar and stepper.

### Story 5.1: Navigation: wrapper parts, Android crumb label, iPad fixture

Model: sonnet · Wave: 1 · mac lanes d6 and d6b · android lane a6 (emulator-5566) · simulator AWC-d6

The four navigation components fail gate 7 on R6-17 (five layout-wrapper parts without typed targets; the exceptions were rejected), R6-22 (Compose standalone md-breadcrumb-item repaints its label one update late), R6-23 (md-tab-panel Laboratory copy colour differs between platforms) and the iPad half of R6-18 (fixture helper buttons at 1% opacity).

**Acceptance Criteria:**

- Given each of the five wrapper parts, when a box style is set, then the native box matches Chrome's ::part case on macOS, iOS and Android
- Given a standalone md-breadcrumb-item on Android, when `disabled` or `current` changes, then the label colour changes in the same update
- Given iPad 26.3, when toolbar states run six times, then all pass
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/5-1-nav-wrapper-parts-and-android-label.md`

### Story 5.2: Web source: slotted text missing from Chrome's accessibility tree (R6-15)

Model: opus · Wave: 2 · mac lane d6b · no Android · no simulator

On cold loads Chrome leaves slotted text out of its accessibility tree in a fraction of loads: collapsed and full breadcrumb trails (5/24, 3/24), tab panel (2/24), md-step open panel (about a quarter to a third). md-accordion-item had the same defect, fixed by creating the ripple after first render; that fix only partly helps md-step.

**Acceptance Criteria:**

- Given the fixed build, when each case is cold-loaded 24 times, then the slotted text is present in all 24 trees
- Given the affected components' Web suites, when they run, then they pass
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/5-2-web-slotted-text-accessibility.md`

### Story 5.3: md-stepper: macOS landmark, wrapper parts, RTL slotted text

Model: sonnet · Wave: 2 · mac lane fa · android lane a1 (emulator-5556) · simulator AWC-fa

R6-13 is open: the stepper has no navigation landmark on macOS. A probe (fa-090) showed the working construction (content in a nested hosting view inside an AppKit landmark container). Some stepper and step wrapper parts have no typed target, slotted text in RTL renders in natural direction where Chrome shows the mirrored punctuation, and `--md-slider-value-indicator-reserve` is missing from the CEM.

**Acceptance Criteria:**

- Given md-stepper on macOS, when tools/ax compares it with Web, then the navigation landmark is present and 0 findings are open
- Given `dir=rtl` slotted text ending in punctuation, when rendered natively, then it matches Chrome's pixels
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/5-3-stepper-landmark-and-wrapper-parts.md`

## Epic 6: Inputs and pickers hardening

Finish the select family, make the pickers and text fields audit-ready, and remove shared residual risks.

### Story 6.1: Select family: accessibility round, iOS runs, audit readiness

Model: sonnet · Wave: 1 · mac lane n2 · android lane a2 (emulator-5558) · simulator AWC-n2

md-select and md-multi-select are installed with gate 3, but n2's accessibility pass found real defects (no menu outside a menu scope on the Android Laboratory host, exposed aria-hidden clear button, lost checkbox role and mixed state on 'Select all', clear button outside the key-view loop, missing polite count announcement, placeholder exposed as text). iOS state runs, tools/ax evidence and checkpoints are open; the Android md-menu-item press wave is 2-4 colour levels light after picking in multiple mode.

**Acceptance Criteria:**

- Given select and multi-select states, when they run on macOS, iPhone 26.3 and Android three times, then all pass
- Given tools/ax on all platforms, when compared with Web, then names, roles, states and Tab order match
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/6-1-select-family-finish.md`

### Story 6.2: Colour and time pickers: audit readiness

Model: sonnet · Wave: 2 · mac lane fi · android lane a1 (emulator-5556) · simulator AWC-fi

md-color-picker and md-time-picker are installed and pass on macOS and Android, but have no gate-7 verdict. Their checkpoints may be stale, their contract matrix has not been checked row by row, and iOS still misses 4-26 dial-tap hand samples per device.

**Acceptance Criteria:**

- Given both pickers' states suites, when run on the three iOS runtimes, then they pass in full or each remaining sample is a documented Chrome sampling gap proven by a probe
- Given the contract matrix, when a reviewer checks any row, then it has an implementation, a Laboratory control and a test
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/6-2-pickers-audit-readiness.md`

### Story 6.3: Text fields: Shift+Tab, OTP focus and render, checkpoints

Model: sonnet · Wave: 2 · mac lane d2 · android lane a3 (emulator-5560) · simulator AWC-d2

Open items on the installed text-field family: Shift+Tab out of a text field moves forward on macOS (probe by n2), the OTP reduced-motion `type-12` focus failure on plain canonical (2 of 3 runs), md-otp-field sometimes not rendering a value written during an update (found by d2), and md-text-field's iOS checkpoint is unconfirmed.

**Acceptance Criteria:**

- Given a text field between two buttons on macOS, when Shift+Tab is pressed, then focus moves to the previous button
- Given OTP reduced-motion typing, when run ten times on macOS, then focus advances every time
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/6-3-text-fields-followups.md`

### Story 6.4: Shared closure bindings and navigation residuals

Model: sonnet · Wave: 2 · mac lane n5 · android lane a3 (emulator-5560) · simulator AWC-n5

d4 found that closure-based `open` bindings made sheets republish every frame and get stuck; `AWCNativeView.swift` (around lines 147 and 152) still builds closure-based bindings for other controls. Separately, Android app-bar states `leading-pointer-light-ltr leave` failed twice under load, and the rail's first modal expand starts 12-16 ms beyond two frames on macOS.

**Acceptance Criteria:**

- Given the converted bindings, when the full Swift fixture sweep runs, then no suite regresses
- Given 20 loaded runs of Android app-bar states, when they finish, then all pass
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/6-4-shared-bindings-and-nav-residuals.md`

### Story 6.5: macOS test harness: the test window loses key status during states runs (shared)

Model: opus · Wave: 2 · mac lane d2b (second lane d4b for the two-suites-at-once runs) · no Android lane · no simulator

During macOS states runs the test window loses key status: story 6-1 counted up to 40 losses in one run even on a quiet Mac (jobs `6-1-select-family-finish-011-keywindow` and `-012-keywindow-v2`). Pointer picks are then lost and select states fall from 1030/1030 to 1018-1029, multi-select from 872/872 to 867-871. Every component's macOS states suite uses the same harness, and several stories run macOS suites at the same time, so this can be the cause behind other findings recorded as flaky on macOS.

**Acceptance Criteria:**

- Given a states run on macOS, when another window or application takes key status, then no input is lost, or the loss is detected and reported by name
- Given two macOS states suites running at once in two lanes, when each finishes, then neither lost an input to the other
- Given the fix, when the select and multi-select states suites run three times, then all runs pass
- Given the six regression components, when their macOS states run on the patched harness, then no check fails that passed before

Story file: `_bmad-output/implementation-artifacts/6-5-macos-harness-key-window-loss.md`

### Story 6.6: Select family: iOS timing, Swift menu wave, macOS chip wrap

Model: opus · Wave: 2 · mac lane n2 · no Android lane · simulator AWC-n2

On iOS the select states are at 1013/1030 and multi-select at 867/872 (job `6-1-select-family-finish-003-macos-ios-states`): opening from the hardware keyboard and the touch-release phases are timed late. On macOS the multi-select paint has 10 of 1222 inline chip wrap failures with the current md-text-field. `NativeMenu.swift` still has the `TimelineView(minimumInterval: 1/60)` construct that skipped display ticks in the button family (KNOWN-CAUSES.md row 1), and the menu-item press wave misses frames.

**Acceptance Criteria:**

- Given the select and multi-select states suites on iPhone 26.3, when they run three times on the patched tree, then every run passes
- Given the macOS multi-select paint suite, when it runs on the patched tree, then 1222/1222 pass
- Given the delivered patches, when `apply.sh --check` runs against `work/n2-full`, then every pre-image matches

Story file: `_bmad-output/implementation-artifacts/6-6-select-family-ios-timing-and-swift-residuals.md`

### Story 6.7: Select family: accessibility findings and the autocomplete preview failure

Model: sonnet · Wave: 2 · mac lane d4 · android lane a4 (emulator-5562) · simulator AWC-d4

tools/ax compare still has 15 open findings for md-select and 26 for md-multi-select. Separately, `test-preview-presentation` fails on the canonical Laboratory binary on an md-autocomplete row click (seen by story 1-3).

**Acceptance Criteria:**

- Given tools/ax on all platforms, when compared with Web for the three tags, then names, roles, states and Tab order match or carry a reviewed expectation with its reason
- Given `test-preview-presentation`, when it runs ten times on the patched Laboratory build, then it passes ten times
- Given the delivered patches, when `apply.sh --check` runs against `work/n2-full`, then every pre-image matches

Story file: `_bmad-output/implementation-artifacts/6-7-select-family-accessibility-and-autocomplete-preview.md`

## Epic 7: Independent gate-7 audits

Fresh-context reviewers audit components that have no verdict yet and re-check fixed findings. Reviewers never edit product code.

### Story 7.1: Gate-7 audit: text-field, number-field, otp-field

Model: sonnet · Wave: 3 · mac lane r1 · android lane a5 (emulator-5564) · simulator AWC-r1 · Depends on: 6-3-text-fields-followups

These components have no gate-7 verdict yet: md-text-field, md-number-field, md-otp-field.

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-1-audit-text-number-otp-fields.md`

### Story 7.2: Gate-7 audit: select, multi-select, autocomplete

Model: sonnet · Wave: 3 · mac lane r2 · android lane a4 (emulator-5562) · simulator AWC-r2 · Depends on: 6-1-select-family-finish

These components have no gate-7 verdict yet: md-select (+md-select-option), md-multi-select, md-autocomplete.

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-2-audit-select-family-autocomplete.md`

### Story 7.3: Gate-7 audit: color-picker, time-picker

Model: sonnet · Wave: 3 · mac lane r3 · android lane a5 (emulator-5564) · simulator AWC-r3 · Depends on: 6-2-pickers-audit-readiness

These components have no gate-7 verdict yet: md-color-picker, md-time-picker.

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-3-audit-color-and-time-picker.md`

### Story 7.4: Gate-7 audit: navigation-rail, app-bar

Model: sonnet · Wave: 3 · mac lane r4 · android lane a6 (emulator-5566) · simulator AWC-r4 · Depends on: 6-4-shared-bindings-and-nav-residuals

These components have no gate-7 verdict yet: md-navigation-rail (+md-navigation-rail-tab), md-app-bar.

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-4-audit-navigation-rail-and-app-bar.md`

### Story 7.5: Gate-7 re-check: slider, rating, stepper

Model: sonnet · Wave: 3 · mac lane r6 · android lane a6 (emulator-5566) · simulator AWC-r6 · Depends on: 5-3-stepper-landmark-and-wrapper-parts

Fixes for these components are marked ready for re-check: md-slider, md-rating, md-stepper (+md-step): R6-03, R6-04, R6-05, R6-07, R6-11, R6-13.

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-5-recheck-slider-rating-stepper.md`

### Story 7.6: Gate-7 re-check: checkbox, menu, bottom-sheet, side-sheet

Model: sonnet · Wave: 3 · mac lane r5 · android lane a6 (emulator-5566) · simulator AWC-r5 · Depends on: 3-1-containment-batch-install-and-stacking, 6-1-select-family-finish

Fixes for these components are marked ready for re-check: md-checkbox (R4-26), md-menu family (R4-16, R4-23, R4-27), md-bottom-sheet and md-side-sheet (R4-03, R4-25).

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-6-recheck-checkbox-menu-sheets.md`

### Story 7.7: Gate-7 re-check: button-group, fab, icon-button, segmented-button, split-button

Model: sonnet · Wave: 3 · mac lane fi2 · android lane a1 (emulator-5556) · simulator AWC-fi2 · Depends on: 2-1-button-family-ios-motion-and-captures

Fixes for these components are marked ready for re-check: the five button-family components failing on iOS: R1-12, R1-13, R1-14, R1-16, R1-09, R1-10.

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-7-recheck-button-family.md`

### Story 7.8: Gate-7 re-check: divider, avatar, card, list, accordion, dialog

Model: sonnet · Wave: 3 · mac lane fi3 · android lane a2 (emulator-5558) · simulator AWC-fi3 · Depends on: 3-1-containment-batch-install-and-stacking

Fixes for these components are marked ready for re-check: md-divider, md-avatar, md-card, md-list (+item), md-accordion (+item), md-dialog: r3-01..r3-26.

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-8-recheck-containment.md`

### Story 7.9: Gate-7 re-check: charts, organization chart, table

Model: sonnet · Wave: 4 · mac lane r5 · android lane a6 (emulator-5566) · simulator AWC-r5 · Depends on: 4-2-md-table-open-items, 4-3-charts-and-org-chart-parts

Fixes for these components are marked ready for re-check: md-area-chart, md-bar-chart, md-line-chart, md-pie-chart, md-sparkline, md-organization-chart, md-table family: R5-01..R5-17.

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-9-recheck-charts-orgchart-table.md`

### Story 7.10: Gate-7 re-check: breadcrumbs, tabs, navigation-bar, toolbar

Model: sonnet · Wave: 3 · mac lane d6b · android lane a3 (emulator-5560) · simulator AWC-d6b · Depends on: 5-1-nav-wrapper-parts-and-android-label, 5-2-web-slotted-text-accessibility

Fixes for these components are marked ready for re-check: md-breadcrumbs, md-tabs, md-navigation-bar, md-toolbar: R6-15, R6-17, R6-18 (iPad), R6-22, R6-23.

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-10-recheck-navigation.md`

### Story 7.11: Gate-7 audit: search, transfer-list, date-picker

Model: sonnet · Wave: 2 · mac lane r2 · android lane a5 (emulator-5564) · simulator AWC-r2 · Depends on: 1-1-md-transfer-list-finish-and-install, 1-2-md-search-finish-and-install, 1-3-md-date-picker-finish-and-install

These components have no gate-7 verdict yet: md-search, md-transfer-list, md-date-picker.

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-11-audit-search-transfer-list-date-picker.md`

### Story 7.12: Gate-7 re-check: avatar, list, accordion (s7-8 findings)

Model: sonnet · Wave: 7 · mac lane fi3 · android lane a2 (emulator-5558) · simulators AWC-fi3 and AWC-fi3-ios18 · Depends on: 9-1-avatar-ios-forced-colors-outline, 9-2-list-android-expand-timing-under-load, 9-3-accordion-macos-controls-relation, 9-4-accordion-floating-panel-overlay-layer

Fixes for these components are marked ready for re-check: md-avatar (s7-8-01), md-list (+item) (s7-8-02), md-accordion (+item) (s7-8-03, s7-8-04).

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-12-recheck-avatar-list-accordion.md`

### Story 7.13: Gate-7 re-check: button-group (R1-17)

Model: sonnet · Wave: 7 · mac lane fi2 · android lane a1 (emulator-5556) · simulators AWC-fi2 and AWC-fi2-ios18 · Depends on: 9-5-button-group-ios18-lost-frame

Fixes for these components are marked ready for re-check: md-button-group: R1-17 and the R1-09 Status lines.

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-13-recheck-button-group.md`

### Story 7.14: Gate-7 re-check: text-field, number-field, otp-field (s7-1 findings)

Model: sonnet · Wave: 7 · mac lane r1 · android lane a5 (emulator-5564) · simulator AWC-r1 · Depends on: 9-6-otp-field-live-frame-and-border-motion, 9-7-number-field-step-capture-and-extra-actions, 9-8-text-field-member-tests-and-throttle-sample

Fixes for these components are marked ready for re-check: md-text-field (S71-05, S71-07), md-number-field (S71-02, S71-04, S71-05), md-otp-field (S71-01, S71-03, S71-05); S71-08 for all three.

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-14-recheck-text-number-otp-fields.md`

### Story 7.15: Gate-7 re-check: table, table-pagination, table-cell (s7-9 findings)

Model: sonnet · Wave: 7 · mac lane r5 · android lane a6 (emulator-5566) · simulator AWC-r5 · Depends on: 9-11-table-pagination-macos-tab-and-rowspan-semantics

Fixes for these components are marked ready for re-check: md-table (R5-18), md-table-pagination (R5-18), md-table-cell (R5-12).

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-15-recheck-table.md`

### Story 7.16: Gate-7 re-check: stepper (s7-5 findings)

Model: sonnet · Wave: 7 · mac lane r6 · android lane a6 (emulator-5566) · simulators AWC-r6 (iPhone 26.3), AWC-r6-ipad and an iPhone on iOS 18.6 · Depends on: 9-12-stepper-ios-width-from-host

Fixes for these components are marked ready for re-check: md-stepper (+md-step): s7-5-01; s7-5-02 (Laboratory Android probe) and s7-5-03 (probe expectation).

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-16-recheck-stepper.md`

### Story 7.17: Gate-7 audit: search

Model: sonnet · Wave: 7 · mac lane r1 · android lane a3 (emulator-5560) · simulator AWC-r1 · Depends on: 1-2-md-search-finish-and-install, 1-4-ipad-focus-entry-shared

These components have no gate-7 verdict yet: md-search.

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-17-audit-search.md`

### Story 7.18: Gate-7 re-check: navigation-rail, navigation-rail-tab (s7-4 findings)

Model: sonnet · Wave: 7 · mac lane r4 · android lane a6 (emulator-5566) · simulators AWC-r4 (iPhone 26.3), AWC-r4-ipad and an iPhone on iOS 18.6 · Depends on: 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests

Fixes for these components are marked ready for re-check: md-navigation-rail (S7-4-01, S7-4-02), md-navigation-rail-tab (S7-4-01).

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-18-recheck-navigation-rail.md`

### Story 7.19: Gate-7 re-check: table (s7-15 findings)

Model: sonnet · Wave: 7 · mac lane r6 · android lane a1 (emulator-5556) · simulators AWC-r6 (iPhone 26.3), AWC-r6-ipad and an iPhone on iOS 18.6 · Depends on: 9-16-table-ios-sort-click-late-start-and-web-role-race

Fixes for these components are marked ready for re-check: md-table (S7-15-01, S7-15-02).

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-19-recheck-table-2.md`

### Story 7.20: Gate-7 re-check: accordion (s7-12 findings)

Model: sonnet · Wave: 7 · mac lane fi3 · android lane a2 (emulator-5558) · simulators AWC-fi3 and AWC-fi3-ios18 · Depends on: 9-24-accordion-android-registration-before-first-toggle-and-wrapped-items

Fixes for these components are marked ready for re-check: md-accordion (+item) (s7-12-01).

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-20-recheck-accordion-2.md`

### Story 7.21: Gate-7 re-check: checkbox, menu (s7-6 findings)

Model: sonnet · Wave: 7 · mac lane r5 · android lane a6 (emulator-5566) · simulators AWC-r5 (iPhone 26.3) and an iPhone on iOS 18.6 · Depends on: 9-26-checkbox-iphone-pointer-glyph-opacity-one-sample, 9-27-menu-states-one-frame-misses-and-hook-tests

Fixes for these components are marked ready for re-check: md-checkbox (S7-6-01), md-menu (+item, group, sub-menu-item) (S7-6-02, S7-6-03).

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-21-recheck-checkbox-menu-2.md`

### Story 7.22: Gate-7 re-check: accordion, list (s7-20 findings)

Model: sonnet · Wave: 7 · mac lane fi3 · android lane a2 (emulator-5558) · simulators AWC-fi3 and AWC-fi3-ios18 · Depends on: 9-30-accordion-android-modal-scope-registration-order, 9-31-list-states-suite-extra-timing-tier

Fixes for these components are marked ready for re-check: md-accordion (+item) (s7-20-01), md-list (s7-20-02).

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-22-recheck-accordion-list-3.md`

### Story 7.23: Gate-7 re-check: switch (test sensitivity finding of story 9-31)

Model: sonnet · Wave: 7 · mac lane r3 · android lane a5 (emulator-5564) · simulators AWC-r3 and AWC-r3-18 · Depends on: 9-39-switch-states-suite-passes-a-33ms-delay

Fixes for these components are marked ready for re-check: md-switch (the finding that its states suite passed a 33 ms delay).

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-23-recheck-switch.md`

### Story 7.24: Gate-7 re-check: navigation-rail (members test hang found by story 9-16)

Model: sonnet · Wave: 7 · mac lane r4 · android lane a6 (emulator-5566) · simulator AWC-r4 · Depends on: 9-40-navigation-rail-members-test-hangs-on-macos

Fixes for these components are marked ready for re-check: md-navigation-rail (the members fixture hung in half of its macOS runs).

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-24-recheck-navigation-rail-2.md`

### Story 7.25: Gate-7 re-check: table (S7-15-01 residual, S9-16-03, the tools/ax findings)

Model: sonnet · Wave: 7 · mac lane r6 · android lane a6 (emulator-5566) · simulators AWC-r6 (iPhone 26.3), an iPhone on iOS 18.6 and AWC-r6-ipad · Depends on: 9-41-table-iphone-sort-residual-and-late-selection-start, 9-42-tools-ax-empty-capture-is-a-failure

Fixes for these components are marked ready for re-check: md-table (S7-15-01 residual, S9-16-03, S9-16-04; S7-19-01 and S7-19-02 of tools/ax).

**Acceptance Criteria:**

- Given each component, when the audit ends, then AUDIT.md shows a dated gate-7 verdict backed by your own re-run counts
- Given a FAIL verdict, when DEFECTS.md is read, then each blocking finding has evidence and a suggested fix

Story file: `_bmad-output/implementation-artifacts/7-25-recheck-table-3.md`

## Epic 8: Closure

Final integration run on canonical and one clean ledger.

### Story 8.1: Final integration run on canonical

Model: sonnet · Wave: 5 · mac lane fx · android lane a1 (emulator-5556) · simulator AWC-fx · Depends on: 7-9-recheck-charts-orgchart-table

After all fix stories land, canonical needs one full integration run (i6) to prove nothing regressed across components.

**Acceptance Criteria:**

- Given canonical after all installs, when i6 runs, then every suite's result and every failure's cause is recorded

Story file: `_bmad-output/implementation-artifacts/8-1-final-integration-run.md`

### Story 8.2: One clean ledger: DEFECTS status table and AUDIT summary

Model: haiku · Wave: 5 · mac lane d2b · no Android · no simulator · Depends on: 8-1-final-integration-run

DEFECTS.md has grown by appended status lines and is hard to read; AUDIT.md has no summary of gate-7 verdicts.

**Acceptance Criteria:**

- Given STATUS.md, when a row is compared with DEFECTS.md, then the status and evidence match the newest dated line

Story file: `_bmad-output/implementation-artifacts/8-2-ledger-consolidation.md`

## Epic 9: Gate-7 fix rounds

Fix the findings of the gate-7 audits and re-checks, then have a fresh reviewer re-check them.

### Story 9.1: md-avatar on iOS: forced-colors outline row (s7-8-01)

Model: sonnet · Wave: 6 · mac lane fi3 · no Android lane · simulators AWC-fi3 and AWC-fi3-ios18 · Depends on: 7-8-recheck-containment

Gate-7 re-check s7-8 failed md-avatar. `NativeForcedAppearanceIntegration` fails 4 checks on iOS in every run: 228/232 on iPhone 26.3 (3 of 3 runs) and on iOS 18.6, while macOS passes 232/232. The checks are avatar `av` and `avn`, light and dark, forced colors, probe `[20, 0.25]`: native [233,233,233] against Chrome [255,255,255]. The sample lies on the top edge of the 40 pt circle.

**Acceptance Criteria:**

- Given the forced-appearance fixture, when it runs three times on iPhone 26.3 and once on iOS 18.6, then it passes 232/232 each time
- Given the fix, when the md-avatar suites run on macOS, iOS and Android, then the counts equal the s7-8 counts or the difference is explained
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-1-avatar-ios-forced-colors-outline.md`

### Story 9.2: md-list on Android: expand and caret samples late under load (s7-8-02)

Model: opus · Wave: 6 · mac lane d4 · android lane a4 (emulator-5562) · no simulator · Depends on: 7-8-recheck-containment

`NativeListStatesTest.listInteractionsMatchChrome` fails on Android when the Mac is busy and passes in isolation. There are three independent occurrences: story 3-1 (`3-1-A008`: 2 of 3 runs fail; `3-1-A009`: 3 of 3 fail on a plain copy under load; `3-1-A007`: 3 of 3 pass unloaded) and the reviewer (`s7-8-A002`: 2 of 175282 checks, `expand-expand-standard-none-dark-rtl r1`, panel opacity 0.850 against Chrome [0.018, 0.797] and caret 128.7 against [0.28, 108.3] at web 2016 ms). The cause is not proven: the product's frame pacing or the fixture's clock.

**Acceptance Criteria:**

- Given the loaded recipe, when NativeListStatesTest runs five times after the fix, then all five pass, and the same recipe failed in most runs before the fix
- Given the cause, when the story file is read, then it is backed by a trace of toggle, start, frame and sample times
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-2-list-android-expand-timing-under-load.md`

### Story 9.3: md-accordion on macOS: the header's `controls` relation (s7-8-03)

Model: sonnet · Wave: 6 · mac lane d3 · no Android lane · no simulator · Depends on: 7-8-recheck-containment

tools/ax reports an open `relation` finding for md-accordion on macOS in both cases (`default`, `exclusive`), 3 of 3 runs: the Web header button `controls` its panel, and macOS exposes no linked element. iOS and Android pass because UIKit and Compose have no element relation (the R6-09 convention). There is no accepted expectation.

**Acceptance Criteria:**

- Given tools/ax on md-accordion, when the compare runs twice on macOS after the fix, then it reports 0 open findings and no new expectation was added
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-3-accordion-macos-controls-relation.md`

### Story 9.4: md-accordion floating panel: publish it in the modal overlay layer (s7-8-04, r3-19 mechanism 2)

Model: sonnet · Wave: 6 · mac lane d6 · android lane a2 (emulator-5558) · simulator AWC-d6 · Depends on: 7-8-recheck-containment

The gate-7 reviewer rejected the r3-19 exception proposal of story 3-1. Two residuals of the floating accordion panel are implementable: (1) an ancestor that clips still clips the panel; (2) the panel orders inside the modal layer, not against sheets and dialogs. Residuals (3) and (4) (the lift chain; `awcStackingLift` on a root-level view) follow from the same design. None of the four is tested against Chrome.

**Acceptance Criteria:**

- Given a floating accordion panel inside a clipping container, under a sheet and under a dialog, when the native probes run on macOS, iOS and Android, then they match Chrome, and they failed before the change
- Given the components that use `AWCModalScope`, when their suites run after the change, then the counts equal their checkpoints or the difference is explained
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-4-accordion-floating-panel-overlay-layer.md`

### Story 9.5: md-button-group on iOS 18.6: width sample across a lost display frame (R1-17)

Model: sonnet · Wave: 6 · mac lane fi2 · no Android lane (Android re-run on lane a1, emulator-5556) · simulators AWC-fi2 and AWC-fi2-ios18 · Depends on: 7-7-recheck-button-family

Gate-7 re-check s7-7 failed md-button-group. In 1 of 5 family-states runs on iOS 18.6, `bg-keyboard-standard/key3-Enter` box at +62 ms was 221.90 wide against Chrome 223.92-225.05 (tolerance 1.5). The native frame id stayed at 9989 for the samples at +43, +53 and +63 ms, so one display frame was lost; the width reaches 224.37 at +75 ms. The three iOS 26.3 runs and the four other 18.6 runs pass. The host load was 122 during the failing run.

**Acceptance Criteria:**

- Given a display frame lost at the key3-Enter phase, when the family states suite samples the group width, then the check passes, and it failed on canonical with the same lost frame
- Given the fix, when family states run five times on iOS 18.6 and three times on iOS 26.3, then every run passes
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-5-button-group-ios18-lost-frame.md`

### Story 9.6: md-otp-field: SwiftUI live preview frame and key border motion (S71-01, S71-03, S71-05)

Model: sonnet · Wave: 6 · mac lane fx · android lane a5 (emulator-5564) · simulator AWC-fx (and its iOS 18.6 clone) · Depends on: 7-1-audit-text-number-otp-fields

Gate-7 audit s7-1 failed md-otp-field on three findings. S71-01: every live preview create of md-otp-field through the SwiftUI host answers 502 `INVALID_LIVE_FRAME`, because the host's `component.cell-N` metrics carry `border` as a colour string (`#79747EFF`) while `validateMetrics` in `native-inspection.mjs` requires `border` as four numbers. Android is fine. S71-03: `NativeOTPFieldStatesIntegration` gives 1361 or 1362 of 1370 on iPhone 26.3 and on iOS 18.6 in every run (Backspace-x3 and Delete-at-0 border motion in ltr, rtl and reduced motion; paste-12-34-56x 2 of 114 frames), and macOS reaches 1370 only after failing first attempts in 3 of 4 runs. Story 6-3 measured a native lead of 16.7 ms. S71-05: `cellLabelTemplate` is implemented in SwiftUI and Compose and exercised by no native test.

**Acceptance Criteria:**

- Given a SwiftUI host on the story's own preview server, when md-otp-field is created live, then the answer is a valid frame, and the same test answered 502 on canonical
- Given the fix, when OTP states run three times on iPhone 26.3 and twice on iOS 18.6, then every run passes 1370/1370, and four macOS runs pass with no failing first attempt
- Given `cellLabelTemplate` is set, when the Swift case and the Android case run, then each cell's accessibility label follows the template
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-6-otp-field-live-frame-and-border-motion.md`

### Story 9.7: md-number-field: stepUp and stepDown after property updates, macOS extra actions (S71-02, S71-04, S71-05)

Model: sonnet · Wave: 6 · mac lane n1 · android lane a2 (emulator-5558) · simulator AWC-n1 · Depends on: 7-1-audit-text-number-otp-fields

Gate-7 audit s7-1 failed md-number-field. S71-02 (blocking): on SwiftUI `stepUp()` and `stepDown()` ignore property updates. Created with min 0, max 10, step 2 and value 7 they give 9, 10, 8, as the source does; after a retained update that sets `step` to 2 they still step by 1 (8, 9, 8). Cause: `start()` in `NativeNumberField.swift` sets `rt.step = { ... model.stepAmount ... }` once, and the closure keeps the node of the first render. Android is correct. S71-04 (non-blocking, the exception was rejected): on macOS the stepper group exposes a set of five accessibility actions in 7 of 36 case processes. The earlier extra-actions record (n3, 2026-11-07) is not a valid exception, because its own standalone repro shows 0 of 272; the cause is therefore in the AWCUI composition. S71-05 (blocking): `allowOutOfRange` and `decrementLabel` have no native test, `snapOnStep` and `incrementLabel` are exercised only by the Laboratory, and `stepUp`/`stepDown` have no Swift test.

**Acceptance Criteria:**

- Given a SwiftUI number field whose `step`, `min`, `max` or `snapOnStep` was updated after creation, when `stepUp()` or `stepDown()` is called, then the value is the one the source gives, and the same case failed on canonical
- Given the macOS accessibility check runs six times, when the stepper group is read, then no case process shows the five-action set, or an exception proposal with a repro outside AWCUI is pending gate-7 review
- Given each member named in S71-05 for md-number-field, when its Swift case and its Android case run, then they pass, and each failed in its mutation run
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-7-number-field-step-capture-and-extra-actions.md`

### Story 9.8: md-text-field: native tests for the untested members, throttle boundary sample (S71-05, S71-07)

Model: sonnet · Wave: 6 · mac lane n4 · android lane a6 (emulator-5566) · simulator AWC-n4 · Depends on: 7-1-audit-text-number-otp-fields

Gate-7 audit s7-1 failed md-text-field on S71-05 (blocking): members implemented in SwiftUI and Compose and exercised by no native test. No native test: `enterKeyHint`, `autoCapitalize`, `spellcheck`, `showPasswordLabel`, `hidePasswordLabel`, `speechLang` and the slots `clear-icon` and `password-toggle-icon`. Exercised only by the Laboratory: `parser`, `formatOn`, `inputRole`, `inputExpanded`, `inputAriaAutocomplete`, `mdSpeechResult` and the slot `speech-icon`. `pattern` has a Swift test and no Android test. S71-07 (non-blocking, a test defect): `tf-throttle-200` in `NativeTextFieldStatesIntegration` gives 13 events against 12 under load. Chrome's seventh key lands 16.7 ms before the 200 ms window closes; under load the native key slips to +202 ms and lands after it, and the product then does what the source does for those key times.

**Acceptance Criteria:**

- Given each member named in S71-05 for md-text-field, when its Swift case and its Android case run, then they pass, and each failed in its mutation run
- Given `tf-throttle-200`, when it runs five times on macOS under load and five times without, then every run passes without a retry
- Given the install, when the md-text-field suites run on macOS, iPhone 26.3 and Android, then the counts equal the s7-1 counts plus the new cases
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-8-text-field-member-tests-and-throttle-sample.md`

### Story 9.9: md-list: macOS drag-reorder state-layer fade tail frame (C65-01)

Model: sonnet · Wave: 6 · mac lane d2b · no Android lane · no simulator

Story 6-5 found an intermittent macOS failure in `NativeListStatesIntegration` that its own change does not cause. One frame of the drag-reorder state layer fails in 2 of 5 runs at ordinary load: `reduced/drag-reorder-standard-none-light-ltr r2 state layer rendered [0.004] at web 2266` (job 6-5-...-006) and `drag-reorder-standard-none-dark-rtl r2 state layer rendered [0.007] at web 2281` (job 6-5-...-014). The native state layer still has opacity 0.004 to 0.007 in a frame where Chrome is at 0, so the native fade ends about one frame after Chrome's. The same check class failed on 2026-10-30 (`fi-702-cp-cpo2-reruns`). Seven baseline runs were clean, so the rate is low and the cause is not yet known. Recorded as C65-01 in DEFECTS.md. The gate-7 re-check 7-12 re-runs this suite on canonical.

**Acceptance Criteria:**

- Given the drag-reorder cases, when they run forty times on macOS (twenty with a second suite running), then every run passes, and the same forty runs failed at least once before the change
- Given the cause, when a reader opens KNOWN-CAUSES.md, then the row names the late frame, its measurement and the fix
- Given the install, when the full md-list states and paint suites run three times on macOS canonical, then every run is a full pass
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-9-list-macos-drag-reorder-fade-tail.md`

### Story 9.10: iOS test shim: the key await ends at HID delivery (KNOWN-CAUSES 23b); regression over the iOS states suites, install

Model: sonnet · Wave: 6 · mac lane di · no Android lane · simulators AWC-di (create it as PARALLEL.md describes if it does not exist) and AWC-di-ipad · Depends on: 6-6-select-family-ios-timing-and-swift-residuals

Story 6-6 measured a defect in the shared iOS test shim (KNOWN-CAUSES.md row 23, part b): after every key the shim waits up to 30 ms for the key to be delivered (`AWC_IOS_KEY_AWAIT`), and that wait always times out, because HID keys never count as delivered presses. So in every iOS states fixture a key is followed by about 30 ms in which no sample is taken. Story 6-2 sees the native hand 14 to 33 ms behind Chrome on keyboard and mode phases of the pickers, and story 1-2 sees gaps after open and close in md-search; both match this. Story 6-6 writes the fix (count HID key delivery so that the await ends at delivery) and delivers it as a patch in `work/n2-lab/lab/g6/shim/`, but does not install it, because the shim is shared by every iOS states suite.

**Acceptance Criteria:**

- Given a key sent by an iOS states fixture, when the shim awaits its delivery, then the await ends at delivery and not at the 30 ms limit, and one run on canonical shows the limit being hit
- Given every iOS states suite that sends keys, when it runs before and after the patch under the same load, then no passing check fails after the patch, and the table lists the checks that start to pass
- Given the install, when `checkpoint-refresh.py report` runs, then no component is stale
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-10-ios-shim-key-await-regression-and-install.md`

### Story 9.11: md-table: macOS Tab leaves the rows-per-page field (R5-18); rowSpan reaches tested semantics (R5-12)

Model: sonnet · Wave: 6 · mac lane d5 · android lane a4 (emulator-5562) · simulator AWC-d5 (create it as PARALLEL.md describes if it does not exist) · Depends on: 7-9-recheck-charts-orgchart-table

The gate-7 re-check s7-9 (2026-11-16) left md-table, md-table-pagination and md-table-cell at FAIL because of two findings in DEFECTS.md. R5-18 (blocking): on macOS, Tab never leaves the rows-per-page field of md-table-pagination (a tools/ax focus finding, 3 of 3 runs on canonical). Story 4-2 wrote the host fix (`work/d5-lab/table/scripts/patch-host-tab.py` adds the tag to the field-editor Tab list in `apps/native-ios-playground/LiveRenderer/main.swift`), but its install job 4-2-md-table-open-items-101 skipped the patch: the guard `grep -q md-table-pagination <file> || python3 patch-host-tab.py` is always true, because the tag name already occurs elsewhere in that file. R5-12: `rowSpan` reaches no accessibility semantics that a test checks. The decision log says the value reaches the cell's semantics (macOS AXCell row range, Android CollectionItemInfo rowSpan); story 4-2 added a span test on Android (job 111, install 120), but tools/ax has no assertion for a row range greater than 1 on any platform.

**Acceptance Criteria:**

- Given canonical after the install, when tools/ax runs for md-table-pagination on macOS three times, then each run has 0 open findings and the Tab order matches the Web order
- Given a cell with rowSpan 2, when tools/ax reads it on macOS and Android (and on iOS, unless a written native difference says why not), then the reported row range is 2, and the same assertion fails on the tree before the change
- Given the 4-2 install jobs, when a reader opens the table of guards, then every patch is shown present on canonical
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-11-table-pagination-macos-tab-and-rowspan-semantics.md`

### Story 9.12: md-stepper: the iOS layout width comes from the host, not from the screen (s7-5-01)

Model: sonnet · Wave: 6 · mac lane fa · android lane a1 (emulator-5556) · simulators AWC-fa (iPhone 26.3), AWC-fa-ipad and an iPhone on iOS 18.6 (create them as PARALLEL.md describes if they do not exist) · Depends on: 7-5-recheck-slider-rating-stepper

The gate-7 re-check s7-5 (2026-11-16) left md-stepper (with md-step) at FAIL. Finding s7-5-01: `NativeFaViewsIntegration` on the iPhone 26.3 simulator passes 406 of 494. The 88 failing cases are the horizontal md-stepper paint cases, the same in 2 of 2 runs, while iPad 26.3, macOS and Android pass. Cause named by the reviewer: `Stepper/NativeStepper.swift` (`input(now:)`) sets `viewportWidth = UIScreen.main.bounds.width` on iOS (402 pt on the iPhone; macOS uses a fixed 1200), so on a phone-width screen the mobile layout replaces the horizontal list that the 820 px Chrome oracle shows. `NativeStepperIntegration` uses its own width and does not see it. Story 5-3 reported the views fixture at 494/494 on iPhone; the reviewer's runs on iPhone 17 Pro 26.3 do not confirm that, and the views fixture was not run on iOS 18.6. The mobile layout itself has no Chrome comparison on any platform.

**Acceptance Criteria:**

- Given the iPhone 26.3 simulator, when `NativeFaViewsIntegration` runs twice, then every case passes, and the same run failed 88 cases before the change
- Given the mobile layout, when the phone-viewport oracle cases run on iPhone, iPad, macOS and Android, then every case passes, and they fail in the mutation run
- Given the docs, when a reader opens md-stepper.md, then the width meaning and its Web source line are stated
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-12-stepper-ios-width-from-host.md`

### Story 9.13: md-date-picker Android: intermittent HTTP 400 in the live-host test (s7-11-01); paint test default for the year scroll

Model: sonnet · Wave: 6 · mac lane n4 · android lane a4 (emulator-5562) · no simulator · Depends on: 7-11-audit-search-transfer-list-date-picker

The gate-7 audit s7-11 (2026-11-16) passed md-date-picker and left two Android items. s7-11-01 (non-blocking): `LivePreviewDatePickerHostTest` failed once with an HTTP 400 (job s7-11-A001) and passed 3 of 3 in job s7-11-A004; the same test failed the same way on 2026-11-14. The cause is not known, so the live preview of the date picker on Android can answer 400 to a valid request now and then. Second item: the Android paint test of the date picker passes 31436/31436 only with `awcDpD9=1`; without the flag 606 checks fail (3 hook-year cases, the year scroll of Decision 9). Story 1-3 changed the Swift test on 2026-11-16 so that a run without flags uses the motion capture and passes (its job 100-install-paint-test); the Android test still needs the flag, so a plain run of the Android suites fails.

**Acceptance Criteria:**

- Given the live-host test, when it runs 60 times as in the loop, then every run passes, and the cause of the 400 is named with the request that triggered it
- Given the Android paint suite, when it runs without flags, then every check passes, and the strict mode shows the same 606 failures as before
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-13-date-picker-android-live-host-400-and-paint-default.md`

### Story 9.15: iPad focus bridge: the focus system's first-group entry takes first responder from the Tab target (C910-01)

Model: sonnet · Wave: 6 · mac lane d5 · no Android lane · simulators AWC-d5-ipad (iPad 26.3) and AWC-d5 (iPhone 26.3) (create them as PARALLEL.md describes if they do not exist) · Depends on: 9-10-ios-shim-key-await-regression-and-install

Story 9-10 found a product race on iPad (DEFECTS.md C910-01, KNOWN-CAUSES.md row 32). On every Tab in the md-table keyboard cases the UIKit focus system first moves focus to the first focus group (`NativeFocusBridge.swift`, `didUpdateFocus`, about lines 301 to 305: the first responder becomes key-view index 0, logged as `become sys=true`), and 1 to 3 ms later the AWC Tab key command moves it to the real target (`become explicit=true`). With the canonical test shim, which waits 30 ms after each key, the order is always the same and `NativeTableStatesIntegration` passes on iPad (0 failures in 4 + 3 rounds). With the corrected shim of story 9-10 (the key await ends when UIKit has delivered the key) the order is sometimes inverted: the key-view loop at Tab-10 finds index 0 as first responder 270 ms after Tab-9 had made index 10 first responder, and the Tab order restarts from the top. The Tab-10 to Tab-17 focus names and the sort icon opacity (0.6 against 0.38) then fail, 8 to 16 checks per round. A floor of 30 ms after each key hides it (0 failures in 3 of 3 rounds); a floor of 0 fails 14, 8 and 14 checks, and a floor of 15 fails 13, 8 and 0. A user with a hardware keyboard has no such floor, so this is a product defect. The shim install of story 9-10 waits for the fix, and stories 6-2 and 1-2 wait for that install.

**Acceptance Criteria:**

- Given the 9-10 shim in the private tree, when Table states run five rounds on iPad 26.3 at floor 0 and five at floor 15, then every round has 0 failures, and the same suite failed 8 to 14 checks per round before the change
- Given the canonical shim, when every iPad states suite that sends Tab runs once, then no check fails that passed before the change
- Given the fix, when a reader opens the Dev Agent Record, then it says why the focus system moved focus on a handled Tab and why the result no longer depends on the order of the two callbacks, and the fix contains no wait
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-15-ipad-focus-system-first-group-takes-tab-target.md`

### Story 9.16: md-table: iOS sort click starts the row motion 40 to 55 ms late (S7-15-01); the Web role flips between table and treegrid in tools/ax (S7-15-02)

Model: sonnet · Wave: 6 · mac lane d6 · android lane a1 (emulator-5556), only for the tools/ax run and one states run · simulators AWC-d6 (iPhone 26.3), an iPhone on iOS 18.6 and AWC-d6-ipad (create them as PARALLEL.md describes if they do not exist) · Depends on: 7-15-recheck-table

The gate-7 re-check 7-15 left md-table at FAIL with two findings (DEFECTS.md S7-15-01 and S7-15-02); md-table-pagination and md-table-cell now pass. S7-15-01: on iOS `NativeTableStatesIntegration` fails 2 checks in 3 of 6 runs (3860/3862, on iPhone 26.3 and on iOS 18.6): case `tb-contract [0] click-calories-default-desc`, motion `order:n0.1.1.3` 37/44 and `order:n0.1.1.0` 36/44. The DIAG lines show input to t0 54 ms; the native row order value stays 3.00 until +71 ms and 2.98 until +121 ms, while Web is 2.43 at +33 ms. The native motion starts 40 to 55 ms late and then follows the same curve. The load was 103 at one failing run, under the 300 line of PARALLEL.md; macOS (3859/3859 twice) and Android pass. S7-15-02: the Web role of the same md-table fixture flips between `treegrid` (rows named) and `table` (rows unnamed) from one tools/ax capture to the next. When Web is `table`, tools/ax reports macOS `name` and `focus` findings as open: 10 open in 7-15-003-ax-mac, 5 in 7-15-A004-ax-android-web, 0 in 7-15-005-rerun on the same bytes. KNOWN-CAUSES row 63 describes the race; the wait that story 9-11 put into tools/ax `web.mjs` (about line 100) covers only fixtures with an expandable row.

**Acceptance Criteria:**

- Given the fix, when `NativeTableStatesIntegration` runs ten times on iPhone 26.3 and three times on iOS 18.6, then every run passes 3862/3862, and the record holds the before runs of the same day with their failing count
- Given tools/ax for md-table, when it runs three times in a row on macOS and once on iOS and on Android, then the Web role is the same in every capture and no finding is open
- Given the fix, when a reader opens the Dev Agent Record, then it names the interval that held the 40 to 55 ms with the measured numbers, and the fix contains no wait
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-16-table-ios-sort-click-late-start-and-web-role-race.md`

### Story 9.17: iOS RTL: the legend notch of outlined fields is on the wrong side (C66-01, AWCFieldOutlineShape mirrored twice)

Model: sonnet · Wave: 6 · mac lane d3 · no Android lane · simulators AWC-d3 (iPhone 26.3) and an iPhone on iOS 18.6 (create them as PARALLEL.md describes if they do not exist)

Story 6-6 found a paint defect outside its scope (DEFECTS.md C66-01). On iOS in RTL the outlined field draws its legend notch on the left (x 29 to 60) while the label sits on the right; the Web shot has the notch at x 315 to 347, and native closes the top border there. `AWCFieldOutlineShape` already mirrors the gap for RTL, so on iOS the shape is mirrored twice. It was seen in md-multi-select, whose field is NativeTextField, so md-text-field and every other user of the shape is in scope. 35 px differ at (46,25) in every RTL run; alone this stays under the paint threshold, so no suite fails on it today and the defect is visible to a user.

**Acceptance Criteria:**

- Given an outlined RTL field with a label on iPhone 26.3 and on iOS 18.6, when the paint case runs, then the notch is on the label side and the notch-region check passes, and the same check fails on the unpatched tree
- Given the fix, when the paint and states suites of the users of the shape run once on iPhone 26.3 and the paint suites once on macOS, then no check fails that passed before
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-17-ios-rtl-outlined-field-notch-wrong-side.md`

### Story 9.18: TextField and NumberField states suites: frames of earlier phases stay in the sample buffer (C96-01, the carry fix of 9-6-124)

Model: sonnet · Wave: 6 · mac lane d4 · android lane a2 (emulator-5558), only if the Kotlin check finds the same defect · simulators AWC-d4 (iPhone 26.3) and an iPhone on iOS 18.6 (create them as PARALLEL.md describes if they do not exist) · Depends on: 9-7-number-field-step-capture-and-extra-actions, 9-8-text-field-member-tests-and-throttle-sample

Story 9-6 found a defect in the OTP states suite (DEFECTS.md C96-01; KNOWN-CAUSES.md, line `9-6 (2026-11-17) md-otp-field states suite`). `runOne` keeps the frames from -45 ms to 0 of the previous buffer on every phase (`samples = carried + samples.filter { $0.t >= -45 && $0.t < 0 }`), so the pre-phase frames of every earlier phase stay in the buffer under their old times. They enter each window that reaches t < 0, and the iOS gap rule can take one of them as the frame before a drawing gap. A phase can then pass on frames of other phases. With the fix (`samples = carried` before the pre-phase pump) the OTP suite showed misses that the stale frames had hidden. The same line is in `NativeTextFieldStatesIntegration.swift` and `NativeNumberFieldStatesIntegration.swift` on canonical. Both components wait for the gate-7 re-check 7-14, and their pass counts so far were measured with the defect. One Kotlin test file also contains a filter with -45.

**Acceptance Criteria:**

- Given the fixed suites, when a late phase runs, then its buffer holds no frame taken in an earlier phase, and the diagnostic shows this before and after the fix
- Given the fix on canonical, when both suites run three times on macOS and on iPhone 26.3 and once on iOS 18.6, then every failing check has a fix or a DEFECTS.md finding, and the record has the counts before and after
- Given the other states suites, when a reader opens the Dev Agent Record, then it says per file whether a buffer is carried between phases and whether it is cleared
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-18-text-and-number-field-states-suites-stale-frames.md`

### Story 9.19: Select family: iOS 18.6 residuals (S66-18-01 to 03) and intermittent click and pick losses (C66-02, C66-03)

Model: sonnet · Wave: 6 · mac lane n2 · no Android lane · simulators AWC-n2 (iPhone 26.3) and AWC-n2-18 (iOS 18.6); both exist from story 6-6 · Depends on: 6-1-select-family-finish

Story 6-6 reached its acceptance on iPhone 26.3 (select 1030/1030 and multi 872/872, three runs each) and left five open points that the gate-7 audit 7-2 would meet. On iOS 18.6 only: S66-18-01, the hardware-keyboard open of md-select in RTL is one frame late (`select-keyboard-rtl arrowdown-open` opacity at t=49 web 0.807, native 0.494; `enter-open` 0.396; 1028/1030 and 1029/1030); S66-18-02, `multi-pointer-rtl escape` caret at t=200 web 0.594, native 1.000 or 0.717 (868/872); S66-18-03, after select-all the menu rows band (clip y 72 to 112) has a uniform tint against Chrome (mean 2.3, worst (25,89) web [206,197,219] native [199,191,214]). Intermittent, cause unknown: C66-02, a click on clear is lost on the iPhone simulator (`multi-pointer-rtl (reduced) clear` leaves `[b,d]`; jobs 054 D2 and 057 M2); C66-03, on macOS a reduced-motion pointer pick is lost (jobs 046, 049) and one click-open caret miss at t=166 (job 051 run 1).

**Acceptance Criteria:**

- Given the fix, when select and multi states run twice on iOS 18.6 and three times on iPhone 26.3, then every run passes 1030/1030 and 872/872
- Given the clear loop on iPhone 26.3 and the pick loop on macOS, when each runs 50 times after the change, then no click or pick is lost, and the record has the loss counts and classes of the loops before the change
- Given a finding that did not reproduce in 100 runs, when a reader opens the Dev Agent Record, then it has the loop counts and the DEFECTS.md line says so
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-19-select-family-ios18-residuals-and-intermittent-click-loss.md`

### Story 9.20: md-text-field iOS: tab-out, blur, press-focus and required-validity motion fail on one late frame in 1 to 4 checks per run (S918-01)

Model: sonnet · Wave: 6 · mac lane d4 · no Android lane · simulators AWC-d4 (iPhone 26.3) and the iOS 18.6 simulator that story 9-18 used on lane d4 (both exist) · Depends on: 9-18-text-and-number-field-states-suites-stale-frames, 9-17-ios-rtl-outlined-field-notch-wrong-side

Story 9-18 installed the carry fix in the TextField and NumberField states suites and left one finding open (DEFECTS.md S918-01). On canonical the TextField states suite fails 1 to 4 checks per run on the iPhone simulator: iPhone 26.3 three runs with 4, 2 and 1 FAIL lines, iOS 18.6 one run with 3 FAIL lines (job 9-18-009). The failing checks are motion checks of `tf-focus-type-blur-filled-ltr` (tab-out and blur, press-focus) and of `tf-required-validity` (focus and blur): one native frame at about t=50 ms is behind the Web value. The misses were there before and after the carry fix (jobs 9-18-005 and 9-18-006), they change from run to run, and one run of story 9-10 passed 2048/2048 (job 111). macOS and NumberField pass. The gate-7 re-check 7-14 cannot pass md-text-field on iOS while a run has FAIL lines, and nobody has measured whether the late frame is in the product or in the test.

**Acceptance Criteria:**

- Given canonical after the install, when the TextField states suite runs 10 times on iPhone 26.3 and 5 times on iOS 18.6, then no run has a FAIL line, and the record has the rate before the change
- Given a fix in the suite, when the start of the product's transition is delayed by one frame, then the changed check fails; given a fix in the product, when the check runs on the tree before the fix, then it fails
- Given the OTP first-attempt misses of story 9-6, when a reader opens the Dev Agent Record, then it says with numbers whether the same cause explains them
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-20-text-field-ios-tab-out-and-blur-motion-one-frame-late.md`

### Story 9.21: Button states suite on the iPad: the check `iOS snapshot frame equals a direct capture` fails in every run (645/646)

Model: sonnet · Wave: 6 · mac lane di · no Android lane · simulators AWC-di (iPhone 26.3) and AWC-di-ipad (both exist); an iPhone on iOS 18.6 for one run (create it as PARALLEL.md describes if lane di has none) · Depends on: 9-10-ios-shim-key-await-regression-and-install

On the iPad simulator `NativeButtonStatesIntegration` passes 645 of 646 checks in every run on record. The failing check is `iOS snapshot frame equals a direct capture (pointer-filled-sm-light-ltr rest)`: story 9-10 jobs 012 and 033 (before and after the shim change) and story 9-15 job 012 (before and after its change). The check compares the frame that the suite's snapshot path returns with a direct capture of the same view. Nobody has looked at the two images. md-button has a gate-7 PASS from an audit that ran on the iPhone, and the final integration run 8-1 will meet this failure on the iPad. Until the cause is known it is not clear whether the product draws differently on the iPad or the two capture paths differ there. A sweep under load (job 6-4-005) once showed `NativeButtonStates 644/645`; the platform is in that log.

**Acceptance Criteria:**

- Given canonical after the install, when the Button states suite runs three times on the iPad and three times on iPhone 26.3, then every run passes 646/646, and the record has the rate before the change
- Given the two images of the failing check before the change, when a reader opens the Dev Agent Record, then it says how many pixels differ, where, and what the cause is
- Given the changed capture path or product, when a deliberately wrong frame or the unfixed product is used, then the check fails
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-21-button-states-ipad-snapshot-equals-direct-capture.md`

### Story 9.22: md-search iOS and macOS: the first frames after a press are late because the main thread is blocked by the focus change and by the first render

Model: sonnet · Wave: 6 · mac lane n3 · no Android lane · the simulators story 1-2 used on lane n3: AWC-n3 (iPhone 26.3), AWC-n3-ipad (iPad 26.3) and its iOS 18.6 simulator · Depends on: 1-2-md-search-finish-and-install

Story 1-2 measured the cause of every remaining states miss of md-search on iOS and macOS (jobs 071 to 074, `fail-class.py`): all 24 failing checks of 4 runs lie in a block of the main thread at the press, none in a free display-link gap. On iOS the block is `UITextField` `becomeFirstResponder` with `_reloadInputViews` (36 to 57 ms, also in a warm process) followed by the first render (47 to 73 ms); on macOS it is a 52 ms block at the press that nobody has named. The failing checks are `search-docked-*-click-bar-focus`, the fullscreen `click-bar-opens`, and motion frames of `Escape-closes` and `clear-loading`. Counts in the private tree with the gap rule: iPhone 759 to 765 of 766, iPad 760 to 766, iOS 18.6 747, macOS 762 to 763. One fix attempt failed (job 077): moving the UIKit responder change two frames behind the press gave 743 to 745 of 766, because keys sent before the deferred responder were lost or reordered and outside-click-closes regressed. The gap rule catches a delay of 34 ms, not of 17 ms (job 076).

**Acceptance Criteria:**

- Given the private tree after steps 1 to 3, when the states suite runs three times each on macOS, iPhone 26.3, iPad 26.3 and iOS 18.6 with strict counts, then the record has every count and every remaining failing check by name
- Given the two key checks, when they run on iPhone and iPad, then value and caret are right and Escape closes, and the 34 ms mutation run fails
- Given checks that still fail, when a reader opens the exception record, then it has the distribution of the UIKit block, the numbers of each check and the reason why neither order of work removes it; without such checks there is no exception record
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-22-search-press-block-first-frame-after-focus.md`

### Story 9.23: iOS harness: measure the main-thread time inside UIKit's first-responder change and first-key keyboard creation, and stop comparing frames that cannot exist in it

Model: sonnet · Wave: 6 · mac lane di · no Android lane · simulators AWC-di (iPhone 26.3) and AWC-di-ipad (both exist); an iPhone on iOS 18.6 for lane di (create it as PARALLEL.md describes if it does not exist) · Depends on: 9-10-ios-shim-key-await-regression-and-install, 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests

Three stories measured the same thing on the iOS simulator. Story 1-2 (jobs 071 to 074): every states miss of md-search lies in a block of the main thread at the press, `UITextField` `becomeFirstResponder` with `_reloadInputViews`, 36 to 57 ms, also in a warm process. Story 9-20 (job 008): 32 of 40 failing md-text-field checks lie in a block of 30 to 59 ms that starts 0 to 15 ms after the input; the product already starts its transition at the press; 4 of 10 runs on iPhone 26.3 and 2 of 5 on iOS 18.6 are clean. Story 6-2 (KNOWN-CAUSES row 35, job 037): the first HID key of a process creates UIKit's keyboard object once, 561 ms; its priming attempt (jobs 038 to 041, `KEYPRIME ms=13`) removed one outlier and left 2 to 4 first-phase misses per iPad run. Story 9-6 has first-attempt misses of 30 to 34 ms at Tab and one paste miss with an 89 ms block. The gap rule of the states suites compares within about [t-40, t+34] ms, so a block of 30 to 59 ms gives a miss in some runs and none in others. No frame can be drawn while the main thread is inside UIKit, and the products cannot avoid the call at that moment. Nobody has measured how much of each block is UIKit's own time, whether it grows with the load of the Mac, or how the suites could treat it without hiding a late product.

**Acceptance Criteria:**

- Given the bracketed intervals, when a reader opens the Dev Agent Record, then it has their length distribution for usual and quiet runs and, for every failing check of those runs, whether its missing frames lie inside one
- Given the helper, when the three mutation runs are done, then the 34 ms delay fails, the 50 ms product sleep fails and the run without the bracket shows the old misses
- Given the regression runs, when the table is read, then no suite lost a passing check and every treated sample is counted
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-23-ios-harness-uikit-responder-block-and-first-key.md`

### Story 9.24: md-accordion Android: items are not registered when the first toggle event of a defaultExpanded initialisation is built; a wrapped item is expanded at connection (s7-12-01)

Model: sonnet · Wave: 6 · mac lane n4 · android lane a4 (emulator-5562; the audit 7-2 uses the same lane later, jobs in a lane run one after the other) · no simulator · Depends on: 7-12-recheck-avatar-list-accordion

The gate-7 re-check 7-12 (2026-11-17) found two Android accordion tests that fail on canonical 3 of 3 times and that no dev story had re-run (story 9-3 was macOS only; story 9-4 ran only `NativeAccordionFloatingTest` and the modal and overlay set). Finding s7-12-01 in DEFECTS.md, open and blocking, gates 2 and 5. (a) `NativeAccordionInitializationTest.twentyWebInitializationTracesMatchThroughNativeScopes`: 20 of 80 traces differ (defaults-pass, exclusive-authored-pass, keep-one-pass, exclusive-union-pass and their prevent and stop variants). In the first `mdItemToggle` capture event of a `defaultExpanded` initialisation the native `items` snapshot reads first expanded false index -1 and second expanded false index -1; Chrome reads first expanded true index 0 and second expanded false index 1. So the items are not yet registered and indexed when the event is built. (b) `NativeAccordionDispatchTest.itemsWrappedInAnotherLayoutAreNeverOwnedNotEvenAtConnection` (line 77): in frame 1 the wrapped item `w0` is Expanded, the test expects Collapsed, so the defaultExpanded pass touched an item that is wrapped in another layout. The test files are unchanged since 2026-10-23. `NativeAccordion.kt` and `NativeAccordionFloating.kt` were changed by the install of story 9-4 on 2026-11-16 at 13:23 (overlay entry for the floating panel); the reviewer names that change as the likely cause, not as a proven one. md-accordion stays FAIL at gate 7 until this is fixed.

**Acceptance Criteria:**

- Given the two test classes, when they run five times after the change, then every run passes, and the change that introduced the failure is named with a run on the older sources
- Given every Android test class of the accordion family and the accordion paint and states suites, when they run once after the change, then all pass, and `NativeAccordionFloatingTest` is still 35 of 35
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-24-accordion-android-registration-before-first-toggle-and-wrapped-items.md`

### Story 9.25: md-list macOS: the full states suite fails in the pointer-buttons and custom-reorder family in 3 of 7 runs (s7-12-02)

Model: sonnet · Wave: 6 · mac lane d2b · no Android lane · simulator AWC-d2b (iPhone 26.3; create it as PARALLEL.md describes if it does not exist), only for one iOS run of the md-list suites if a shared list source changes · Depends on: 7-12-recheck-avatar-list-accordion

The gate-7 re-check 7-12 (2026-11-17) kept md-list at FAIL with finding s7-12-02 (DEFECTS.md, open and blocking, gates 2 and 5, macOS). Story 9-9 fixed C65-01 for the drag-reorder subset (20 of 20 alone and 20 of 20 with a second suite running; 12 of 20 before). The full `NativeListStatesIntegration` suite on canonical still fails in 3 of 7 runs: run 3 twice (59 and 68 fail lines), run 4 (137 lines; `custom-reorder-standard-single-select-light-ltr`: placeholder top 119.03 at web 5192, outside Chrome's 123.62 to 127.86, and the expand panel; the load fell from 167 to 23 during the run), run 5 at load 23 to 19 (15 lines; `pointer-buttons-standard-none-light-ltr` and `-rtl` r1: state layer 0.08 against 0.1 and corners 6.1 against 16 at web 606). Runs 1, 2, 6 and 7 pass (130779 and 130063 checks). Run 5 shows that load is not the only cause. The reviewer's reading is that the stale-frame hold of story 9-9 is applied after a drop but not after pointer press and release frames and not to the custom-reorder placeholder; that is a reading of the fail lines, not a measurement.

**Acceptance Criteria:**

- Given the full md-list states suite on macOS, when it runs ten times after the change, then every run passes, and the cause of each failing case is named with a per-frame capture
- Given a build whose pointer-button state-layer transition starts 33 ms late, when the suite runs, then it fails
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-25-list-macos-full-states-pointer-buttons-and-reorder-placeholder.md`

### Story 9.26: md-checkbox iPhone 26.3: one glyph-opacity check fails in every states run of the pointer-light cases (S7-6-01)

Model: sonnet · Wave: 6 · mac lane d3 · no Android lane · simulators AWC-d3 (iPhone 26.3) and an iPhone on iOS 18.6 for lane d3 (create them as PARALLEL.md describes if they do not exist) · Depends on: 7-6-recheck-checkbox-menu-sheets

The gate-7 re-check 7-6 (2026-11-17) kept md-checkbox at FAIL with finding S7-6-01 (DEFECTS.md, open and blocking, gate 5). `NativeCheckboxStatesIntegration` on iPhone 26.3 (canonical, shim v5 with key arrivals and the onScreen clock fix) fails exactly one check in each of 3 runs: 17851/17852, 17971/17972, 17977/17978. It is the same kind of check on a different case each time (`pointer-light-ltr-unchecked`, `pointer-light-ltr-unchecked-d4`, `pointer-light-rtl-checked`): glyph opacity rendered 1.0 at a Web time between 2680 and 3230 where Chrome's envelope is 0.0 to 0.95. So on one sample the native glyph is fully opaque where Chrome is at 0.95 or lower. iOS 18.6 passes 17480/17480 in one run; live selection passes 20 of 20. The end state is right; one sample of a fade is off by a few milliseconds. The reviewer puts it in the family of S918-01 and S61-IOS-01 (first native frame after an input one frame late on the phone); that is a reading, not a measurement, and the direction is not yet clear: a fade-out that starts one frame late and a fade-in that ends one frame early both give this fail line.

**Acceptance Criteria:**

- Given the checkbox states suite on iPhone 26.3, when it runs twenty times after the change, then every run passes, and the cause is named with a per-frame capture that shows the direction of the offset
- Given a build whose glyph fade starts 33 ms late, when the suite runs, then it fails
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-26-checkbox-iphone-pointer-glyph-opacity-one-sample.md`

### Story 9.27: md-menu: the states suite fails one motion frame or one flat-pixel sample in half of the runs on macOS and iOS (S7-6-02); named tests for two hooks (S7-6-03)

Model: sonnet · Wave: 6 · mac lane d5 · no Android lane · simulators AWC-d5 (iPhone 26.3) and an iPhone on iOS 18.6 for lane d5 (create them as PARALLEL.md describes if they do not exist) · Depends on: 7-6-recheck-checkbox-menu-sheets

The gate-7 re-check 7-6 (2026-11-17) kept md-menu (with item, group and sub-menu-item) at FAIL with finding S7-6-02 (DEFECTS.md, open and blocking, gate 5). `NativeMenuStatesIntegration` fails one check in 3 of 6 runs at ordinary load, a different case each time: macOS run 1 2523/2524 (`selection-keep-open click-plain-closes`: opacity at t=366, 1 of 18 frames; the native surface is at 0.99 for one frame where Chrome is at 0.70), iPhone 26.3 run 1 2523/2524 (`selection-keep-open click-checkbox`: flat pixels, shot 2 of 6), iOS 18.6 2523/2524 (`open-close-baseline-light click-anchor`: motion, 5 of 38 frames). The other runs are 2524/2524; story 6-1 recorded 2524 three times on macOS. Virtual 18/18, a11y 22/22 and paint 9092/9092 pass. The reviewer's reading of the macOS case is a repaint of the surface at full opacity for one frame before the close fade is applied; if that is what happens, a user can see it as a flash. Finding S7-6-03 (non-blocking, gate 1): the hooks `--md-menu-viewport-margin` and `--md-menu-section-gap` have no test that names them; they are only exercised through the paint fixture `menu-r4-paint.json`.

**Acceptance Criteria:**

- Given the menu states suite, when it runs twenty times on macOS, on iPhone 26.3 and on iOS 18.6 after the change, then every run passes, and every miss of the runs before is classed with a per-frame capture
- Given a build whose close fade starts 33 ms late, when the suite runs, then it fails
- Given the gate-1 matrix, when it is rebuilt, then both hooks have a test that names them on iOS and on Android
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-27-menu-states-one-frame-misses-and-hook-tests.md`

### Story 9.28: Laboratory macOS live test: test-preview-presentation fails at the date-picker commit click (INVALID_COORDINATES); the steps after it have never run

Model: sonnet · Wave: 6 · mac lane n1 · no Android lane · no simulator (the test drives the macOS live renderer AWCLivePreview) · Depends on: 7-18-recheck-navigation-rail

The shared live test `apps/native-ios-playground/scripts/test-preview-presentation.mjs` exits 1 on canonical, 2 of 2 runs in the gate-7 re-check 7-18 (job 7-18-recheck-navigation-rail-008-lab-ax, 2026-11-18) and in s7-4-005 (2026-11-16). It fails at line 67, `click(selected, 540, 515)` in the md-date-picker block: the live renderer answers 400 INVALID_COORDINATES, 'Click inside the native preview', so the point 540, 515 is outside the captured preview after a day was selected. Until 2026-11-15 the script failed earlier, in the md-autocomplete block (KNOWN-CAUSES row 15; fixed by story 6-7 with a patch of the script at 23:44 UTC that day), so the date-picker block and every block after it have not passed in any recorded run. Nobody owns this script: the audits called it out of scope. Open questions: is the commit button of the date picker inside the preview surface a user of the Laboratory sees (if not, the Laboratory user cannot commit a date: a product defect of the preview host or of the picker's layout in the preview), or did the layout of the picker change (stories 1-3, 1-5, 9-13 worked on it) and the fixed coordinates of the script are stale (a test defect).

**Acceptance Criteria:**

- Given the script on canonical after the install, when it runs three times, then every run exits 0 and every block has run
- Given the date-picker step, when the day is selected, then the commit button's inspected box lies inside the preview frame, and the record says whether the earlier failure was a test defect or a product defect
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-28-laboratory-macos-preview-presentation-date-picker-commit-click.md`

### Story 9.29: Select family on the iOS simulators: first frame one frame late after a hardware key (S61-IOS-01, S66-18-01, S66-18-02), select-all flat pixels (S66-18-03, S919-02), autocomplete states 1468 of 1472 (S919-01), and the TextField difference after fix 3

Model: sonnet · Wave: 6 · mac lane n2 · no Android lane · simulators AWC-n2 (iPhone 26.3) and AWC-n2-18 (iOS 18.6); both exist from story 6-6 · Depends on: 9-19-select-family-ios18-residuals-and-intermittent-click-loss

Story 9-19 fixed the lost clear click (C66-02; fix 3 in NativeInspection.swift, installed on canonical by its job 130) and found no fix for the rest. Open on canonical today: (1) S61-IOS-01, iPhone 26.3 with the iOS shim v5: select states 1029, 1029, 1028 of 1030 and multi 872, 872, 871 of 872 (9-19 job 100); the failing checks are single frames of the open motion after a hardware key (`select-keyboard-ltr arrowdown-open` opacity at t=49: web 0.807, native 0.657), one caret frame, one outside-close opacity frame and one multi reduced mdRemove/mdChange gap (+143 against +83 ms); with the shim before v5 the same sources had 1030 x3 and 872 x3. (2) S66-18-01 and S66-18-02 on iOS 18.6: select 1028/1030 x2 (`select-keyboard-rtl arrowdown-open` and `enter-open` opacity at t=49, native 0.494 and 0.396 against web 0.807), `multi-pointer-rtl escape` caret at t=200 (web 0.594, native 1.000 or 0.717). (3) S66-18-03 and S919-02: `select-all flat pixels` fails on iOS 18.6 in 2 of 2 runs (multi 869/872, 9-19 job 110) and on macOS in 12 of 50 loop runs; the menu rows band follows the md-menu-item ripple release fade through the shot window. (4) S919-01: autocomplete states on iPhone 26.3 1468 to 1470 of 1472; macOS 1472/1472. (5) Not classed after the install of fix 3: TextField states on iPhone 26.3 2042/2050 with fix 3 against 2048/2048 without, in `tf-throttle-200` (mdInput/mdSearch order), one run each (9-19 jobs 112 and 113). Until these are closed the gate-7 audit 7-2 of md-select, md-multi-select and md-autocomplete cannot pass, and stories 6-1 and 9-19 stay blocked.

**Acceptance Criteria:**

- Given the TextField states suite on iPhone 26.3, when it runs five times with fix 3 and five times without, then the record names the failing checks of each run and says whether fix 3 changes the tf-throttle-200 order; if it does, canonical has the corrected file or the file from before fix 3
- Given every failing check of S61-IOS-01, S66-18-01, S66-18-02, S66-18-03, S919-01 and S919-02, when a reader opens the Dev Agent Record, then the check has a class with run counts, and a class named harness cost shows a block of 12 ms or more in the delivery turn of every failing run
- Given the fixes, when select, multi and autocomplete states run three times on iPhone 26.3 and twice on iOS 18.6, then every run passes 1030/1030, 872/872 and 1472/1472; or the only misses left are of a class named harness cost, and the story ends blocked with the words coordinator decision and the table
- Given the select-all loop on macOS, when it runs 50 times after the change, then no run fails `select-all flat pixels`
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete.md`

### Story 9.30: md-accordion Android: inside a modal scope (dialog, sheet) the items are still not registered when the first toggle event is built (s7-20-01)

Model: sonnet · Wave: 6 · mac lane n4 · android lane a4 (emulator-5562; the audit 7-2 uses the same lane later, jobs in a lane run one after the other) · no simulator · Depends on: 7-20-recheck-accordion-2

The gate-7 re-check 7-20 (2026-11-18) kept md-accordion at FAIL with finding s7-20-01 (DEFECTS.md, open and blocking, gates 2 and 5, Android). Story 9-24 fixed s7-12-01 outside a modal scope: the two test classes pass there (5 of 5 and 3 of 3 in the reviewer's jobs A001 and A002). But `AccordionFloatingLayer` still composes the panel through `movableContentOf` whenever `LocalAWCModalSession` is not null, that is inside every `AWCModalScope` (dialog, bottom sheet, side sheet). The reviewer copied `NativeAccordionInitializationTest` and `NativeAccordionDispatchTest`, replaced the Box wrapper by `AWCModalScope`, and ran them three times (job 7-20-recheck-accordion-2-A003-modal-scope-probe, emulator-5558): both fail 3 of 3. `twentyWebInitializationTracesMatchThroughNativeScopes`: 20 of 80 traces differ; in the first `mdItemToggle` capture event of a defaultExpanded initialisation the native items read first expanded false index -1 and second expanded false index -1, Chrome reads first expanded true index 0 and second index 1. `itemsWrappedInAnotherLayoutAreNeverOwnedNotEvenAtConnection` line 77: the wrapped item w0 is Expanded, expected Collapsed. This is the signature of s7-12-01 (KNOWN-CAUSES: movableContentOf attaches the item nodes after the connection SideEffect). An accordion inside a dialog or a sheet is ordinary use, so md-accordion stays FAIL at gate 7 until this is fixed and guarded by product tests.

**Acceptance Criteria:**

- Given the two modal-scope classes, when they run five times after the change, then every run passes and the initialisation class shows 0 differing traces of 80; before the change they fail 3 of 3
- Given a defaultExpanded accordion inside a real dialog and inside a real bottom sheet, when the first `mdItemToggle` event is read, then its items carry index 0 and 1 and the first is expanded; the test is part of the product test family and fails with the fix reverted
- Given every Android test class of the accordion family, the accordion paint and states suites and the dialog, bottom-sheet and side-sheet classes, when they run once after the change, then all pass
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-30-accordion-android-modal-scope-registration-order.md`

### Story 9.31: md-list: the list states suite has a wider timing tier than the shared rule; a state layer that starts 33 ms late is not caught (s7-20-02)

Model: sonnet · Wave: 6 · mac lane d2b · no Android lane · simulators AWC-d2b (iPhone 26.3) and AWC-d2b-18 (iOS 18.6; create them as PARALLEL.md describes if they do not exist) · Depends on: 7-20-recheck-accordion-2

The gate-7 re-check 7-20 (2026-11-18) kept md-list at FAIL with finding s7-20-02 (DEFECTS.md, open, gate 4). The product is clean in the reviewer's runs: 10 of 10 valid full runs of `NativeListStatesIntegration` pass on macOS, the drag-reorder subset passes 20 of 20, and the half-crossing of the state layer is at median -3.1 ms and worst 11.4 ms against Chrome (job 007), inside one frame. The finding is in the test: `Tests/NativeListStatesIntegration.swift` lines 554 to 557 add a second tier (a Chrome envelope window of -50/+56 ms) whose misses are written as `input-latency` known gaps and not as failures. No other states suite (checkbox, switch, radio) has this tier. With it a state layer that starts 33 ms late passes 3 of 3 runs and one that starts 50 ms late fails 3 of 3 (job 004; story 9-25 job 007 saw the same). In the ten valid full runs the tier absorbed 0 to 24 frames per run. So the suite cannot show a two-frame delay, and the PASS of the suite says less than the PASS of the other states suites. The reviewer did not sweep +17 ms and did not run the 33 ms mutation on the shared window (-34/+40 ms) of checkbox, switch and radio.

**Acceptance Criteria:**

- Given the list states test after the change, when a reader compares its timing rule with the checkbox states test, then it has no tier wider than the shared rule, and the record names the constants of both
- Given the full md-list states suite on macOS without the tier, when it runs ten times, then every run passes, and every frame the tier absorbed before has a class with a per-frame capture
- Given builds whose state-layer start is delayed by 17, 33 and 50 ms, when the suite runs three times each, then the record says which delays fail, and 33 ms fails 3 of 3
- Given the list states suite on iPhone 26.3 and iOS 18.6 without the tier, when it runs three times and twice, then every run passes, or the story ends blocked with the words coordinator decision and the class table
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-31-list-states-suite-extra-timing-tier.md`

### Story 9.32: md-time-picker on the iOS simulators: single hand samples miss at taps, a drag and the period switch (S62-01, 02, 04, 05); misses inside UIKit focus turns (S62-03, 06, 07)

Model: sonnet · Wave: 6 · mac lane fi · android lane a1 (emulator-5556) for the regression once · the simulators of work/fi-lab (files udid = iPhone 26.3, udid-ipad, udid-18 = iOS 18.6) · Depends on: 6-2-pickers-audit-readiness

Story 6-2 made md-time-picker ready on macOS and Android, but the canonical states suite (15551 checks) still misses on every iOS simulator. Job `6-2-pickers-audit-readiness-120-canonical-all` (2026-11-18, load 12 to 19 at each start): iPhone 26.3 15537 and 15545, iPad 15533, iOS 18.6 15545, macOS 15551 of 15551. The open findings in DEFECTS.md: S62-01 tap-hour-7, one hand sample at t=1100 (iPhone, iOS 18.6); S62-02 dismiss-escape tap-hour-5, hand (iPhone, the failing time varies 1133 to 1166 ms); S62-04 drag-inner-14-to-17, hand at t=1899 (iPhone, one sample at a segment boundary); S62-05 dial-drag am, period-am at t=4699 (iPhone, a fixed time slot, not load dependent); S62-03 focus-trap-dial Tab and Shift+Tab, hand, 3 to 4 samples (iPhone; jobs 042 and 043 of 6-2 found UIKit's becomeFirstResponder, anchor 23 to 36 ms; `tabkeyat` is installed and a residual remains); S62-06 open at t=266, dialog, mode-dial and scrim (iPad 10 checks, iOS 18.6 3 checks; a first-open stall of 40 to 110 ms, KNOWN-CAUSES row 35); S62-07 mode toggle to-input and to-dial (iPhone, iOS 18.6; job 048: the input-hour field's becomeFirstResponder takes 17 to 28 ms inside the motion; the patch focusaftermode exists and is NOT installed because nobody tested a key typed 100 ms after the toggle). A one-off in job 120: input-keyboard-12h Tab status, 3 checks on the iPhone. S62-01, 02, 04 and 05 have no per-frame capture and no class. The harness story 9-23 ended without an install: there is no harness helper; UIKit's turn at a focus change is measured (12 to 21 ms inside a main-thread block of 18 to 35 ms) and no rule excuses it; -O changes nothing for text fields.

**Acceptance Criteria:**

- Given each of S62-01, 02, 04 and 05, when a reader opens the Dev Agent Record, then it has a per-frame capture of a failing and a passing attempt, a class and the fix or the reason why none exists
- Given a change of a sample time in the test, when the product motion is delayed by 33 ms, then the changed check fails in every run of three
- Given focusaftermode, when a key is typed 100 ms after the mode toggle, then the field receives it and the focus and blur events have the order of the Web trace; otherwise the patch is not installed
- Given canonical after the install, when the time-picker states suite runs on iPhone 26.3 three times, on the iPad twice and on iOS 18.6 twice behind the load gate, then no run has a miss, or the story ends blocked with the words coordinator decision and the table
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-32-time-picker-ios-residual-hand-and-focus-turn-misses.md`

### Story 9.33: md-color-picker on the iOS simulators: the plate thumb press and the popover open miss in every run (S62-09, S62-10); one unnamed miss on macOS

Model: sonnet · Wave: 6 · mac lane fi2 · android lane a6 (emulator-5566) for the regression once · simulators AWC-fi2 (iPhone 26.3), AWC-fi2-ipad and AWC-fi2-18 (iOS 18.6); create them as PARALLEL.md describes if they do not exist · Depends on: 6-2-pickers-audit-readiness

Story 6-2 made md-color-picker ready on macOS and Android, but the canonical states suite (20950 checks) still misses on every iOS simulator. Job `6-2-pickers-audit-readiness-120-canonical-all` (2026-11-18, load 12 to 19 at each start): iPhone 26.3 20946, iPad 20945, iOS 18.6 20948, and macOS 20949 of 20950 (the macOS miss is not named in the record). The open findings in DEFECTS.md: S62-09 drag-plate, thumb press at t=100 and t=133 (iPhone in jobs 111, 116 and 120; the installed `cpshift` reduced it on the iPad and iOS 18.6 only); S62-10 popover open and show() (iPhone, iPad 5 checks, iOS 18.6; the failing case moves between runs). One-offs in job 120: presets click-5 and ArrowRight preset, one check each. None of them has a per-frame capture or a class. The harness story 9-23 ended without an install: there is no harness helper; UIKit's turn at a focus change is measured (12 to 21 ms inside a main-thread block of 18 to 35 ms) and no rule excuses it.

**Acceptance Criteria:**

- Given S62-09 and S62-10, when a reader opens the Dev Agent Record, then each has a per-frame capture of a failing and a passing attempt, a class and the fix or the reason why none exists
- Given a change of a sample time in the test, when the product motion is delayed by 33 ms, then the changed check fails in every run of three
- Given the macOS miss of job 120, when the suite runs three times on macOS, then the record names the check and says whether it repeats and why
- Given canonical after the install, when the colour-picker states suite runs on iPhone 26.3 three times, on the iPad twice and on iOS 18.6 twice behind the load gate, then no run has a miss, or the story ends blocked with the words coordinator decision and the table
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-33-color-picker-ios-thumb-press-and-popover-open-misses.md`

### Story 9.34: md-autocomplete: the caret rotation starts late on the iOS simulators; the patch that starts it at the open write fails ac-multiple-rtl click-open on macOS

Model: sonnet · Wave: 6 · mac lane n2 · no Android lane · simulators AWC-n2 (iPhone 26.3) and the iOS 18.6 simulator of lane n2 (both exist; story 9-29 used them) · Depends on: 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete

On the iOS simulators the caret of md-autocomplete starts its 200 ms rotation late: before any change 0 of 10 runs of `NativeAutocompleteStatesIntegration` are clean on iPhone 26.3 (caret checks type-a, ac-multiple-ltr click-open, enter caret at t=66). Story 9-29 found the cause: `AWCSelectCaret` in `NativeAutocomplete.swift` gets no start time, so the rotation starts at the SwiftUI onChange after the options render, while md-select passes `rt.openWriteAt`. The patch that passes `rt.openWriteAt` gives 1472, 1472, 1472, 1471, 1472 of 1472 on iPhone 26.3 (job 078) and 1471 and 1472 on iOS 18.6 (job 079). On macOS the same patch fails ac-multiple-rtl click-open caret at t=199 in 4 of 5 runs (jobs 110 and 140; 1472 of 1472 in every run before the patch) and passes when debug logging is on (job 130, 2 of 2). The trace of job 130: rtl and ltr click-open each show one open write and a caret start 15 to 18 ms later, stamped at the write time. The patch was installed once before its macOS regression and rolled back; canonical `NativeAutocomplete.swift` has md5 929438ff again. The 33 ms mutation of job 140 was a no-op, so no mutation result exists. Open single frames with the patch: job 078 run 4 (reduced escape opacity t=33) and job 079 run 1 (ac-multiple-ltr click-open motion t=149); they belong to story 9-36.

**Acceptance Criteria:**

- Given the reworked patch, when autocomplete states run five times on macOS, then no run has a caret miss, and five runs on iPhone 26.3 and two on iOS 18.6 have none either
- Given a build whose caret start is delayed by 33 ms, when the suite runs three times on macOS and on iPhone 26.3, then every run fails a caret check
- Given the record, when a reader asks why rtl failed at t=199 with the first patch, then it gives the measured reason
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-34-autocomplete-caret-clock-late-on-ios-and-macos-rtl.md`

### Story 9.35: Select and multi-select on the iOS simulators: the flat-pixels check after a pointer select-all compares a native shot that is stamped about one frame too early (S66-18-03, S919-02)

Model: sonnet · Wave: 6 · mac lane n4 · no Android lane · simulators AWC-n4 (iPhone 26.3) and AWC-n4-18 (iOS 18.6); create them as PARALLEL.md describes if they do not exist · Depends on: 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete

The flat-pixels check after a pointer select-all in `NativeMultiSelectStatesIntegration.swift` and `NativeSelectStatesIntegration.swift` fails now and then on the iOS simulators (S66-18-03, S919-02; for example multi-select 871 of 872 on iPhone 26.3 in job 100 of story 9-29, rtl). Measured in story 9-29 (job 040, iOS 18.6, band pixel (25,89), shots every 6 ms): the ripple fade runs at 0.42 level per ms; the native pixel passes Chrome's value 206 at about t=605 while the compared shot is stamped t=600; one shot costs about 16 ms; Chrome gives 0.807 with a spread of 0.000 over 20 runs. An interpolated check was tried (interpolate between the two bracketing native shots at the time of the Web shot, limit unchanged at mean 1.0): with no shift it fails rtl select-all 10 of 10 on iOS 18.6 and iPhone 26.3 with the native pixel about 6 levels lighter (6 levels at 0.42 level per ms are about 14 ms), ltr passes on iOS 18.6 and fails 3 of 10 on iPhone 26.3; fade shifts of +17, +33, -25 and -33 ms fail 3 of 3, but -17 ms passes (jobs 060 to 065 and 132). The band time series shows no product difference between ltr and rtl (job 111). So the check stamps the native shot about one frame too early, or is wrong in time in another way; it is not installed and canonical has the old check.

**Acceptance Criteria:**

- Given the corrected check, when ltr and rtl select-all run ten times on iOS 18.6 and on iPhone 26.3, then there is no flat-pixels fail
- Given the ripple fade shifted by +17, -17 or +33 ms, when the check runs three times each, then every run fails
- Given the record, when a reader asks why rtl failed 10 of 10 with the first interpolated check, then it gives the measured reason
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-35-select-all-ripple-flat-pixels-check-shot-time.md`

### Story 9.36: md-select and md-autocomplete on the iOS simulators: single frames miss after a hardware key or click opens the menu (S61-IOS-01, S66-18-01, OPEN-131a, OPEN-131b)

Model: sonnet · Wave: 6 · mac lane n5 · no Android lane · simulators AWC-n5 (iPhone 26.3) and AWC-n5-18 (iOS 18.6); create them as PARALLEL.md describes if they do not exist · Depends on: 9-29-select-family-ios-first-frame-lag-flat-pixels-autocomplete

`NativeSelectStatesIntegration` on the iOS simulators misses single frames after a hardware key opens the menu (S61-IOS-01, S66-18-01): the keyboard subset has a miss in 8 of 10 runs on iPhone 26.3 and in 8 of 10 on iOS 18.6 (jobs 073 and 074 of story 9-29). Job 131 (select-keyboard-rtl ten times with UIKit bracket hooks): 1817 of 1820; the open write comes 3 to 9 ms after the key (once 18 ms); the first changed frame 49 to 119 ms after the key, and that time does not predict a miss; the three misses are a blank frame at t=83 (OPEN-131a) and a reduced-motion enter opacity at t=33, twice (OPEN-131b). Also open in autocomplete: job 078 run 4 (reduced escape opacity t=33) and job 079 run 1 (ac-multiple-ltr click-open motion t=149). Tried without effect: the open clock started at the key handler (jobs 073, 074) and an optimised build (job 076). Main-thread blocks of 39 to 130 ms in the delivery turn have the same length in passing runs, so they explain nothing by themselves. Two facts from other stories: the first `AccessibilityNotification.post` with an AttributedString costs 25 to 37 ms on the main thread once per process (story 9-16; `NativeMultiSelect.swift` line 876, `NativeAutocomplete.swift` line 713 and `PopupScope.swift` post announcements); story 9-32 measures what runs inside the harness's input call.

**Acceptance Criteria:**

- Given each open single-frame miss, when a reader opens the Dev Agent Record, then it has a per-frame capture next to a passing attempt, a class and the fix or the reason why none exists
- Given canonical after the install, when the select keyboard subset runs ten times on iPhone 26.3 and ten times on iOS 18.6, then no run has a miss, or the story ends blocked with the words coordinator decision and the table
- Given a fix, when the open motion is delayed by 33 ms, then the suite fails in every run of three
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-36-select-keyboard-open-single-frame-misses-ios.md`

### Story 9.37: iOS states harness: while it samples, the test's own pump keeps the main thread in CoreAnimation commits; measure the cost per tick and try a cheaper sampler in a private copy (no install)

Model: opus · Wave: 6 · mac lane d3 · no Android lane · simulators AWC-d3 (iPhone 26.3) and AWC-d3-18 (iOS 18.6); create them as PARALLEL.md describes if they do not exist · Depends on: 9-23-ios-harness-uikit-responder-block-and-first-key

One-frame misses after an input on the iOS simulators are open in many suites: text field tab-out (final failures in 2 of 5 runs), select keyboard open (a miss in 8 of 10 runs), table sort click (2 of 10 runs after the announce fix), time picker taps and drags (1 to 4 of 5676 checks), list. Every story saw main-thread blocks of 20 to 130 ms in the turn of the input, with the same length in passing and failing runs. What is known: story 9-23: UIKit's own turn at a focus change is 12 to 21 ms inside a block of 18 to 35 ms and the rest of the block is run-loop time that its traces could not attribute; an optimised build and a motion clock started at the delivered input change nothing for text field and select. Story 9-16: one real product cost (the first accessibility announcement, 25 to 37 ms, fixed in its tree). Story 9-32, job 010 (time picker tap on iPhone 26.3, /usr/bin/sample at 1 ms, 12 reports): about 90 percent of the main-thread samples are in the test's own pump; CA::Transaction::commit is about 57 percent (the mach_msg round trip to the render server about 35 percent), run-loop waiting about 25 percent, the shim's touch dispatch 7 samples, named time-picker product functions 0 samples; the failing and the passing profile are equal within 5 percent; the reports are 1 s aggregates and not resolved in time. Story 9-16 job 028 saw the same picture (test raster and display-link work dominate). So the measuring itself may hold the main thread: while the pump samples, a frame of the product after an input comes late by an amount that depends on the phase. This is a hypothesis with one profile behind it, not a result.

**Acceptance Criteria:**

- Given the record, when a reader asks what the main thread does during one sampling tick on the iOS simulator, then it names the functions and gives the time of each part
- Given the prototype, when ten alternating pairs run for each of the four subsets, then the table shows the runs with a miss per arm with load1max per run
- Given the prototype, when the 33 ms product-delay mutation of each suite runs three times, then every run fails
- Given the end of the story, when the coordinator reads it, then nothing is installed and canonical is byte-identical to before
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-37-ios-states-harness-sampling-pump-main-thread-cost.md`

### Story 9.38: iOS states checks: a miss after an input depends on where the display grid falls against the oracle clock; make the comparison independent of that phase without changing a limit (private prototype, no install)

Model: opus · Wave: 6 · mac lane d3 · no Android lane · simulators AWC-d3 (iPhone 26.3) and AWC-d3-18 (iOS 18.6); both exist (story 9-37 made them) · Depends on: 9-37-ios-states-harness-sampling-pump-main-thread-cost

Story 9-37 closed the question of the sampling pump: it spins (22,000 to 30,000 ticks per second, 82 to 95 percent of the main thread) but a sampler without the forced flush does not reduce the misses (runs with a miss in ten pairs: time picker 5 against 5, select 2 against 7, table 1 against 0, text field 10 against 10); nothing was installed. Its time-resolved trace of one input turn (job 010, time-picker tap-hour-7, the hand check at t=1100, failing run 877 of 878 against passing run 878 of 878) shows the same main-thread profile in both runs within 0.5 ms: the phase fires 1 to 3 ms after its planned time, the touch-down is delivered 8 to 11 ms after the plan (inside a pump tick whose run-loop call lasts 14 to 16 ms), UIKit handles it in 3 ms, the product writes its value 10 ms after the delivery, the touch-up follows and a 26 ms run-loop call hands the focus over. What differs is the phase: in the failing run the display grid (vsync 1073.2, 1089.9, 1106.5) sits 1.8 ms earlier against the oracle clock, so the frame that the t=1100 check reads and the next one (hand 118.6 and 62.0 against the Web's 120.9) straddle the Web value differently. So the miss is decided by where the 16.7 ms display grid falls against the oracle clock, on top of a native start that is later than Chrome's by the harness's own delivery delay plus UIKit and product work. Open misses of this shape: text-field tab-out and press-focus (motion lines in 10 of 10 runs; final failures in 2 to 7 of 10 runs; no first-frame threshold separates failing from passing attempts, story 9-20), time-picker taps, drags and the period switch (S62-01, 02, 04, 05), select keyboard open (opacity at t=83: web 0.934, native 0.899), the table sort click (1 of 10 to 20 runs), colour-picker thumb press, search on iOS. Rejected so far, each with a measurement: a harness helper around UIKit's focus turn, an optimised build, a motion clock started at the delivered input, an earlier blur signal, the lite sampler.

**Acceptance Criteria:**

- Given the record, when a reader asks why one run of a subset misses and the next passes, then it shows the numbers that decide it for at least one check per subset
- Given the prototype, when ten alternating pairs run per subset, then the table gives the runs with a miss per arm with load1max per run
- Given the prototype, when the product is delayed by 33 ms, then every run of three fails in each subset; the result for 17 ms is given per subset
- Given the end of the story, when the coordinator reads it, then nothing is installed and canonical is byte-identical to before
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-38-ios-states-checks-phase-of-the-display-grid.md`

### Story 9.39: md-switch: the states suite passes when the state layer starts 33 ms late (checkbox and radio fail the same mutation)

Model: sonnet · Wave: 6 · mac lane r2 · no Android lane · simulators AWC-r2 (iPhone 26.3) and AWC-r2-18 (iOS 18.6); create them as PARALLEL.md describes if they do not exist · Depends on: 9-31-list-states-suite-extra-timing-tier

Story 9-31 ran one mutation on the three suites that share the timing window of -34/+40 ms: with the state-layer start delayed by 33 ms the checkbox states suite fails (13 failed checks), the radio states suite fails (31), and the switch states suite passes with 0 failed checks (job 9-31-016, macOS). So `NativeSwitchStatesIntegration` cannot show a two-frame delay of its state layer, and its PASS says less than the PASS of checkbox and radio. md-switch has a gate-7 PASS in the ledger that rests on this suite. The same kind of gap was finding s7-20-02 for md-list (a 33 ms delay passed there because of an extra tier); the list suite now has a crossing-offset check with a 17 ms late limit that fails +17, +33 and +50 ms in 3 of 3 runs each.

**Acceptance Criteria:**

- Given a build whose switch state layer starts 33 ms late, when the suite runs three times on macOS, then every run fails
- Given the unmutated product, when the suite runs ten times on macOS, then every run passes, or the misses are reported as product findings with their numbers
- Given the record, when a reader asks why the old suite passed a 33 ms delay, then it names the checks and sample times
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-39-switch-states-suite-passes-a-33ms-delay.md`

### Story 9.40: md-navigation-rail: the members test hangs on macOS in half of the runs (exit 142) and once ran 970 s

Model: sonnet · Wave: 6 · mac lane d6 · no Android lane · no simulator needed for the macOS fixture (AWC-d6 on iPhone 26.3 only if the product changes) · Depends on: 9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests

Story 9-16 ran `NativeNavigationRailMembersIntegration` on macOS six times with the scroller style pinned and six times unpinned (job 108, canonical tree, debug build). Three pinned and three unpinned runs ended with exit 142 after the 300 s timeout without a result line; one passing run took 970 s where the others take 54 to 86 s; the passing runs show 21/21. The release-build run of story 1-2 (job 162) ended with exit 142 for the same fixture. So the fixture hangs or stalls in about half of its runs, independent of the scroller pin and of the build mode. md-navigation-rail has a gate-7 PASS (s7-18) that rests on this test for the four members toggleLabel, disableFocusManagement, overflowIcon and mdSubmenuToggle (story 9-14). A test that hangs in half of its runs is either a product hang (a submenu that never reports open or closed, a focus move that never lands) or a test that waits for something that sometimes does not come; which of the two is not known.

**Acceptance Criteria:**

- Given the fixed tree, when the members fixture runs twenty times on macOS, then every run ends with 21/21 in under 120 s
- Given a mutation of one member, when the fixture runs, then it fails with a named check
- Given the record, when a reader asks why the fixture hung, then it names the call on the main-thread stack and says whether the product or the test was at fault
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-40-navigation-rail-members-test-hangs-on-macos.md`

### Story 9.41: md-table on the iPhone: one sort motion starts a frame late in one of eight runs (S7-15-01 residual) and the selection motion after a click starts late (S9-16-03, S9-16-04)

Model: sonnet · Wave: 6 · mac lane d6 · no Android lane · simulators AWC-d6 (iPhone 26.3), an iPhone on iOS 18.6 and AWC-d6-ipad · Depends on: 9-38-ios-states-checks-phase-of-the-display-grid, 9-16-table-ios-sort-click-late-start-and-web-role-race

The gate-7 re-check 7-19 left md-table at FAIL. Blocking is the residual of S7-15-01: on iPhone 26.3 the case tb-sort-ltr [3] click-dessert misses the order motion (38/44 frames) in one of eight runs, in a quiet minute; base and fix of story 9-16 share it (18/22 each), and a -O build shows it less often (2 of 1010 checks against 9 of 1010). Open beside it are S9-16-03 and S9-16-04: case tb-pagination-rtl [0] select-row-0, check motion selected:pg1-0, the native value stays 0.00 at +33 and +50 ms where the Web value is 0.33 and 0.62 (one run in about a hundred in the loop of job 024, seen again in two reviewer runs at load above 100). Both are a native motion that starts late after a pointer click on the iPhone. Story 9-38 measured that the iOS harness delivers a pointer or a key 0 to 22 ms after the time the test plans for it, and that the comparison held this delay against the component; on 2026-11-19 the user agreed to compare at the delivered input for text field and select. The table test still compares at the planned time. The reviewer also found that the table states suite passes when a motion starts 17 ms late.

**Acceptance Criteria:**

- Given the diagnostics of story 9-38, when the two cases miss, then every FAIL line carries the delivery delay, the stall bracket and a class
- Given the chosen way, when base and arm run in pairs, then the table shows the misses of each arm per runtime and the +33 ms mutation fails three of three in the arm
- Given the record, when a reader asks why the sort motion started late in one of eight runs, then it names the cause with numbers and says whether the test, the system or the product is at fault
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-41-table-iphone-sort-residual-and-late-selection-start.md`

### Story 9.42: tools/ax: an empty capture is reported as a pass (S7-19-01); the macOS configure step times out under load (S7-19-02)

Model: sonnet · Wave: 6 · mac lane d4 · android lane a2 (its emulator as PARALLEL.md names it), for one capture · simulator AWC-d4 (iPhone 26.3), for one capture · Depends on: 9-16-table-ios-sort-click-late-start-and-web-role-race

Three times in two days an accessibility job ended with exit 0 and a pass row although it had captured nothing: audit 7-22 (jobs 009 and 010, AWCLivePreview was not built in the snapshot), audit 7-19 (jobs 006 and A001, 0 cases captured on iOS and on Android) and story 9-27 (job 026, spawn ENOENT of AWCLivePreview, exit 0). The reviewers noticed and repeated the jobs, but a gate-6 result must not depend on a reader who notices an empty capture. The reviewer of 7-19 filed this as S7-19-01 (tools/ax, all platforms) and filed S7-19-02: the configure step of the macOS capture for md-table timed out once at high load.

**Acceptance Criteria:**

- Given a snapshot without the preview binary, when the capture runs, then it ends non-zero with a FAIL row that names the missing binary
- Given a capture with fewer cases than asked, when summary.mjs runs, then it ends non-zero and prints both numbers
- Given the unchanged components, when the captures run after the change, then the findings equal those of the last audit
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-42-tools-ax-empty-capture-is-a-failure.md`

### Story 9.43: md-search on iOS 18.6: about 60 ms without a frame after the docked open is applied (S1-2-B2)

Model: sonnet · Wave: 6 · mac lane n3 · simulator: the iPhone on iOS 18.6 that story 1-2 used (work/n3-lab/search2/common.sh names it) · Depends on: 1-2-md-search-finish-and-install

Story 1-2 ended with one open finding, S1-2-B2 (DEFECTS.md). On the iOS 18.6 simulator the case docked-divided-ltr of `NativeSearchStatesIntegration` fails `click-bar-focus` in 10 of 10 runs (job 166; one time step, t=83, with two or three properties: bar x, bar width, panel opacity) and `Escape-closes` in 2 of 10. Job 169 (three launches, third click of the run, times from the click start): the open state is written about 2 ms after the press (+12 to +20), the first applyTracks with open=true runs at +40 to +52, and then no frame is presented for about 60 ms: native frames at t=35 and then t=99 to 115, while the Web shows its first frame with panel opacity above 0 at t=66.6 (the envelope accepts up to 100.6). No line of the component's trace runs inside the hole; the SwiftUI tap action arrives after it, at +73 to +80. Moving the open to the UIKit touch end (patches/tapup.py) changed nothing and is not installed. The +33 ms mutation of the close fails Escape-closes 3 of 3 (job 167). What holds the main thread in the hole is not known: the trace cannot show that no code of ours is on the path.

**Acceptance Criteria:**

- Given a launch that misses click-bar-focus, when a reader opens the record, then the stacks of the 60 ms hole are there with the times that cut them out
- Given end A, when the line is written, then it carries the bracket and the share, and nothing is installed
- Given end B, when the search states suite runs ten times on iOS 18.6 after the fix, then click-bar-focus passes in every run or its misses are classed with numbers, and the +33 ms mutation fails 3 of 3
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-43-search-docked-open-frame-hole-ios18.md`

### Story 9.14: md-navigation-rail: phone RTL release ripple (S7-4-02); native tests for four untested members (S7-4-01)

Model: sonnet · Wave: 6 · mac lane n5 · android lane a3 (emulator-5560) · simulators AWC-n5 (iPhone 26.3), an iPhone on iOS 18.6 and AWC-n5-ipad (create them as PARALLEL.md describes if they do not exist) · Depends on: 7-4-audit-navigation-rail-and-app-bar

The gate-7 audit s7-4 (2026-11-16) failed md-navigation-rail and md-navigation-rail-tab. S7-4-02 (blocking): `NativeNavigationRailStatesIntegration` fails on both phone runtimes: iPhone 26.3 in 3 of 3 runs (539914/539978, 540111/540170, 540401/540448) and iOS 18.6 in 1 of 1 (540115/540167). The failing cells are the same in every run: `standard-all-rtl` and `standard-selected-rtl`, phase `release`, t+50 and t+66 ms, tab0 and tab2 (ripple wave samples, for example web 0.61 against native 0.28), and in two of the runs `standard-selected-rtl toggle-expand t+66`. The LTR cells pass on the phone. iPad 26.3 (2 of 2 runs), macOS and Android pass every check. Earlier phone runs missed in the same way (n5-044: 539688/539765), and the iPhone count in `docs/native-parity/md-navigation-rail.md` is an iPad count. The reviewer saw each native sample value three times in a row (about 20 frames per second on the phone simulator) and did not name a cause. S7-4-01 (blocking): the rail properties `toggleLabel`, `disableFocusManagement` and `overflowIcon` and the rail-tab event `mdSubmenuToggle` are implemented in SwiftUI and Compose and listed in the Laboratory, but no fixture, test or probe exercises them.

**Acceptance Criteria:**

- Given the iPhone 26.3 simulator, when rail states run three times, then every run passes every check, and the same suite failed the RTL release cells before the change; two runs on iOS 18.6 pass as well
- Given the cause, when a reader opens the Dev Agent Record, then it says why the RTL cells failed on the phone only, with the per-frame measurements before and after the change
- Given each of the four members of S7-4-01, when its Swift case and its Android case run, then they pass, and each failed in its mutation run
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

Story file: `_bmad-output/implementation-artifacts/9-14-navigation-rail-phone-rtl-release-ripple-and-member-tests.md`

