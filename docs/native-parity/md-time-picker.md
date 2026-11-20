# Time picker parity checkpoint (md-time-picker)

Status: dedicated SwiftUI and Compose renderers replace the shared `temporalPicker` / `PickerComponent` adapters in
production dispatch (`AWCNativeView` and `AWCComponent`; `md-date-picker` keeps the shared adapter). Public appearance and
method APIs exist on both platforms. The macOS, iOS-simulator and Android runtime checks below run against trusted-input
Chrome 153 oracles captured on the Mac. Source review: [md-time-picker-source-review.md](md-time-picker-source-review.md);
plan: [md-time-picker-native-plan.md](md-time-picker-native-plan.md).

## Source (gate 1)

The Gate-1 review found no component defect (it fixed an environment-suite race in the test utility). Re-check
(2026-10-30):

* The Mac recapture (Chrome 153, DPR 1, trusted CDP input) in `outputs/native-parity/md-time-picker/web-oracle-mac/`
  replaces the provisional cloud capture; the natives replay the Mac capture.
* Open items of the review, settled for the natives by copying the source: `minute-step` also sets the ArrowUp /
  ArrowDown step of the minute tile (as Chrome does; the readme says it snaps the dial only); a full hour buffer does not
  auto-advance to the minutes (Android's Compose `TimeInput` would; the natives do not). The twelve stylesheet hooks the
  readme does not document are honoured natively (they are source hooks: Chrome paints them).
* Finding recorded, not changed: `trigger-icon-size` is applied to the slotted glyph, but md-text-field's own leading-icon
  size wins in Chrome, so the hook has no visible effect; the natives match (the field's icon size is used).

## Browser reference (gate 2)

`fi-lab/tp/convert.py` condenses the Mac capture into the shared fixtures (byte-identical on both platforms,
`timepicker-web-*` / `TimePickerWeb*`):

* Paint: 96 cases (the trigger: 12h / 24h × empty / value, dark, RTL, error, supporting, disabled, required, reserve
  space, label, densities −1…−4; the dial dialog: 12h / 24h × theme × direction, inner ring, AM, empty, horizontal period,
  minute step, min / max, headline, translated labels, densities, landscape, the responsive policy on two viewports; the
  input dialog; every hook alone and together; the undocumented hooks), one screenshot each.
* States: 18 runs, 106 phases, 1,840 per-frame samples (dialog unfold, scrim, mode bloom, hand rotation and length, period
  colours), 152 md* events with details: dial drags (12h LTR / RTL / dark, 24h inner and outer ring, minute step with the
  wrap across 0), taps, the input variant's keyboard (digits, arrows, Tab / Shift+Tab, the period radio group, Enter),
  invalid typing, the mode toggle, dismissal (Escape, scrim, Cancel), the focus trap, form bounds (required, an overnight
  min / max window, reset), show() / hide() with a hidden trigger, the landscape dialog and the responsive policy.
* Reduced motion: the same 18 runs under `prefers-reduced-motion: reduce`.

## Renderers and APIs (gate 4)

* Swift: `NativeTimePicker.swift` (`AWCNativeTimePicker`: the read-only trigger field, the dialog presented in the
  `AWCModalScope` layer — a `.sheet` outside one — with the scrim, focus trap and Escape, the dial, the hour / minute tiles,
  the period toggle and the footer's md-icon-button / md-buttons), `TimePickerModel.swift` (`AWCTimePickerRuntime`,
  `AWCTimeMath`, labels, `AWCTimePickerAppearance` — a hook map — with `awcTimePickerAppearance(_:for:)` and
  `init(values:)`, the Oklab colour interpolation, `AWCTimePickerController`, `AWCTimePickerValidity`). Shared edits
  (`tp-swift.json`): the dispatch, AppKit click / UIKit tap activation of read-only fields, `AWCFieldFocusTarget` (the
  trigger's focus handle) and the suite list.
* Compose: `NativeTimePicker.kt` (the renderer in its own modal layer, `AWCTimePickerAppearance` with `fromValues`, the
  appearance / controller / inspection scopes, the runtime, `AWCTimeMath`); `AWCComponent` dispatches
  `"md-time-picker" -> NativeTimePicker(p, controlEvent)`.
* Both platforms:
  * **Events:** `mdOpen` / `mdClose`, `mdCancel` (Cancel, Escape, scrim), `mdInput` / `mdChange` with the source's time
    record (`value`, `hours`, `minutes`, `period`, `iso`, `isoDateTime`, `date`), `mdModeChange`, `mdValidityChange`
    after the first evaluation.
  * **Keys:** digits into the focused tile (selected on keyboard focus), ArrowUp / ArrowDown by 1 or `minute-step`,
    the period radio group, Tab / Shift+Tab trapped in the dialog, Enter commits, Escape cancels; unused arrows stay in
    the dialog.
  * **Dial:** the hour / minute hand-over on release, the 24h inner ring, minute-step rounding with the wrap across 0, the
    hand turning the short way.
  * **Focus:** initial focus on the hour tile, return to the trigger on close (also when the dialog was opened from it).
  * **Motion:** dialog unfold (`dialog-enter-duration`, emphasized-decelerate), scrim 150 ms, mode bloom
    (`mode-swap-duration`), hand 200 ms, colour transitions 150 ms interpolated as Chrome does (premultiplied sRGB between
    two legacy colours, premultiplied Oklab when a `color-mix()` result is involved); reduced motion removes them.
  * **Methods:** `AWCTimePickerController` (`.awcTimePickerController(_:for:)` / `AWCTimePickerControllerScope`):
    `show()`, `hide()` (Cancel: `mdCancel` then `mdClose`), `checkValidity()`, `reportValidity()` (shows the message as
    the trigger's error text and focuses the trigger — the source's inline validation presenter), `getValidity()`.

## Results (gate 5)

| Platform | Paint (10726 checks; Compose 10630) | Interaction states (16992 checks) |
|---|---|---|
| macOS SwiftUI (Mac, AWCUI test runner) | 10726/10726 | 16991/16992 (canonical, fi-912); test r14 checks 15551: 15551/15551 (fi-758, screen unlocked) |
| iOS 26.3.1 simulator, iPhone 17 Pro | 10726/10726 | 15526/15551 timed from the delivered input, no leads (test r14; queue-timed 15482) |
| iOS 26.3.1 simulator, iPad Pro 11-inch | 10726/10726 | 15547/15551 (delivered-input timing; same-session baseline 15535 / 15537, fi-760) |
| iOS 18.6 simulator, iPhone 16 Pro | 10726/10726 | 15525/15551 (delivered-input timing) |
| Android emulator (API 36, emulator-5556), Compose | 10630/10630 | 16992/16992 (A033, A034) |

Each paint case checks the host, every part box (dial numbers by text, the rotated hand's box), the tiles' values, the
focused part and every flat pixel of the clip; each states run replays Chrome's input at its recorded time and checks the
md* events with every detail, the per-phase end state (value, open, tiles, period, active number, dial mode, hand target
and length, status text, focused part) and every per-frame motion sample.

## Known differences

* iOS timing (test r14, fork di's advice): a synthesized touch or key reaches the app when UIKit delivers it (one touch phase
  per frame; SwiftUI acts within that delivery). The test pairs each phase's first and last queued input with the harness's
  delivery stamps (`AWCShimTouch.deliveredAt`) and compares a Chrome sample with the native frames at its time plus that
  delivery delay; the env leads are gone. The simulator's accessibility runtime is set off before every run (fork d2: it
  changes UIKit's accessibility bundles; fi's harness wrapper prints the state). The residuals left are listed per run in
  `outputs/native-parity/_ios/fi/console-tp18-*.log`; open, not waived.
* Mode switch (closed): Chrome's `inputArea` and `dialWrap` selectors resolve to the one blooming wrapper while the modes swap
  (equal samples); the test compared the outgoing native area with it. It now compares the incoming mode's area (test r12+).
* macOS with the screen locked (fi-745 / fi-748): the application is never active (every press "inactive"); dial-tap hand
  samples miss by a frame (3-12 of 15551). Unlocked (fi-917): 15550/15551, one dial-tap hand sample (see the iOS timing item).
* macOS runner under load (fixed in the test, r10): while another process holds activation, `NSWindow.sendEvent` passes a
  synthesized press to the hit view only if it accepts first mouse; SwiftUI's hosting view does not, so dial taps, drags and
  scrim presses were dropped (fi-736: 16,198/16,992 with a simulator booting in parallel). The diagnostic run that
  deactivates the application before each press drops them without the fix (880/1,008) and not with it (1,007/1,008); the
  test hosts the picker in a view that accepts first mouse and prints how many presses happened while inactive. Reported to
  fork di (REQUESTS.md).
* Text selection: the select-all highlight of a focused tile differs from Chrome's on AppKit and Compose; the paint test
  masks the focused tile's text box (decision).
* iPad (2× scale) pixel snapping: part boxes within 0.85 pt instead of 0.6 (decision).
* AppKit drew an unfocused field's text higher than Chrome (≈ 6 px at 16 px, ≈ 23 px in the 45 px tiles); reported to the
  md-text-field owner (n3), who fixed it in `FieldTextInput.swift` (the cell draws its line as the field editor lays it out).

## Laboratory (gate 3)

`fi-lab/lab/pickers` (`lab-patch-pickers.py`, installed with the renderers) integrates both pickers into the Laboratory:

* **Appearance module** (`picker-appearance.js`, registered in `component-appearance.js`): the 81 `--md-time-picker-*`
  hooks as CSS text (lengths, colours, `cubic-bezier()` easings with x in 0…1, durations, the hand length as a percentage),
  with normalisation, CSS output, the native values (`AWCTimePickerAppearance(values:)` / `fromValues`, keys by hook name in
  camel or kebab case), the Swift modifier and the hook-map snippet.
* **Retained updates** of every source property with validation (`validPickerUpdate` in Studio, `validatePickerPatch` on
  the SwiftUI host, `parseLivePreviewPickerUpdate` on Android; an invalid patch is rejected and leaves the picker as it was).
* **Methods** through `AWCTimePickerController` on both hosts: `show()`, `hide()`, `checkValidity()`, `reportValidity()`
  and `getValidity()`, results `{ valid, validationMessage, flags }`; declarative examples in Swift wrap the picker in
  `AWCModalScope` (the dialog's layer).
* **Viewport**: the dialog presents in the Laboratory's overlay viewport (as md-dialog), the picker 24 px from its corner.
* **Evidence** (lab tree = canonical + this install): native-playground suite 813/813 (807 before, +6 picker tests);
  SwiftUI live host `test-live-pickers.mjs` 35/35 (the dial-size hook, dialog centring, show / hide events, validity
  results, updates and rejections; colour-picker hooks and popover methods); Android `LivePreviewPickersHostTest` 2/2
  (fi-A036, fi-A037); live tooltip / snackbar / text-field hosts unchanged. The modal host's `test-live-modal.mjs` passes
  in isolation (2/2, and on a baseline build without this patch) and failed under machine load in two runs (a bottom
  sheet still present ~6 s after its mdClose); reported to the modal owner as an open finding (fi-lab/REQUESTS.md).

## iOS simulator execution (gate 6)

Paint passes on all three simulators; the interaction residuals are listed under Known differences.

**Accessibility (tools/ax**, 3 cases — closed, the open dial dialog, the input dialog — on macOS, iOS 26.3 iPad, Android
API 36; report `outputs/native-parity/_ax-fi-pickers3/md-time-picker/report.md`): open, input and the Android closed case
pass. The closed case's trigger exposed its hidden leading glyph as the text "schedule"; the trigger is now an explicit
accessibility container (`.accessibilityElement(children: .contain)`, NativeTimePicker r12), which removes it on iOS (fi-746:
the container gesture was not the cause). The macOS recheck passes too (fi-917 macOS capture, fi-920 iOS capture on canonical: 0 open findings on macOS,
iOS and Android). Fixed on the way: the read-only trigger was AppKit static text; it is now AXTextField (n3's `FieldTextInput.swift`
reports every input as a text field or combo box); tools/ax's Web page assigned `open` before
`variant` (the dial case opened in the input mode) and the macOS host's Tab skipped the modal scope (fixed in the lab patch).
Reviewed conventions (`tools/ax/expectations.mjs`): the hour / minute spin buttons are editable text fields with their
digits as values; Chrome's empty outline `<legend>`; the dialog and the period radio group as AXGroups on macOS (as
md-dialog); Compose's selectable group reports AM / PM as options; the focus walk is the Web cycle rotated by one stop
(decision below).

## Decisions (autonomous, 2026-10-30 / 31, reversible)

* Colour transitions follow Chrome's interpolation spaces (sRGB for two legacy colours, Oklab otherwise), so the period
  hover tint (`color-mix()` in `background-color`) and the active fills match frame by frame.
* Minute-step keyboard semantics and no auto-advance: as the source (gate-1 open items).
* `trigger-icon-size`: no visible effect, as in Chrome.
* Input timing in the states tests: one-step inputs fire at Chrome's animation start minus the native latency
  (17 ms state / 5 ms open on SwiftUI, 32 / 44 ms on Compose, a dial press / release at Chrome's own restyle frames);
  the macOS test window reports key so a runner that lost app activation under load still receives its presses.
* Open on first render: the natives focus the hour field when the dialog opens, also when `open` is set before the first
  render, as the source does for the trigger and `show()`; the source leaves focus outside when `open` is set at load
  (tools/ax: Chrome's first Tab lands on the hour field). The cyclic focus order is identical.
* Accessibility conventions (tools/ax expectations, reviewed): editable number fields for the spin buttons; the outline
  legend; AXGroup for the dialog and the period group on macOS; options for AM / PM on Compose.
* md-text-field reports the vertical arrows only to inputs with `navigationKeys` (n3, 2026-10-31): the hour / minute tiles
  set it (fi-911); the macOS states tests post and dequeue each key so it is the application's current event, as a hardware
  key is (fi-912).
* A transition the source starts in its input handler (the dial hand) begins at the begin time of the frame in progress,
  as Chrome's does: the frame its press arrived in (TimePickerModel r13, NativeTimePicker r14).
* Shared md-text-field edits (tp-swift.json r7, rebased on n3's 2026-10-31 `FieldTextInput.swift`): the read-only trigger's
  activation (its own field editor sees Enter / Space; a click opens), the field-focus target and the activation environment.

## Story 6-2 audit readiness (2026-11-18)

Canonical (shim v5 `30db5861`, install 115 cpshift, 110 modenextframe+tabkeyat+releaseclock, 101 labels, 009 tap-shift). Evidence is in the story record `6-2-pickers-audit-readiness`; every run is a whole-suite run, load written in each job log.

- macOS paint 11124/11124 (incl. 7 label cases), states 15549-15551 of 15551 over 3 runs (misses 0-2, load dependent); Android 6/6 instrumented classes and 2/2 canonical picker classes; tools/ax clean (3 cases).
- iOS states (jobs 111): iPhone 26.3 15544 and 15543, iPad 26.3 15546, iOS 18.6 15539 of 15551. Open misses, not accepted as a residual: tap-hour-7 t=1100 (2 of 4 iOS runs), dismiss-escape tap-hour-5 (3 of 4), focus-trap-dial Tab/Shift+Tab hand (3 of 4), drag-inner-14-to-17 (2 of 4), dial-drag am period-am (4 of 4, 1 sample), and the story-9-23 class: open t=266 (row 35), mode-toggle to-input/to-dial (toggle's input-hour becomeFirstResponder inside the motion, KNOWN-CAUSES row 35 / story 9-23). All are findings S62-01 to S62-08 in `work/audit/DEFECTS.md`.

### Exception proposal: period-am-ripple / period-pm-ripple (pending gate-7 review, story 7-3)

# Exception proposal (pending gate-7 review, story 7-3 reviewer decides): md-time-picker parts `period-am-ripple`, `period-pm-ripple`
Status: PROPOSAL, not accepted. Written by story 6-2, session 1 (2026-11-17).
- Source behaviour: each period button (AM, PM) contains an `<md-ripple part="period-am-ripple|period-pm-ripple" aria-hidden="true">`. The host element is `display: contents`.
- Chrome 153 measurement (Mac, outputs/native-parity/md-time-picker/web-oracle-mac/paint.json, case dial-12h-light-ltr and every dial/input 12h case): part rect {x:0,y:0,width:0,height:0}, display "contents", aria-hidden "true". The part has no box of its own; the ripple surface and wave are drawn by md-ripple's inner shadow elements clipped to the button.
- Affected platforms / API: SwiftUI (macOS, iOS) and Compose: a typed part node with a geometry/style contract cannot be compared, because Chrome reports no box to compare against.
- Technical reason: nothing to measure; a native inspect node would assert an empty rect and prove nothing.
- User impact: none visible; the box is empty and aria-hidden. The visible effect (press wave and hover/focus/press state layer on the period button) is drawn on the period button.
- Tested native equivalent (state of 2026-11-17, session 10): `NativeTimePickerStatesIntegration` compares the period buttons' background (state layer + checked tone, `period.amBg` / `period.pmBg`) against Chrome's frame samples through the `am` press phase of the three `dial-drag-12h-*` runs (fixture `timepicker-web-states.json`; Swift line ~396, Compose twin in NativeTimePickerInteractionTest). NOT covered: the press wave ink itself (the oracle records no animation target for it), and a `pm` press phase (no run presses PM). Open to close the gap: add a `pm` press phase and wave sampling to tp-states.html (oracle-src), capture on the Mac, convert, add Swift + Compose checks, one mutation run each. Until then the exception stays a proposal with this stated gap.
- Evidence link: paint.json above; Swift paint test skip: NativeTimePickerPaintIntegration.swift line ~165.
- Reviewer / acceptance: pending gate-7 review (story 7-3).
