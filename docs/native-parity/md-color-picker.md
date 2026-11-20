# Color picker parity checkpoint (md-color-picker)

Status: dedicated SwiftUI and Compose renderers replace the generic adapters in
production dispatch (`AWCNativeView` and `AWCComponent`). Public appearance APIs
exist on both platforms. The macOS, iOS-simulator and Android runtime checks below run
against trusted-input Chrome 153 oracles captured on the Mac. Source review:
[md-color-picker-source-review.md](md-color-picker-source-review.md); plan:
[md-color-picker-native-plan.md](md-color-picker-native-plan.md).

## Source (gate 1)

The Gate-1 review fixed six defects test-first and mirrored them into
`packages/core/src` (CP1–CP6: controlled echo, short-hex preset selection, focus
return on close, dimmed disabled presets, Escape inside an `md-dialog`, forced
colours). Re-check (2026-10-29):

* The Mac recapture (Chrome 153, DPR 1, trusted CDP input) in
  `outputs/native-parity/md-color-picker/web-oracle-mac/` replaces the provisional
  Linux capture. The differences between the two are input timing (drag paths are
  one move per frame at different frame rates; events land 33 vs 50 ms apart), ids
  and Chrome 153's 3 px focus outline; none is a component change. The natives
  replay the Mac capture.
* New finding, recorded and not changed: `dir="rtl"` on the host alone flips the
  plate, hue and alpha gradients (`:host([dir="rtl"])`) while layout and pointer
  mapping stay LTR (`:host { direction: inherit }`), so the gradient runs against
  the pointer. The natives follow the layout direction; the paint comparison masks
  the gradient areas of that one case (`cp-*-hostdir-*`). Decision below.

## Browser reference (gate 2)

`fi-lab/cp/convert.py` condenses the Mac capture into the shared fixtures (byte-
identical on both platforms):

* Paint: 165 cases (light/dark, LTR/RTL, inline/popover, states, densities,
  focus, hover, hooks, locales), one screenshot each.
* States: 23 runs, 179 phases, 2,070 per-frame samples (plate/hue/alpha thumb
  transforms, preset transforms, popover opacity/transform, value, hex, channels,
  focus) and the md* event sequence.
* Reduced motion: the same 23 runs under `prefers-reduced-motion: reduce`.

## Renderers and APIs (gate 4)

* Swift: `NativeColorPicker.swift` (`AWCNativeColorPicker`, the runtime with the
  part handles, the pop-in and preset effects), `ColorPickerModel.swift`
  (`AWCHsva`, `AWCColorMath`, the `en`/`ar`/`ro` labels, `AWCColorPickerAppearance`
  and `awcColorPickerAppearance(_:for:)`), `ColorPickerBridges.swift` (AppKit and
  UIKit focus/key/accessibility surfaces for the plate, tracks and presets, the
  outside-press observer). `AWCNativeView` routes `md-color-picker` to
  `nativeColorPicker`.
* Compose: `NativeColorPicker.kt` (`AWCHsva`, `AWCColorMath`, labels,
  `AWCColorPickerAppearance`, the appearance / reduced-motion / inspection scopes,
  `AWCColorPickerScope` for outside presses, the runtime). `AWCComponent`
  dispatches `"md-color-picker" -> NativeColorPicker(p, controlEvent, content)`.
* Both platforms:
  * **Model:** HSV with the source's parse/format rules (3/4/6/8-digit hex with or
    without `#`, `rgb[a]()`, `hsl[a]()`; uppercase hex with the alpha byte whenever
    alpha < 1).
  * **Events:** `mdInput` only when the formatted string changes, `mdChange` on
    commit (release, key step, hex blur/Enter, channel change, preset), also without
    a change as in the source; `mdOpenChange` on every open transition.
  * **Keys:** plate ±1/±10, Home/End, PageUp/PageDown; hue ±1/±15 wrapping; alpha
    ±0.01/±0.1; arrows mirrored in RTL; Escape closes the popover from the trigger
    or any part and is consumed inside a modal (CP5).
  * **Popover:** consumer trigger, pop-in (scale 0.8 → 1, translateY −8 → 0, fade,
    300 ms emphasized-decelerate, per-function interpolation), focus returns to the
    trigger when it closes with focus inside, outside press only with
    `dismissOnOutsideClick`.
  * **Motion:** thumb press 200 ms, preset spring 350 ms, preview fade; the paint
    of a state change lands one frame after the input as in the source (Stencil
    renders state in the next animation frame).

## Results (gate 5)

| Platform | Paint (13685 checks) | Interaction states (20950 checks) |
|---|---|---|
| macOS SwiftUI (Mac, AWCUI test runner) | 13685/13685 | 20950/20950 |
| iOS 26.3.1 simulator, iPhone 17 Pro | 13685/13685 | 20947/20950; 20949/20950 with the one-step input led by one more frame |
| iOS 26.3.1 simulator, iPad Pro 11-inch | 13685/13685 | 20945/20950; 20948/20950 likewise |
| iOS 18.6 simulator, iPhone 16 Pro | 13685/13685 | 20943/20950; 20948/20950 likewise |
| Android emulator (API 36, emulator-5556), Compose | 13520/13520 | interaction ALL PASS (A021; Kotlin r11 A037, r12 A038) |

Accessibility revision (r14): macOS paint 13,685/13,685 and states 20,950/20,950 (fi-739); iOS 26.3 iPhone paint 13,685/13,685,
states 20,943/20,950 (the one-frame touch-latency class below, fi-740); Android interaction and parity pass (A037 / A038).

The fixtures are byte-identical on both platforms (`colorpicker-web-*`, `ColorPickerWeb*`). Each paint case checks the host,
every part box, the inputs (box and value) and every flat pixel of the clip; each states run replays Chrome's input at its
recorded time and checks the md* events with values, the per-phase end state and every per-frame motion sample.

## Known differences

* iOS interaction residuals (≤ 7 of 20950): one-step pointer inputs whose transition starts one frame later than Chrome's
  under synthesized touches (plate thumb press, the popover's first pop-in frame, one preset press). Leading those inputs
  by one more frame (`AWC_CP_STATE_LATENCY=33`, `AWC_CP_POP_LATENCY=21`) leaves 1–2 per device: the latency is the
  simulator's touch delivery, not the component's timing. Open (harness), not waived.
* Host-only `dir="rtl"` (Gate-1 finding): Chrome flips the gradients but keeps LTR layout and pointer mapping; the
  natives follow the layout direction (decision below); the paint comparison masks the gradient areas of that one case.

## Laboratory (gate 3)

Installed with md-time-picker (`fi-lab/lab/pickers/lab-patch-pickers.py`, see [md-time-picker.md](md-time-picker.md#laboratory-gate-3)):

* **Appearance module** (`picker-appearance.js`): the 11 `--md-color-picker-*` hooks (the popover elevation as canonical CSS
  shadow text), normalisation, CSS, native values (`AWCColorPickerAppearance(values:)`), the Swift modifier and snippets.
* **Retained updates** of every source property with validation on Studio, the SwiftUI host and Android.
* **Methods**: `AWCColorPickerController` (`ColorPickerController.swift`, `AWCColorPickerController.kt`;
  `.awcColorPickerController(_:for:)` / `AWCColorPickerControllerScope`) with `show()` and `close()` for the popover
  variant (a disabled picker ignores `show()`, as the source).
* **Evidence**: native-playground suite 813/813; SwiftUI live host `test-live-pickers.mjs` 35/35 (inline hooks; popover
  methods through `mdOpenChange`; rejections); Android `LivePreviewPickersHostTest` 2/2.

## iOS simulator execution (gate 6)

See the results table: paint passes on all three simulators; the interaction residuals are listed under Known differences.

**Accessibility (tools/ax**, inline and disabled, macOS / iOS 26.3 iPad / Android API 36;
`outputs/native-parity/_ax-fi-pickers3/md-color-picker/report.md`): **pass on every platform**, with reviewed expectations.
Fixed for it (r14 / bridges r14 / Kotlin r12): the inputs are named with the labels' uppercase transform as Chrome does
("HEX"); a disabled picker's UIKit controls carry the not-enabled trait; a read-only or disabled AppKit input stays a text
field (md-text-field, with md-time-picker); Compose: the hue / alpha tracks are sliders (`setProgress`, also when disabled,
the value as the source rounds it), the preview is an image, the presets are a selectable group (options). Reviewed
conventions (`tools/ax/expectations.mjs`): R / G / B are editable number fields (Chrome's spin buttons, their digits as
static text); the plate (Web `role="application"`, not compared as an element) is an adjustable element natively; the
presets listbox is an AXGroup on macOS; a disabled picker disables its container and preview too; the Compose container /
plate labels read as text; iOS hardware-keyboard Tab starts at the first text input.

## Decisions (autonomous, 2026-10-27, reversible)

* Host-only `dir="rtl"`: the natives follow the layout direction for the gradients
  too (consistent with pointer mapping); the source behaviour is recorded as a
  Gate-1 finding, not reproduced.
* Paint latency: the natives delay the paint of interaction state by one frame
  (SwiftUI animation delay) to match the source's render-in-next-frame; Compose
  already paints two frames after input.
* Escape inside a modal: `AWCModalSession.escape()` asks focused content first
  (escape claims); the picker claims Escape while its popover is open and focus is
  inside it or on its trigger (CP5). `AWCPopupTarget.escape` lets the slotted
  trigger close the popover.
* iOS input latency: the states test leads one-step inputs by Chrome's render latency (17 ms state, 5 ms pop-in); on the
  simulator the residual frame is synthesized-touch delivery, kept visible as a known difference rather than tuned per
  device.
* Accessibility conventions (2026-10-31, tools/ax expectations, reviewed): editable number fields for R / G / B, the plate as
  an adjustable element, the presets group on macOS, the subtree-wide disabled state, Compose labels as text, iOS Tab start.
* The Android interaction test retries a field action once when the field was recomposed into a new node between lookup and
  action (fi-907 under load: "the node is no longer in the tree").

## Story 6-2 audit readiness (2026-11-18)

Canonical (shim v5 `30db5861`, install 115 cpshift, 110 modenextframe+tabkeyat+releaseclock, 101 labels, 009 tap-shift). Evidence is in the story record `6-2-pickers-audit-readiness`; every run is a whole-suite run, load written in each job log.

- macOS paint 13685/13685, states 20948-20950 of 20950 over 3 runs; Android 6/6 and tools/ax clean (2 cases).
- iOS states after install 115 (job 116): iPhone 26.3 20948 and 20947, iPad 26.3 20949, iOS 18.6 20949 of 20950 (before the install: 20947 / 20940 / 20941). Open: drag-plate thumb press t=100/133 (iPhone, 2 of 2 runs, one check each), popover click-trigger-open t=133 / Space-on-trigger / show() (1 miss in 3 of 4 runs, different case each time). Findings S62-09 to S62-12 in `work/audit/DEFECTS.md`.
