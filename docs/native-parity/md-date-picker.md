# Date picker parity checkpoint (md-date-picker)

Status (n4, 2026-11-12): dedicated SwiftUI and Compose renderers replace the shared `temporalPicker` / `PickerComponent`
adapters in production dispatch (`AWCNativeView` / `AWCComponent`). Public appearance and method APIs exist on both platforms.
The macOS, iOS-simulator and Android checks below run against trusted-input Chrome 153 oracles captured on the Mac.
Source review: [md-date-picker-source-review.md](md-date-picker-source-review.md); plan:
[md-date-picker-native-plan.md](md-date-picker-native-plan.md).

## Source (gate 1)

Re-check (2026-10-31): the reviewed sources are unchanged (seven hashes in
`outputs/native-parity/md-date-picker/source-changes/mirror2/final-source-hashes.txt`); the Mac Chrome 153 capture
(`web-oracle-mac/`) replaces the cloud one (3 rect differences, 1 event difference: `cloud-vs-mac.txt`). A reduced-motion
paint capture (`web-oracle-mac/paint-reduced.json`, n4-048) supports decision 9.

## Browser reference (gate 2)

`n4-lab/dp/convert.py` / `convert_paint.py` condense the Mac capture into the shared fixtures (byte-identical on every
platform: `datepicker-web-*` / `DatePickerWeb*`):

* Paint: 129 cases (every variant × theme × direction open and closed, the field states, locales en-US / de-DE / fr-FR /
  ja-JP / ar-EG / he-IL / en-GB, week starts, separators, translated labels, header / actions / leading-icon /
  calendar-icon slots, the entry mode, the year grid, the docked month / year lists, densities −1…−4 own and inherited,
  every hook, phone viewports), one screenshot each; the same 129 under reduced motion.
* States: 24 runs with per-frame motion samples and md* events (modal / docked × pointer / keyboard, LTR / RTL, the year
  view, the docked lists, the entry mode, typing into the field, clear, Escape, scrim, outside press, commit-on-select,
  bounds, validity, the focus trap, a phone viewport), and the same 24 under reduced motion.

## Renderers and APIs (gate 4)

* Swift: `NativeDatePicker.swift` (`AWCNativeDatePicker`: the md-text-field trigger with the clear / calendar
  md-icon-buttons, the modal dialog in the `AWCModalScope` layer, the docked panel under the field, header, nav, weekdays,
  day grid, year grid, entry field, actions, docked month / year lists; `AWCDatePickerController`, `AWCDatePickerValidity`),
  `DatePickerModel.swift` (`AWCDay`, `AWCDateLocale` with Chrome's ICU patterns, `AWCDatePickerModel`),
  `DatePickerAppearance.swift` (`AWCDatePickerAppearance`, a hook map with `init(values:)`; `awcDatePickerAppearance(_:for:)`,
  `awcDatePickerToday`, metrics).
* Compose: `NativeDatePicker.kt`, `AWCDatePickerModel.kt`, `AWCDatePickerAppearance.kt` (the hook map with `fromValues`,
  the appearance / today / controller scopes, `AWCDatePickerController`, `AWCDatePickerValidity`, metrics),
  `AWCDatePickerRuntime.kt`; `AWCComponent` dispatches `"md-date-picker" -> NativeDatePicker(p, controlEvent, content)`.
* Shared edits (anchored, pre-image checked, installed with the component): the dispatch on both platforms; md-button
  `#symbol` slot size; the composite key router and `AWCNativeFocusRequest` on the shared focus surface
  (`composite-keys.py`); md-button focus-ring offset (`button-focus-ring.py`); the shared Arabic / Hebrew fallback faces in
  `AWCNativeFonts` used by md-button labels (`font-fallback.py`, see PARALLEL.md).
* Both platforms:
  * **Hooks:** all 40 `--md-date-picker-*` hooks. The five duration hooks and `selection-bloom-easing` set the keyframes'
    length and the bloom-in curve; an exited list, year view or panel leaves after the source's fixed 200 ms (its timers
    do not read the hooks).
  * **Events:** `mdOpen` / `mdClose`, `mdCancel`, `mdSelected` (staging), `mdChange` (`value`, `date`), `mdInput`,
    `mdViewChange` (`month`, `year`, `source`), `mdMenuOpen` / `mdMenuSelect`, `mdModeChange`, `mdValidityChange` after the
    first evaluation; inner fields' events stay inside the picker.
  * **Keys:** the calendar grid (arrows mirrored in RTL, Home / End, Page Up / Down, Shift+Page = year, Alt+ArrowUp /
    ArrowDown = Page), Enter commits, Space stages, the year grid (three a row, Page ± 18, Home / End, Control = list ends,
    disabled years skipped), Shift+M / Shift+Y open the docked lists, list rows rove with ArrowUp / ArrowDown / Home / End,
    Escape closes a list then the picker, Tab / Shift+Tab trapped in the modal dialog.
  * **Motion:** scrim fade 150 / 200 ms, modal panel scale 300 ms emphasized, panel / list / year-view bloom out 200 ms,
    selection / docked bloom in 450 ms, calendar bloom 300 ms, grid slide 300 ms (RTL mirrored), the docked pick's ripple
    beat (md-ripple's `whenSettled` bound: 200 ms from the click; 150 ms reduced); reduced motion presents end states.
  * **Methods:** `AWCDatePickerController` (`.awcDatePickerController(_:for:)` / `AWCDatePickerControllerScope`): `show()`,
    `close()`, `clear()`, `focusInput()`, `checkValidity()`, `reportValidity()` (shows the message as the field's error text
    and focuses the field — the source's inline validation presenter), `getValidity()` (`valid`, `validationMessage`,
    `valueMissing`, `customError`), `setCustomValidity(_:)`; `isDateDisabled` is a predicate on the controller.

## Results (gate 5)

| Platform | Paint (motion fixture, decision 9) | Paint (reduced fixture) | States (24 + 24 runs) | Jobs |
| --- | --- | --- | --- | --- |
| macOS (SwiftUI) | 37,183 / 37,183, 129 cases (633 recorded differences) | 37,789 / 37,789 (27) | 10,417 / 10,417; three docked / year / entry debug runs 2,488 / 2,488 | n4-0766, 1-3-...-002 |
| iPhone 17 Pro, iOS 26.3 (AWC-n4) | 37,181 / 37,181 (635) | 37,787 / 37,787 (29) | 10,417 / 10,417 | n4-0767, 1-3-...-002 |
| iPad Pro 11-inch (M5), iOS 26.3 (AWC-n4-ipad) | 37,181 / 37,181 (635) | 37,787 / 37,787 (29) | 10,417 / 10,417 | 1-3-...-010 |
| Android (Compose, emulator-5562) | 31,436 / 31,436 (637) | 32,042 / 32,042 (31) | 10,417 / 10,417 | 1-3-...-A004 |

Evidence: `outputs/native-parity/md-date-picker/native-swift`, `native-ios`, `native-android`; Mac Chrome 153 oracles in `web-oracle-mac`.

Each paint case checks the locale strings, the host, every part box, the days' states and every flat pixel of the clip; each
states run replays Chrome's input at its recorded time and checks the md* events with every detail, the per-phase end state
(value, open, the focused part, the roving tab stop, the selected day, the view label, the open list, the year grid's
scroll, the trigger / entry text, the error) and every per-frame motion sample at its time into the run (the native input
latency is printed, not compared: macOS states-18: calendar bloom median 127 ms (max 181), day grid 18 ms, panel 61 ms, scrim 87 ms, year list 58 ms; iPhone: calendar 108 ms, panel 49 ms).

Recorded differences (not counted as passed; listed by the tests):

* Decision 3 (`menu-*` cases): a docked list stays inside the panel, so the body, panel and list heights and the actions'
  y differ from Chrome's overflowing list; pixels are compared above the list.
* Decision 9 (year-size hook cases, motion fixture): exact centring of the selected year; the reduced-motion fixture
  matches without a record.
* Font availability (exception proposed below): the `cal-locale-ar-EG` / `cal-locale-he-IL` month toggle's width and x on
  Android, the `cal-locale-he-IL` one on iOS.

Android pixels: a clip beyond the emulator's 540 × 1200 dp screen (the 1200 × 900 viewport cases: 64 of 129) is read from an
offscreen recording of the scene (`GraphicsLayer`), which is first compared with the window capture over their common part.

## Known differences

* The docked year pick (`docked-pointer/pick-year+2`) on SwiftUI: the calendar's bloom starts ~127 ms (median over the 82 calendar samples) after Chrome's
  (the list's exit starts a frame or two late and mounting the 42 day md-buttons takes ~85 ms; since states-15 the grid mounts
  hidden under the exiting list). The run passes; its last bloom samples end at least a frame (all three debug runs and the full runs pass every per-frame sample) before the next phase's input.
* The test harness reveals a list entry it is about to click 110 ms before the phase's time (natively the list is shorter
  than Chrome's — decision 3 — so `pick-feb` needs a scroll Chrome does not), and clicks at Chrome's time.
* iOS: no iOS-only difference beyond the recorded ones. The entry-mode toggle tap (the overlay's own preferences were not read again after entry → calendar; `applyInputMode` now bumps `rt.settle`) and the reduced-motion commit-on-select close pass in the states runs of both devices.

## Laboratory (gate 3)

Hooks: 40 appearance hooks (`date-picker-appearance.js`), retained in-place updates, `show()` / `hide()` / constraint-validation controller methods on both live hosts, 28 SwiftUI + 28 Compose copyable examples (Swift typecheck 0; Compose androidTest compile with the examples: BUILD SUCCESSFUL). Node studio suite 878 pass / 0 fail on the refreshed tree (baseline 872 / 0), `date-picker-integration.test.mjs` 6/6, SwiftUI live host 42/42 (1-3-...-009), Android host tests `LivePreviewDatePickerHostTest` 2/2 and `LivePreviewPickersHostTest` 2/2 (1-3-...-A009). The shared appearance guide samples a numeric `iconSize` (md-badge); the date picker's `icon-size` hook is CSS text, so the guide gets a per-tag sample (`20px`).

## iOS simulator execution (gate 6)

iPhone 17 Pro and iPad Pro 11-inch (M5), iOS 26.3: the full paint and states suites above; each simulator is shut down when its job exits.

**Accessibility (tools/ax):** run with `tools/ax --tags md-date-picker` (closed, open, docked; `locale: en-US` pinned in the cases). **0 open findings on Web-vs-macOS, iOS and Android** (story 1-5, jobs `1-5-md-date-picker-accessibility-009-ax-apple-final2` and `-A005-ax-android-final2`; macOS 7 accepted, iOS 5, Android 95; story 1-3 had 26 / 99 / 185 open). Fixed in the renderers: the Web md-tooltip text is now the buttons' description on Apple (`awcTooltipDescription`: AXHelp / accessibilityHint); the weekday header is hidden as on the Web (aria-hidden); the dialog is named by the picker's label (macOS AXGroup, iOS modal container, Android pane title); the day grid is a table (macOS AXTable / AXRow / AXCell, cropped to the visible clip, iOS data table, Android collection) so the open picker is read in Web order (weekday header, grid, action buttons); the month / year toggles expose expanded / collapsed on Android (opt-in `exposeExpanded` on the shared NativeButton). Reviewed conventions in `expectations.mjs`: macOS has no AXDialog / modal state for an in-window layer (as md-time-picker); iOS lists the dialog name as the container label, not as text; Android has no tooltip text and no described-by relation (as md-tooltip, md-text-field); Android touch targets: the 40 px day cells and icon buttons keep the source geometry (every target is above the WCAG 2.5.8 minimum of 24, the 48 dp guideline would change the layout paint parity verifies); Tab order: the natives trap Tab in the modal and start at the focused day, so the walk is the same cyclic order as the Web's (the Web case starts behind the scrim at the trigger); the Web's docked panel intermittently omits its `display: contents` role=row weeks from Chrome's tree (4 of 5 captures), so the native rows (always exposed) are an accepted `extra` there. Tool change: `compare.mjs` `cellStop` (a gridcell's content is not compared inside the cell, like `rowStop`). The live host's docked Tab now flows through document order (the `NSApp.sendEvent` key command is dropped when the preview window is not key). The `base-1-3` rows in the summary keep the story 1-3 baseline.

## Exception proposed (reviewer acceptance pending): fallback fonts of Arabic and Hebrew labels

* **Source behaviour:** the month toggle (an md-button label, Roboto 500 14 px) shows the month and year in the picker's
  locale. Roboto has no Arabic or Hebrew glyphs, so Chrome on macOS draws those runs with the system fallback faces:
  Geeza Pro Bold for Arabic (no letter-spacing on the cursive run) and Lucida Grande Bold for Hebrew (measured with
  `n4-lab/dp/scripts/font-probe.swift`, n4-063).
* **Affected platform and API:** Android (Compose text, the system font set: Noto Naskh Arabic / Noto Sans Hebrew) for
  `ar-*` and `he-*` locales; iOS (Core Text, no Lucida Grande: Arial Hebrew Bold is used) for `he-*` locales. macOS and
  iOS Arabic match Chrome (`AWCNativeFonts.fallbackFaces`).
* **Technical reason:** Geeza Pro and Lucida Grande ship with macOS only and are licensed with it; they cannot be bundled.
* **User impact:** the month toggle's text is drawn in the platform's own face for that script; its width differs
  (Android: ar-EG 105.5 vs 120.5 px, he-IL 106.5 vs 111.8 px; iOS he-IL 107.1 vs 111.8 px), which moves the toggle's
  inline edge by the same amount. Height, baseline, colours, the neighbouring chevrons and the rest of the dialog are unchanged.
* **Tested native equivalent:** the paint tests check every other box and all flat pixels of those cases and record only the
  month toggle's x and width (`font availability`), never counting them as passed.
* **Evidence:** `outputs/native-parity/md-date-picker/native-android/paint-11-evidence.log` and `paint-11r-evidence.log`,
  `native-ios/ios-p8-NativeDatePickerPaintIntegration-console.log` and `ipad-p1-NativeDatePickerPaintIntegration-console.log`.
* **Reviewer / acceptance:** pending (gate 7).

## Decisions (autonomous, 2026-10-31 / 11-12, reversible)

Decisions 1–9 are recorded in the source review (variant mapping, `mdViewChange` for keys, docked lists inside the panel,
`mdSelected` timing, event counts, focus targets, empty locale, Chrome's ICU patterns, exact year centring). Added
2026-11-12: the ripple beat before a docked pick applies is md-ripple's 200 ms bound from the click; the motion hooks drive
the keyframes while the exits keep the source's fixed 200 ms; `isDateDisabled` lives on the controller.
