# iOS parity harness (gate 6)

The iOS lane replays the **same** oracle-based fixtures as macOS (`packages/native-ios/Tests/Native*Integration.swift`)
inside an iOS Simulator app. Comparison code, tolerances and Chrome oracles are untouched: each fixture is compiled
for the simulator through a mechanical source transform plus a small AppKit compatibility shim, so a check that passes
on macOS asserts exactly the same thing on iOS.

Status, figures and fixes: see [Results](#results) and [iOS fixes](#ios-fixes). Evidence: `outputs/native-parity/_ios/fi/`
(the gate-6 runs: `run-<label>.log` / `console-<label>.log` per suite, `summary-<prefix>.json` per run, probe output and
native captures) and the earlier `outputs/native-parity/_ios/` checkpoint.

## Architecture

```
apps/native-ios-parity/
  scripts/build-awcui.sh   AWCUI → static library + testable module for the simulator (swiftc, -enable-testing, -Onone)
  scripts/transform.py     macOS fixture → iOS source (mechanical substitutions only, see below)
  scripts/run-fixture.sh   build fixture app → install → launch on a simulator → console + outputs
  scripts/summarize.py     console logs → checkpoint-suites.json (counts, failure kinds, harness notes)
  Shim/AppKitShim.swift    the AppKit surface the fixtures use, implemented with UIKit
  Shim/TouchSynthesis.swift in-process HID touch/key injection
  Host/HarnessApp.swift    simulator host: starts the fixture from a run-loop timer, warms HID, exits with it
  Probe/                   harness self-tests (capture modes, touch/key delivery, text metrics, reorder diagnosis)
```

**Build.** `build-awcui.sh` compiles every `Sources/AWCUI/**/*.swift` with `swiftc -emit-library -static
-enable-testing -Onone` for `arm64-apple-ios17.0-simulator` (rebuilt only when a source is newer; ~30 s).
`Bundle.module` is stubbed to the app bundle; the Roboto / Material Symbols files are copied to
`AWCParity.app/AWCUI_AWCUI.bundle/Fonts`, the path `AWCNativeFonts` already probes first. Each fixture is linked with the
shim and host into `AWCParity.app` (bundle id `dev.awc.native.parity`, `UILaunchScreen` so the app runs at native
resolution), ad-hoc signed, installed from `/tmp` (CoreSimulator has no TCC grant for `~/Documents`) and launched with
`simctl launch --console`; `KEY=VALUE` arguments become the app environment (`SIMCTL_CHILD_*`). The oracle JSON/PNG the
fixture names are copied into the bundle (`#filePath` is rewritten to the bundle), so the app never reads `~/Documents`.

**Transform (`transform.py`).** `import AppKit` → `import UIKit`; `@main` removed and `AWCParityFixture.run()` calls the
fixture's `main()`; `#filePath` → bundle path; NSAccessibility getters that collide with UIKit properties
(`accessibilityIdentifier()`, `accessibilityLabel()`, …) → `awcShim…()`; `NSViewRepresentable`/`makeNSView` → UIKit
spellings. Nothing else is touched.

**Rendering and capture.** `NSHostingView` is a `UIView` that owns a `UIHostingController` (`safeAreaRegions = []`), and
`NSWindow` is a `UIWindow` subclass of the fixture's content size placed at the screen origin (light user interface
style, white root). Windows larger than the screen are fine: `cacheDisplay(in:)` snapshots with
`drawHierarchy(afterScreenUpdates: true)` into an sRGB (`preferredRange = .standard`) renderer at the device scale
(3× iPhone 17 Pro, 2× iPad Pro 11"), and the fixtures' own `grid()` box-averages k×k device pixels to one CSS pixel —
the same normalisation the macOS run applies to its 2× backing store. `Probe/NativeIOSCaptureProbe.swift` validates this:
sRGB swatches inside and outside the visible screen (up to 1200×900) read back exactly in all three modes, and the
`hierarchy` capture is byte-identical to `tile` (a capture that translates each tile on screen before snapshotting) over
29.16 M channels; `layer` (`CALayer.render`) differs on shadows/antialiasing and is not used.
A *series* of captures (a fixture sampling Chrome's capture window every few milliseconds: a shot that follows the
previous one within 30 ms with no input event in between) takes one shot per display frame and snapshots the committed
screen (`afterScreenUpdates: false`); a shot with no new frame since the previous one first waits for the next frame and
SwiftUI's update for it. Waiting for a fresh screen update on every shot blocked the main thread ~20 ms at 3×, so
SwiftUI's frame-driven content (`TimelineView`, animations) skipped frames and consecutive shots repeated a stale frame
30–50 ms behind its clock (md-button ripple fade timelines d54/d60); in a series every frame of the window is rendered
and captured once (12 ms per shot). Any other shot waits for the screen update, so state set just before it is always
captured; when no display frame has passed since the last input event it first waits for the next frame (SwiftUI applies
state an input set at its next frame update, and Chrome's screenshot after an input includes it). Waiting before every
single shot put animated content one frame ahead of Chrome (md-button click2, md-checkbox glyph scale), so the wait is
tied to the input (`AWC_IOS_CAPTURE_SERIES=off`: every shot waits for the screen update; `AWC_IOS_CAPTURE_FRESH=0` never
waits for a frame, `=1` before every single shot).

**Inspection.** Unchanged: fixtures read `awcNativeInspection(rootID:coordinateSpace:)` exactly as on macOS.

**Interaction.** Fixtures synthesize `NSEvent` mouse and key events; the shim turns them into real input:

* *Touches* — `Shim/TouchSynthesis.swift` builds an IOHIDEvent digitizer record (hand + finger, sender ID,
  `BKSHIDEventSetDigitizerInfo` with the window's CAContext id) and enqueues it with `UIApplication._enqueueHIDEvent:`.
  UIKit then creates the `UITouch`/`UIEvent` itself, exactly as for backboardd input, so SwiftUI gestures, UIKit gesture
  recognizers and `touchesBegan` overrides all see a genuine sequence (`Probe/NativeIOSTouchProbe.swift`: SwiftUI
  `DragGesture` 8/8 phases, `onTapGesture`, UIKit touches, md-switch toggle via its own gesture → mdInput/mdChange).
  `leftMouseDown/Dragged/Up` → began/moved/ended.
* *Keys* — `IOHIDEventCreateKeyboardEvent` (usage page 7) through the same queue: `UIKeyCommand`s and `pressesBegan` fire
  on the first responder (Space toggles a focused md-switch; Escape/Tab reach the modal session). macOS virtual key codes
  map to HID usages; modifiers are pressed around the key; a lone `keyDown` is released after delivery (AppKit does not
  hold keys).
* *Delivery* — the `NSWindow` subclass counts delivered touches/presses. Moves and keys are awaited (≤ 30 ms) like
  AppKit's synchronous `sendEvent`, so UIKit cannot coalesce consecutive moves. A touch-down is not awaited: a press and
  its release sent together (a click) reach UIKit in the same frame and land in one UIKit/SwiftUI update, as Chrome and
  AppKit process a click (no `:active` frame). Every release is awaited, so its effects (click, selection) precede what
  the fixture does or samples next, as on macOS; otherwise the fixture's own pointer model (hover, "up"), which changes
  at once, was rendered and sampled a frame ahead of the click (md-list single select: the previous row unhovered but
  still selected for one frame). UIKit delivers enqueued touches at display-frame boundaries, one phase of a
  touch per frame (enqueue → `UIWindow.sendEvent` 0–17 ms at 59 Hz, longer during a long frame). After delivery,
  SwiftUI gesture callbacks and Button actions run 0.1–4 ms later on iOS 18.6 and 26.3 (`work/fi-lab/probes`:
  `NativeIOSTouchBridgeProbe`, `NativeIOSLatencyProbe`); the late part is SwiftUI's *press* report on iOS 18 (see AWCUI's
  raw-touch press path below).
* *Warm-up* — the first hardware key event costs UIKit ~90 ms of keyboard set-up; the host sends Shift/F13 once before the
  fixture starts (measured latency afterwards: 10–12 ms for every key, 1 ms after touch-up). The host also renders a small
  AWCUI tree once (iOS 18 mounts a process's first hosted platform views frames late), keeps its own backdrop window one
  level below the fixture windows (at the same level the iPad focus system treats every fixture view as occluded), waits
  for the first presentation of each fixture window, and installs AWCUI's Tab entry plus AppKit text-input behaviour (no
  auto-capitalization or correction) on every hosting view.
* *Off-screen points* — HID touches are clipped to the display. When a gesture starts outside the screen the window's
  origin is moved for the gesture (no layout; window coordinates, SwiftUI's global space, stay what the fixture uses) and
  restored at touch-up. Translating the content instead moved it away from its own global geometry.
* *Zero-distance moves* — UIKit delivers no `touchesMoved` without a location change (AppKit delivers every
  `mouseDragged`); such a move is sent as a 0.009 pt move (the smallest delivered move measured is below 0.01 pt),
  alternating in direction; the tightest fixture tolerance is 0.01 (reported as `AWC-IOS-UNSUPPORTED: zero-distance …`).
  A zero-distance move of a press that has not moved since touch-down (a click's `mouseDragged` before `mouseUp`) is a
  no-op for every gesture and is skipped: UIKit delivers one phase of a touch per frame, so it delayed the release by a
  frame (`AWC-IOS-UNSUPPORTED: zero-distance touch move of a stationary press skipped`).
* *Hover* — not available on iPhone (no pointer). Fixtures that model hover through `AWCNativePointerState` keep working;
  synthesized `mouseMoved` events are reported as unsupported and dropped.

Rejected alternatives (measured, see `Probe/`): KIF-style `UITouch` synthesis through `UIApplication.sendEvent` reaches
`touchesBegan` overrides but **no** gesture recognizer (SwiftUI drag/tap 0/2), so it cannot drive SwiftUI. XCUITest
coordinate gestures go through the real input stack too, but each gesture is atomic in the test runner (press →
straight drag → lift) while the fixtures interleave pumps, captures and checks between individual pointer events; they
would also need an Xcode project with a UI-test target. The in-process HID path gives the same real event pipeline
with per-event control, so the harness uses it (simulator only: the SPI is never linked into AWCUI).

## Commands

```sh
# One fixture on the iPhone 17 Pro simulator (3x); KEY=VALUE pairs are the app's environment.
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  apps/native-ios-parity/scripts/run-fixture.sh NativeSwitchPaintIntegration AWC_SWITCH_PAINT_OUTPUT=/tmp/awc-ios/switch.json
# Another device (2x iPad Pro 11"), a capture mode, a harness probe:
AWC_IOS_DEVICE=<udid> apps/native-ios-parity/scripts/run-fixture.sh NativeCardPaintIntegration
AWC_IOS_CAPTURE=tile apps/native-ios-parity/scripts/run-fixture.sh apps/native-ios-parity/Probe/NativeIOSCaptureProbe.swift
# Touch debugging: hit view and screen point of every synthesized touch
apps/native-ios-parity/scripts/run-fixture.sh NativeAccordionPlaceholderIntegration AWC_IOS_TOUCH_DEBUG=1
# Checkpoint from console logs
python3 apps/native-ios-parity/scripts/summarize.py outputs/native-parity/_ios <label> ...
```

Environment: `AWC_IOS_BUILD` (build dir, default `apps/native-ios-parity/.build`), `AWC_IOS_DEVICE` (UDID, default
iPhone 17 Pro `615C2511-…`), `AWC_IOS_CAPTURE` (`hierarchy` | `tile` | `layer`), `AWC_IOS_TOUCH_MODE` (`hid` | `kif`),
`AWC_IOS_TOUCH=off`, `AWC_IOS_CAPTURE_SERIES=off`, `AWC_IOS_CAPTURE_FRESH=0`, `WITH_TIMEOUT` (wrapper for every simctl call), `AWC_IOS_RUN_TIMEOUT`, `AWC_IOS_FIXTURES` (extra
oracle entries to bundle). Runner jobs wrap it as `ios-fix/harness.sh <label> <fixture> [KEY=VALUE…]`, which also
copies the console and `/tmp/awc-ios/out/<label>` into `outputs/native-parity/_ios/`. The gate-6 runs use
`work/fi-lab/harness.sh <label> <fixture> [KEY=VALUE…]` (`FI_TREE`, `FI_BUILD`, `FI_STAGE`, `AWC_IOS_DEVICE` select
the source tree, build directory, staging directory and simulator; results in `outputs/native-parity/_ios/fi/`),
`work/fi-lab/genjobs.py` (every fixture, with its extra sources and arguments) and `work/fi-lab/summary.py`.

The AWCUI simulator compile itself: `xcodebuild -scheme AWCUI -destination 'generic/platform=iOS Simulator' build`
in `packages/native-ios` (clean), and `xcodebuild -project apps/native-ios-playground/AWCPlayground.xcodeproj
-scheme AWCPlayground -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` (clean).

## Results

Gate-6 run of every native-done component, 2026-10-29 / 30, on one frozen tree (`work/fi-tree-r8` = canonical AWCUI + harness
with the fi patches 41–46, installed by fi-710). Xcode 26.3 (17C529). Simulators: iPhone 17 Pro (402×874 pt, 3×) and iPad Pro
11-inch M5 (834×1210 pt, 2×) on the iOS 26.3.1 runtime, iPhone 16 Pro (3×) on the iOS 18.6 runtime, all three running in
parallel. Counts are each fixture's own `passed/total` (fixtures that sample per rendered frame have device-dependent totals).
Bold = every check passed. Logs: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log`, per-run
`summary-<prefix>.json` (`r8i-` iPhone, `r8p-` iPad, `r8o-` iOS 18.6); suites that failed were rerun with fewer
simulators busy (`r8i2-`, `r8o2-`, see Open items). macOS: every fixture of `test-native-views.sh` on the same tree
(fi-674) passes except `NativeBehaviorViewIntegration` (canonical, Open items 2).

| Component | Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 | Notes |
|---|---|---|---|---|---|
| (shared theme) | `NativeThemeIntegration` | **30/30** | **30/30** | **30/30** |  |
| md-accordion | `NativeAccordionAppearanceIntegration` | **1478/1478** | **1478/1478** | **1478/1478** |  |
| md-accordion | `NativeAccordionBrowserStateIntegration` | **58/58** | **58/58** | **58/58** |  |
| md-accordion | `NativeAccordionFloatingIntegration` | **51356/51356** | **51656/51656** | **50684/50684** |  |
| md-accordion | `NativeAccordionInitializationIntegration` | **100/100** | **100/100** | **100/100** |  |
| md-accordion | `NativeAccordionLiftIntegration` | **280/280** | **280/280** | **280/280** |  |
| md-accordion | `NativeAccordionMotionIntegration` | **716/716** | **716/716** | **716/716** |  |
| md-accordion | `NativeAccordionPartsIntegration` | **8272/8272** | **8272/8272** | **8272/8272** |  |
| md-accordion | `NativeAccordionPlaceholderIntegration` | **320/320** | **320/320** | **320/320** |  |
| md-accordion | `NativeAccordionRendererIntegration` | **492/492** | **491/491** | **491/491** |  |
| md-accordion | `NativeAccordionReorderIntegration` | **628/628** | **628/628** | **628/628** |  |
| md-accordion | `NativeAccordionScrollingIntegration` | **278/278** | **278/278** | **278/278** |  |
| md-accordion | `NativeAccordionShiftIntegration` | **20324/20324** | **20400/20400** | **20252/20252** |  |
| md-accordion | `NativeAccordionStateIntegration` | **65/65** | **65/65** | **65/65** |  |
| md-accordion | `NativeAccordionStatesIntegration` | **56126/56126** | **56394/56394** | **55802/55802** |  |
| md-avatar | `NativeAvatarIntegration` | **2949/2949** | **2949/2949** | **2949/2949** | iOS 26.3 with the emoji font-path redirect |
| md-badge | `NativeBadgeViewIntegration` | **264/264** | **264/264** | **264/264** |  |
| md-bottom-sheet | `NativeBottomSheetMotionIntegration` | **21594/21594** | **21899/21899** | **22929/22929** |  |
| md-bottom-sheet | `NativeBottomSheetPaintIntegration` | **1948/1948** | **1948/1948** | **1948/1948** |  |
| md-button | `NativeBehaviorViewIntegration` | no result | no result | no result | canonical failure since n3-020 (stops) |
| md-button | `NativeBehaviorMain` | **164/164** | **164/164** | **164/164** |  |
| md-button | `NativeButtonAppearanceViewIntegration` | **24/24** | **24/24** | **24/24** |  |
| md-button | `NativeButtonMain` | **1073/1073** | **1073/1073** | **1073/1073** |  |
| md-button | `NativeButtonPaintIntegration` | **1086/1086** | **1086/1086** | **1086/1086** |  |
| md-button | `NativeButtonStatesIntegration` | **645/645** | **645/645** | 636/645 | iOS 18.6 click shots (rerun: 2) |
| md-button | `NativeFocusViewIntegration` | **68/68** | **68/68** | **68/68** |  |
| md-button | `NativeInspectionViewIntegration` | **88/88** | **88/88** | **88/88** |  |
| md-button-group | `NativeButtonGroupViewIntegration` | **87/87** | **87/87** | **87/87** |  |
| md-card | `NativeCardLifecycleIntegration` | **32/32** | **32/32** | **32/32** |  |
| md-card | `NativeCardPaintIntegration` | **6912/6912** | **6912/6912** | **6912/6912** |  |
| md-card | `NativeCardStatesIntegration` | 188523/188526 | 190525/190527 | 180870/180871 | dragClick clickPress shot |
| md-checkbox | `NativeCheckboxPaintIntegration` | **6019/6019** | **6019/6019** | **6019/6019** |  |
| md-checkbox | `NativeCheckboxStatesIntegration` | **17766/17766** | **17778/17778** | **17748/17748** |  |
| md-chip | `NativeChipPaintIntegration` | **9930/9930** | **9930/9930** | **9930/9930** |  |
| md-chip | `NativeChipStatesIntegration` | **151923/151923** | 154439/154440 | **150663/150663** | 1 click shot (iPad) |
| md-dialog | `NativeDialogMotionIntegration` | **13520/13520** | **13612/13612** | **13519/13519** |  |
| md-dialog | `NativeDialogPaintIntegration` | **2249/2249** | **2249/2249** | **2249/2249** |  |
| md-dialog / md-bottom-sheet / md-side-sheet | `NativeModalStackIntegration` | **149/149** | **149/149** | no result | iOS 18.6 full run: harness crash; rerun 149/149 |
| md-divider | `NativeDividerViewIntegration` | **276/276** | **276/276** | **276/276** |  |
| md-fab | `NativeFabViewIntegration` | **94/94** | **94/94** | **94/94** |  |
| md-fab-menu | `NativeFabMenuViewIntegration` | **134/134** | **134/134** | **134/134** |  |
| md-fab-menu | `NativeFabMenuViewIntegration --native-pointer` | **27/27** | **27/27** | **27/27** |  |
| md-fab-menu | `NativeFabMenuLifecycleIntegration` | **19/19** | **19/19** | **19/19** |  |
| md-icon-button | `NativeIconButtonViewIntegration` | **284/284** | **284/284** | **284/284** |  |
| md-list | `NativeListMethodsIntegration` | **28/28** | **28/28** | **28/28** |  |
| md-list | `NativeListPaintIntegration` | **29418/29418** | **29418/29418** | **29418/29418** |  |
| md-list | `NativeListStatesIntegration` | 76972/76982 | 77217/77221 | 75794/75803 | state layer / corners 1–2 frames late after a click |
| md-list | `NativeListTooltipIntegration` | **8/8** | **8/8** | **8/8** |  |
| md-loading-indicator | `NativeLoadingIndicatorViewIntegration` | **1798/1798** | **1798/1798** | **1798/1798** |  |
| md-meter | `NativeMeterViewIntegration` | **2669/2669** | **2669/2669** | **2669/2669** |  |
| md-progress-indicator | `NativeProgressIndicatorViewIntegration` | **2808/2808** | **2808/2808** | **2808/2808** |  |
| md-radio | `NativeRadioPaintIntegration` | **3335/3335** | **3335/3335** | **3335/3335** |  |
| md-radio | `NativeRadioStatesIntegration` | **11362/11362** | **11382/11382** | **11432/11432** |  |
| md-ripple | `NativeRippleIntegration` | **1785/1785** | **1785/1785** | **1785/1785** |  |
| md-segmented-button | `NativeSegmentedViewIntegration` | **370/370** | **370/370** | **370/370** |  |
| md-side-sheet | `NativeSideSheetMotionIntegration` | 11947/11949 | **11964/11964** | 12015/12018 | event timing 41–43 ms vs 40 (alone: iPhone pass) |
| md-side-sheet | `NativeSideSheetPaintIntegration` | **3057/3057** | **3057/3057** | **3057/3057** |  |
| md-skeleton | `NativeSkeletonViewIntegration` | **3724/3724** | **3714/3714** | **3724/3724** |  |
| md-snackbar | `NativeSnackbarViewIntegration` | **2987/2987** | **2987/2987** | **2987/2987** |  |
| md-snackbar | `NativeSnackbarControllerIntegration` | **27/27** | **27/27** | **27/27** |  |
| md-split-button | `NativeSplitButtonViewIntegration` | **945/945** | **945/945** | **945/945** |  |
| md-status-dot | `NativeStatusDotViewIntegration` | **1687/1687** | **1687/1687** | **1687/1687** |  |
| md-switch | `NativeSwitchPaintIntegration` | **10447/10447** | **10447/10447** | **10447/10447** |  |
| md-switch | `NativeSwitchStatesIntegration` | **16579/16579** | **16651/16651** | **16597/16597** |  |
| md-text-field | `NativeTextFieldPaintIntegration` | **12091/12091** | **12091/12091** | **12091/12091** |  |
| md-text-field | `NativeTextFieldStatesIntegration` | 2011/2026 | 2009/2026 | 2009/2026 | n3: press-focus motion, throttle event order |
| md-tooltip | `NativeTooltipViewIntegration` | **2600/2600** | **2600/2600** | **2600/2600** |  |
| md-tooltip | `NativeTooltipControllerIntegration` | **39/39** | **39/39** | **39/39** |  |

Per component (sum of its suites; the modal stack suite counts for each modal component):

| Component | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| md-accordion | **140493/140493** | **141136/141136** | **139424/139424** |
| md-avatar | **2949/2949** | **2949/2949** | **2949/2949** |
| md-badge | **264/264** | **264/264** | **264/264** |
| md-bottom-sheet | **23691/23691** | **23996/23996** | 24877/24877 |
| md-button | 3148/3148 | 3148/3148 | 3139/3148 |
| md-button-group | **87/87** | **87/87** | **87/87** |
| md-card | 195467/195470 | 197469/197471 | 187814/187815 |
| md-checkbox | **23785/23785** | **23797/23797** | **23767/23767** |
| md-chip | **161853/161853** | 164369/164370 | **160593/160593** |
| md-dialog | **15918/15918** | **16010/16010** | 15768/15768 |
| md-divider | **276/276** | **276/276** | **276/276** |
| md-fab | **94/94** | **94/94** | **94/94** |
| md-fab-menu | **180/180** | **180/180** | **180/180** |
| md-icon-button | **284/284** | **284/284** | **284/284** |
| md-list | 106426/106436 | 106671/106675 | 105248/105257 |
| md-loading-indicator | **1798/1798** | **1798/1798** | **1798/1798** |
| md-meter | **2669/2669** | **2669/2669** | **2669/2669** |
| md-progress-indicator | **2808/2808** | **2808/2808** | **2808/2808** |
| md-radio | **14697/14697** | **14717/14717** | **14767/14767** |
| md-ripple | **1785/1785** | **1785/1785** | **1785/1785** |
| md-segmented-button | **370/370** | **370/370** | **370/370** |
| md-side-sheet | 15153/15155 | **15170/15170** | 15072/15075 |
| md-skeleton | **3724/3724** | **3714/3714** | **3724/3724** |
| md-snackbar | **3014/3014** | **3014/3014** | **3014/3014** |
| md-split-button | **945/945** | **945/945** | **945/945** |
| md-status-dot | **1687/1687** | **1687/1687** | **1687/1687** |
| md-switch | **27026/27026** | **27098/27098** | **27044/27044** |
| md-text-field | 14102/14117 | 14100/14117 | 14100/14117 |
| md-tooltip | **2639/2639** | **2639/2639** | **2639/2639** |

## Limits (what the simulator genuinely does not offer, and how the harness handles it)

* **Hover**: no pointer on iPhone. `mouseMoved` is dropped (`AWC-IOS-UNSUPPORTED: pointer hover`); suites that model hover
  through `AWCNativePointerState` still exercise it. iPad pointer (trackpad) HID synthesis is not implemented.
* **Zero-distance moves**: UIKit delivers no touch move without a location change; the shim sends a 0.009 pt move
  (reported as `AWC-IOS-UNSUPPORTED: zero-distance …`).
* **Off-screen touches**: HID touches are clipped to the display; the window is moved for the gesture (reported).
* **Emoji on the iOS 26.3 runtime**: the runtime's font cache (FontServices `libGSFontCache`) names
  `System/Library/Fonts/Core/AppleColorEmoji.ttc`, which the simulator runtime does not ship (it ships the same face as
  `CoreAddition/AppleColorEmoji-160px.ttc`, the file the 18.6 runtime uses), so every emoji fell back to LastResort.
  The runtime image is read-only and a font copied into the device's `Library/UserFonts` is not used; a configuration
  profile needs Settings UI. `run-fixture.sh` therefore inserts `Shim/AWCFontRedirect.c` (`DYLD_INSERT_LIBRARIES`, fixture
  app only) which maps that one missing path to the runtime's own file (`AWC_IOS_FONT_REDIRECT=off` disables it).
  Avatar 2949/2949 on iOS 26.3 with it (2946/2948 without).
* **SwiftUI press timing (AWCUI fix)**: iOS 18 reports a SwiftUI Button's press (`ButtonStyle.Configuration.isPressed`)
  one frame after UIKit delivers the touch for a plain Button, and for an AWC button held still only at touch-up (button
  states timeline on iOS 18.6: no `isPressed` during a 675 ms press), so focus on press, `:active` and the press ripple
  started late or not at all; iOS 26 reports it in the same update. AWCUI's `AWCTouchPressRouter`
  (`Sources/AWCUI/NativeTouchPress.swift`) takes press and click of every `AWCNativeActionControl` (md-button, icon
  button, FAB, FAB menu item, segmented and split button, and the sheet / dialog / menu triggers built from them) from the
  raw UIKit touch, synchronously inside `sendEvent`. Where UIKit cannot see SwiftUI content above a control (iOS 26
  renders SwiftUI into the hosting view) the touch stays SwiftUI's, whose press is synchronous there.
* **Private SPI**: `_enqueueHIDEvent:`, `IOHIDEvent*`, `BKSHIDEventSetDigitizerInfo`, `_contextId` — simulator harness only.

## iOS fixes

Items 1–7 were made with `work/ios-fix/edit.py` (logged in `work/ios-fix/fixes.log`); items 8 onwards are the gate-6
patches in `work/fi-lab/patches/` (anchored, pre-image-checked, installed through the main queue by fi-911, fi-912, fi-961,
fi-963, fi-964 and fi-710, each with a macOS regression of the affected suites). All are confined to UIKit branches
unless noted; macOS reruns after the shared-line edits: dialog 2249/2249, bottom sheet 1948/1948, side sheet 3057/3057,
modal stack 149/149, accordion pointer reorder 628/628, switch paint 10335/10335 (CLT toolchain, `test-native-views.sh`).

1. Compile — `TooltipNativeAccessibility.swift` (UIKit `AWCTooltipRegionView`): stored `focused` collided with
   `UIView.focused` → `regionFocused`; explicit `self` in the `responder` closure. `SnackbarNativeAccessibility.swift:61`:
   explicit `self`. Result: `xcodebuild -scheme AWCUI -destination 'generic/platform=iOS Simulator'` clean (0 errors).
2. Playground — `AWCPlaygroundApp.swift`: iOS `List(selection:)` needs an optional binding; `listSelection` is
   `Binding<String?>` under `#if os(iOS)` and `$selected` on macOS (shared call site; macOS playground rebuilt). The
   `AWCPlayground` scheme builds for the simulator.
3. Line box — `NativeDialog.swift` `AWCCSSLineBox.natural/spacing` (`#if os(iOS)`), used by dialog, bottom sheet and side
   sheet (`.lineSpacing` call sites now call `spacing`, identical on macOS): UIKit snaps a text block, not each line, to
   device pixels and keeps the unrounded 2400/2048 em line (22 pt → 26 pt, 24 pt → 28⅓ pt at 3×), so single-line
   half-leading and wrapped-line spacing are derived from that. Fixed 44 + 8 + 93 geometry/paint failures.
4. Modal container focus — `ModalScope.swift` UIKit `AWCModalContainerFocusView`: report focus (`focusChanged`) so the
   surface paints its `:focus-visible` ring, and let touches pass (`point(inside:)` false, as AppKit `hitTest` nil).
5. Modal keys — UIKit has no window-level key monitor: `AWCModalHostView` keeps a per-window registry, its Escape/Tab
   commands are active only while the session is, and `AWCNativeButtonFocusView` / the container focus view route
   `next` through the active host. `blur()` (protected scrim) leaves the host as first responder so Escape still works.
6. Modal focus restoration — UIKit now captures the opener at `acquire` (hierarchy search for the first responder) and
   restores it with the AppKit retry loop (8 × 8 ms) once the underlying content leaves the inert state.
7. Accordion grip — `AccordionPointer.swift` UIKit `AWCAccordionReorderCapture`: for real touch events SwiftUI's hit test
   gives the header's gestures the touch (iOS 18+), so the grip's `touchesBegan` never ran and reorder-by-grip did not
   work at all on iOS. A `highPriorityGesture(DragGesture(minimumDistance: 0))` on the grip now drives the same
   begin/move/end through the UIView (window coordinates via `convert(_:to:)`), with cancellation (`cancel()`,
   inert) suppressing the rest of the gesture. Placeholder 0/24 → 320/320; pointer reorder 628/628.
8. **Sequential keyboard focus (Tab) — production, UIKit.** New `NativeKeyViewLoop.swift`: every AWC focus view
   (`AWCNativeButtonFocusView`, accordion scroll region, loading indicator, modal container) adopts `AWCKeyView`
   (`awcAcceptsFirstResponder` / `awcCanBecomeKeyView` / `awcBecomeKeyView`, the AppKit `acceptsFirstResponder` /
   `canBecomeKeyView` policies) and answers Tab / Shift+Tab with `AWCKeyViewLoop.select`, which walks the window's AWC
   focus views in AppKit key-view-loop order (rows top→bottom, leading→trailing, right-to-left under RTL; UIKit's
   subview order of SwiftUI-hosted views is not source order). Past the last stop focus leaves the components (Chrome:
   back to the document). With no first responder, Tab enters the loop through a hidden SwiftUI keyboard shortcut
   installed once by the outermost `AWCNativeView` (`.awcKeyViewEntry()`); an open modal session owns Tab on both
   platforms. iPhone has no system keyboard focus (`UIFocusSystem` is nil) and iPad's focus engine moves between
   focus groups, so neither provided this. Unblocked card, chip, list and accordion keyboard suites (card states
   1 640 → 0 Tab failures).
9. **Real taps on AWC buttons — production bug, UIKit.** `awcObservePointerOrigin` attached
   `simultaneousGesture(DragGesture(minimumDistance: 0))` inside the ButtonStyle; on iOS 18+/26 that suppresses the
   SwiftUI Button's action, so a real tap on md-button, md-icon-button, md-fab, md-split-button, md-segmented-button,
   md-fab-menu items and accordion headers emitted **no** event (fixtures injected `AWCNativePointerState`, which
   disables the observer, so they did not see it). A passive window-level `UIGestureRecognizer` now records the press
   origin without recognizing, preventing, cancelling or delaying anything. `Probe/NativeIOSTapProbe.swift`: 10/10
   interactive components emit their events from real touches (before: button, icon button, FAB: none).
10. **UIKit semantic views** (named like the AppKit ones): `AWCNativeMeterView` (value element: label + formatted
    value), `AWCNativeDeterminateProgressView` (UIProgressView), `AWCNativeSkeletonStatusView`
    (UIActivityIndicatorView), `AWCSnackbarStatusView` (static text, hint "status"/"alert").
11. **Inspection sizes** are reported to 1e-9 pt: edges snapped to device pixels at 3× gave 37.99999999999997 for a
    38 pt box.
12. **Accordion RTL geometry.** The "no clip" boxes of the lift and floating clips were inset by ±100 000 pt; on iOS
    SwiftUI then placed the hosted geometry probes of a lifted right-to-left item at x −4 instead of 40 (drawn at 40),
    so the reorder registry and the lift fixture read wrong rects. Inset ±1 000 pt (still clips nothing); the
    registry also uses SwiftUI's own global frames on UIKit. Lift 214/280 → 280/280 (macOS unchanged 280/280).
13. **Harness.** Extra sources and launch arguments (`AWC_IOS_EXTRA_SOURCES`, `AWC_IOS_ARGS` with `@BUNDLE@`,
    `AWC_IOS_SWIFT_FLAGS`), `throws`/`async` entries, precondition messages, interpolated oracle names, support-file
    `#filePath`, AppKit event queue (`postEvent` waits for the pump — fixtures post the mouse-up before sending the
    mouse-down), off-screen touches move the window instead of translating its content (content keeps its global
    geometry), outgoing hosting views flush before removal, the host installs AWCUI's Tab entry and AppKit text-input
    behaviour (no auto-capitalization/correction), zero-distance moves become 0.009 pt moves, and the AppKit surface
    used by the Codex fixtures (key-view loop, roles, NSAppearance → traits, NSTextField/NSScrollView, colours,
    function keys, window ordering).
14. **iPad keyboard focus — production, UIKit.** The iPad focus system (present on iPad, absent on iPhone) owns Tab when
    no AWC view is first responder. It never reached md-button, md-icon-button, md-fab, md-split-button,
    md-segmented-button, md-chip or the accordion header: `UIFocusDebugger` reported each focus bridge "visually occluded
    by UIKitFocusableViewResponderItem", the focus item SwiftUI keeps for a Button or Toggle even when it is
    `.focusable(false)`. Focus bridges now sit above their content on UIKit (`awcFocusBridgeLayer`; AppKit keeps them
    behind; they never hit-test, so touches still reach the content) and every sequential AWC focus view is its own
    focus group. Tab from nothing now enters at the first AWC view in key-view-loop order (before: md-switch, the one
    unoccluded bridge); iPad accordion states 56 526/56 526 (8 focus failures before).
15. **Backspace / Delete on UIKit — production.** UIKit reports Backspace as "\u{8}" (AppKit "\u{7F}") and forward
    Delete only by key code, so the removable md-chip ignored both on iOS. The UIKit focus view passes the key names
    ("Backspace", "Delete"). Chip states: the 8 key failures (removeBackspace, keyboard-input remove/focus ring) pass.
16. **Harness.** The host app's full-screen backdrop window sits one level below the fixture windows (at the same level
    the iPad focus system treated every fixture view as occluded); a pending bitmap representation reports its pixel
    size (rect × backing scale), which the progress RTL mirror check reads; a click (touch down + up in one step) is
    no longer awaited between the two phases, so it lands in one UIKit/SwiftUI update with no pressed frame between
    them, as in AppKit and Chrome (moves are still awaited: UIKit would otherwise coalesce them).
17. **Accordion header `:active` — production.** The header's pressed state came only from SwiftUI's ButtonStyle
    `isPressed`, which on the iOS 18.6 runtime arrives frames after the touch-down (the expressive press transition
    started after Chrome's: 36 failures there) and which also ends when the pointer leaves the button. It now also follows
    the primary press itself (pointer down inside the header and outside the chassis grip, until pointer up), as Chrome's
    `:active` does. iOS 18.6 accordion states 56 370/56 370; macOS accordion suites unchanged.
18. **Box-shadow blur on UIKit — production.** `AWCNativeBoxShadow` draws CSS shadows with a GraphicsContext blur whose
    standard deviation was calibrated on macOS (σ = r/√2). On UIKit the same filter renders σ ≈ 0.95 r on screen
    (`work/fi-lab/probes/NativeIOSBlurProbe2.swift`: 0.942–0.951 for r = 3…24 at 2×/3×; macOS 0.70–0.71), so iOS shadows
    were 1.34× wider than Chrome's. UIKit now uses r = b / (2 · 0.948). Accordion floating custom elevation (16 failures)
    and chip paint `hook-elevation` (2) pass; every other shadow suite still passes.
19. **List option role on UIKit — production.** A listbox option (`role=option`) carried the button trait; it is static
    text plus the selected trait, as WebKit exposes it and as the AppKit bridge reports it (list paint: 751 role checks).
20. **Fixture assumption.** `NativeSegmentedViewIntegration` bounded a red pixel count by one child's area × 4 (the 2×
    macOS backing); the 3× iPhone needs × 9. The bound now uses the capture's own pixel scale (macOS unchanged).
21. **Harness timing.** The host warms AWCUI's first render, waits for each fixture window's first presentation, and
    awaits the release of a held press (see Architecture). iOS 18.6: first-case platform-view lookups (accordion renderer,
    scrolling) now find their views.
22. **md-list row geometry feedback — production (iOS).** A list row measured its own boxes (row, handle, image, caret)
    inside its drag/shift translation and its body reads them, so during a sibling shift every render changed @State the
    row reads. On iOS SwiftUI then re-rendered the row in a tight loop (≈10 000 updates per 200 ms glide, probe
    `work/fi-lab/probes/NativeIOSTimelineProbe4.swift`), which starved other animation timelines: the drop placeholder's
    glide started ~210 ms late (`placeholder top` failures in every pointer-reorder case). The boxes are now stored without
    the translation (cleared at the drop); row r1 renders 8 times instead of 127 during the glide and the placeholder
    renders every frame.

23. **Press from the raw touch on iOS — production.** iOS 18 reports a SwiftUI Button's press one frame after UIKit
    delivers the touch, and an AWC button held still reports it only at touch-up (button states timeline on iOS 18.6),
    so focus on press failed (`press focus body vs button`: md-button 35, md-card nested `pressInner` 6, md-list trailing
    icon button 1) and `:active` / the ripple started late. `AWCTouchPressRouter` (`NativeTouchPress.swift`) takes press
    (touch-down) and click (touch-up inside) of every `AWCNativeActionControl` from the UIKit touch, synchronously in
    `sendEvent`; the innermost nested control wins; where UIKit cannot see SwiftUI content above the control (iOS 26) the
    touch stays SwiftUI's (synchronous there). SwiftUI Button actions themselves were never late: they run 0.1–1.2 ms
    after the touch-up on both runtimes (probe `NativeIOSTouchBridgeProbe`).
24. **Harness click delivery.** A click's zero-distance `mouseDragged` before `mouseUp` became a touch move that UIKit
    delivers in its own frame, delaying the release by a frame; a stationary press's zero-distance move is skipped
    (md-card `dragClick clickPress` and accordion floating presses pass on iPad).
25. **Harness capture series.** Waiting for a screen update on every shot of a capture window blocked the main thread
    ~20 ms per shot at 3×, so SwiftUI's frame-driven content skipped frames and shots repeated a stale frame (click-shot
    failures of md-button, md-chip, md-card). Shots in a series now snapshot the presented screen, and a single shot
    taken before any display frame followed the last input waits for that frame, so state the input set is in the shot
    as in Chrome's (md-card `dragClick clickPress` at 3×: 2–3 failures per run without the wait, 0 with it; waiting before
    every single shot instead moved md-button click2 and md-checkbox glyph frames ahead of Chrome; see Architecture).
26. **md-card press from the raw touch — production (iOS).** The card's DragGesture reports touch-down one frame after
    UIKit delivers it, so `:active` (state layer, ripple) started a frame late (`dragClick clickPress` at 3×). The card's
    focus bridge now takes the press from `AWCTouchPressRouter` (item 23) synchronously and clears it on touch-up; drag
    and click stay with the gesture.
27. **Harness shim for text editors.** The md-text-field states fixture uses `NSTextView` and an `NSWindow` that can
    become main; the shim maps `NSTextView` to `UIResponder & UITextInput` and answers `canBecomeMain` (compile only).
28. **md-text-field states fixture on iOS (compile).** The UIKit branch of `NativeTextFieldStatesIntegration.swift` declared
    `let os` twice in one scope; the second declaration (same value) is dropped (patch 45; md-text-field is n3's).

29. **Touch press through SwiftUI's own hit test — production (iOS 18+, di patch-01).** `AWCTouchPressRouter` (item 23)
    decided occlusion with a UIKit hit test of the focus bridges; where SwiftUI draws the content into the hosting view
    itself (iOS 26, and md-button content on iOS 18.6) the probe fell through to the hosting view and the touch stayed
    SwiftUI's, whose ButtonStyle `isPressed` is a frame late on iOS 18 (md-button `click2`: the wave restarted after the
    release, R1-01). Each `awcFocusBridgeLayer` now attaches a passive `UIGestureRecognizerRepresentable`
    (`AWCTouchPressRecognizer`) to the view under its bridge: SwiftUI hands it the touch only where its own hit test puts
    it (scrims and content above, `allowsHitTesting`, nested controls), inside `UIApplication.sendEvent`, and it calls the
    bridge's `touchPress` (press, click on release inside, slop / scroll cancel) as the router did. iOS 17 keeps the router.
    Probe `di-lab/probes/NativeIOSRepresentableProbe.swift` (iPhone 26.3 and 18.6): the recognizer gets the touch in the
    same turn as UIKit's delivery, SwiftUI's DragGesture and Button actions run in that turn too, a scrim or a Text above a
    button keeps the touch, and the recognizer delays no SwiftUI gesture.
30. **Host pointer at the touch's delivery (harness, di patch-03).** Fixtures that drive a host pointer model
    (`AWCNativePointerState`) next to the touch updated it when the touch was queued, a frame or two before UIKit
    delivered the press and again after the release: a click painted `:active` where Chrome's does not (md-list state
    layer and corner morph, md-chip click shots, md-navigation-bar press under load; r3-22, R4-11, R6-16).
    `AWCShimTouch.pointerDown` / `pointerUp` apply the pointer change when UIKit delivers the touch-down (before the app
    handles it) and right after it handled the touch-up — AppKit's order on macOS; a release not delivered within the await
    is applied at once. Used by the md-list, md-chip and md-navigation-bar states fixtures (md-button and md-card keep the
    queue time: their press schedules are calibrated to it).
31. **Event delay from the input's delivery (harness, di patch-02).** The dialog / side-sheet / bottom-sheet motion fixtures
    time an event from the step that caused it, with Chrome + 40 ms allowed; Chrome times it from its trusted input's first
    event, while the native step included the synthesized input's delivery (a click's release reaches the app 17–36 ms
    after it is queued, more under load: md-dialog `basic-ok` / `fullscreen-rtl` 40.0–40.7 ms, md-side-sheet Escape
    40–44 ms; r3-23, R4-19). `AWCShimTouch.deliveredAt` stamps every delivered touch / press, and the event delay is timed
    from the delivery of the step's last input (per-frame motion keeps the queue time; `AWC_MOTION_STEP_ANCHOR=queue`
    restores the old event timing).
32. **Phase clocks (harness, di patches 04-05).** The md-card and md-chip states fixtures shot, and the md-button fixture
    pressed and shot, on the run clock: a phase whose input started late because the previous window's captures overran
    (6–12 ms per phase on an iPhone at 3x) was photographed that much earlier in its transition (md-card `dragClick
    clickPress` second ripple, r3-11; md-button `click2` fade on iOS 18.6, R1-01). The phase's shots and inputs now run on
    the phase's own clock, as the md-list fixture already did (`AWC_*_STATES_SHOT_ANCHOR=t0`: the old timing). macOS
    results are unchanged (card 173306/173306, chip 148613/148613, button 645/645).
33. **Diagnostics.** `AWC_LIST_STATES_TRACE=<case>:<row>:<prop>` (+ `AWC_LIST_STATES_TRACE_WINDOW=<from>-<to>`),
    `AWC_CARD_STATES_TIMING=1`, `AWC_CHIP_STATES_TIMING=1`, `AWC_DIALOG_TIMING=1` print per-frame values or input lateness.
34. **md-list reorder glides from the drag move — production (iOS, di patches 10 and 14).** The drop placeholder and the
    sibling shift glided from SwiftUI's `onChange` of the new target, a frame or more after the touch move on iOS 18.6, and
    the placeholder's paused TimelineView, resumed for each glide, rendered one frame and then none for 25–45 ms: the
    glide's first frames trailed Chrome's beyond the 34 ms envelope (`drag` / `dragCancel` / custom reorder, r3-22). The
    runtime stamps the move that changed the target (`targetChangedAt`); on iOS both glides start there
    (`AWCListPlaceholderView.glideStart`) and the placeholder's timeline runs while it is shown (during a drag only).
    macOS keeps the onChange start and the paused timeline.
35. **md-list placeholder samples by their render time (harness, di patch 16).** The md-list states fixture timed the drop
    placeholder's per-frame value by when it read it; while the placeholder's timeline waited for its next frame, a read
    carried the previous frame's value at a later time (iOS 18.6 `drag` / `dragCancel`, r3-22). On iOS the value is now timed
    by its `renderTime`, as the rows already were. macOS: unchanged.
36. **Keys aimed at a text input (finding, harness).** UIKit hands a hardware key whose responder is a text input to the
    keyboard (UIKeyboardImpl), not to the window as a UIPressesEvent; the keyboard applies it 5–69 ms after the HID
    key-down (median ~30 ms, iPhone 26.3; `AWC_IOS_KEY_TIMING=1` prints each key's await). The shim's press await
    therefore ends at its 30 ms timeout for every typed key. Awaiting the key's effect instead (text / selection /
    responder change) dropped a key under load and was not adopted; `AWC_IOS_KEY_AWAIT=0` (diagnostic only) garbles typing.
37. **Diagnostics.** `AWC_LIST_STATES_PH_TRACE=<case>` prints the drop placeholder's per-frame values with the step and
    delivery times.
38. **AppKit key repeats (harness, di patch-18).** The shim pressed and released a new HID key for every AppKit
    auto-repeat (keyDown with `isARepeat`), so a fixture holding Space toggled md-switch / md-checkbox once per repeat
    (d4's held-Space checks, R4-06). A repeat is now folded into the held press already sent (iPhone 26.3: switch states
    16635/16635, checkbox states 17840/17840).
39. **Accessibility runtime (harness, di patch-19).** UIKit loads its accessibility bundles when the simulator's
    `com.apple.Accessibility` runtime is on, and they change what views report: an activity indicator with an empty label
    answers "In progress" (md-skeleton, gate-7 R2-D12). tools/ax's iOS probe and Accessibility Inspector switch the runtime
    on and it persists per simulator, so results depended on which simulator ran a suite. `run-fixture.sh` now sets it before
    every launch: `AWC_IOS_AX_RUNTIME=voiceover` (default) = AccessibilityEnabled + ApplicationAccessibilityEnabled on and
    AutomationEnabled off — the runtime VoiceOver runs an app in. VoiceOver itself stays off: it would take the synthesized
    touches as its own gestures. `off` and `automation` (all three on, as tools/ax and XCUITest) are available. The host
    prints the state the app launched with on its `AWC-IOS-START` line (`ax=<accessibility>/<application>/<automation>`,
    from libAccessibility). Probe `di-lab/probes/NativeIOSAXRuntimeProbe.swift` (iPhone 26.3): off → an empty
    `UIActivityIndicatorView` label reads "", voiceover and automation → "In progress".
40. **One-turn clicks in the md-list fixture (harness, di patch-22).** A click the fixture queues in one turn never paints
    `:active` in Chrome (mousedown and mouseup before its next frame). UIKit delivers the two touch phases on separate frames,
    and when the release came more than a frame after the press the list item's press matured and painted one frame of it
    (r3-22: `extra/expand…-hooks` r1 state layer 0.228 vs 0.2). `AWCShimTouch.pointerClick` moves the fixture's host pointer
    down and up together right after the app handled the touch-up.
41. **md-card shots from the delivered input (harness, di patch-24).** A phase's shot keeps Chrome's distance from the
    phase's input as the app received it (the first touch or key UIKit delivered in the phase), less half a frame: the card
    starts its press visuals in the delivery turn, Chrome in its next frame. Timed from the queued input, the shot came a
    frame early when UIKit delivered the touch two frames late (iOS 18.6 `dragClick clickPress`: the second press's wave a
    few points smaller than Chrome's, r3-11). `AWC_CARD_STATES_SHOT_AT=queue`: the queued input.
42. **Chrome sample gaps around an input in the md-list fixture (harness, di patch-26).** The fixture judged a native frame
    inside a Chrome sample gap of more than two frames against the gap's endpoints. Around a click Chrome sometimes recorded
    no frame for 80–100 ms, and the state it passes through between its mousedown and click (a selected row no longer
    active: icons in the selected colour) is not on the line between those endpoints (`select-options` r0 icons, r3-22,
    about half of the iPhone 26.3 runs with the accessibility runtime on). On iOS a native frame inside such a gap that holds
    one of the run's steps is recorded as a known gap (`KNOWN-GAP chrome-unsampled …` on the console), not judged.
43. **md-navigation-bar transitions in the next frame — production (iOS, di patch-27).** A tab's state change started its
    CSS transitions (state layer, colours, indicator) in the update of the input that caused it; Chrome computes style once
    per frame after the input, so its transitions start a frame later. After an arrow key or a press the focus / press layers
    ran a frame ahead of Chrome on iOS 18.6 (gate-7 R6-19 `manual-ltr arrow-forward t+50`, R6-16 `auto-ltr press t+66`; 2 of 3
    runs with the accessibility runtime on, 0 of 3 off). On iOS the transitions now start one frame later (`AWCTabsTrack`
    transition delay: the track holds its value until then, changes within the frame coalesce, a set-and-reset starts none),
    as md-breadcrumbs, md-color-picker, md-list-item and md-org-chart already do. macOS: unchanged.
44. **Wave values across a slipped input in the md-chip / md-card fixtures (harness, di patch-30, patch-29).** The per-frame
    windows map a native render time to web time through the step in force at that moment. When the harness dispatches a
    phase's input late (the window before it ran over with captures; under load 30–60 ms), every later sample and the end of
    every window just before that step move back by the slip, though the md-ripple wave fading there is timed from the press
    that started it. iOS 18.6 / 26.3 `pointer-filter-filled-error-light-ltr ripple opacity 0.0102 at web 2778 within Chrome
    [0.0168, 0.12]`: 0.0168 is Chrome's value at web 2787, the window end (2818) folded back by leave2's 31 ms slip. On iOS the
    wave's values (`ripple opacity` / `ripple scale`) are also read on the previous step's clock within 600 ms of a step that
    slipped against it (`SLIP` lines name the samples that matched only there; `AWC_CHIP_STATES_SLIP=0` /
    `AWC_CARD_STATES_SLIP=0`: one clock). Probe: `AWC_CHIP_STATES_LATE=leave2:40` dispatches that input 40 ms late; with it,
    samples outside Chrome's envelope on the step clock lie inside on the click's (di-050 / di-050b, 26.3 and 18.6). Other
    properties follow their own step's input: one clock. macOS: one clock.
45. **md-card shot window while a wave runs (harness, di patch-29).** Chrome photographs a phase after its last sample and
    before the next phase starts, not at a fixed time; the fixture's single delivery-anchored shot (item 41) caught iPad
    `dragClick-outlined-dark-ltr/clickPress`'s growing wave a frame smaller than Chrome's photo (mean 1.03, >6: 1122 pixels at
    its edge, 2 of 3 runs). On iOS, when a wave is growing or fading at the shot, the frames one display frame before (after
    Chrome's last phase sample) and after (before the next phase) are candidates too, best of the three
    (`AWC_CARD_STATES_WINDOW=0`: the shot only). Taking them in every phase slipped every input 37–67 ms on iPhone 26.3, hence
    the restriction and item 44.
46. **md-button / md-chip `click2`: Chrome's photo between two native frames (harness, di patch-28, patch-32).** Chrome makes
    its phase photo on demand, at any moment of its animation clock; the simulator only has display frames. Across `click2`'s
    150 ms release fade a large surface changes more per frame than the check allows (iPhone 26.3
    `pointer-filled-xl-light-ltr`: native frames ~1 ms before and ~16 ms into the fade, Chrome's ~12 ms). On iOS, when no
    single frame in Chrome's capture window matches and two consecutive distinct frames straddle Chrome's image (one darker,
    one lighter over the compared pixels), the frame at Chrome's moment is their blend (1 − w)·A + w·B (the wave's opacity is
    linear in the composited pixel), which must match under the same thresholds (`BRACKET` lines;
    `AWC_BUTTON_STATES_BRACKET=0` / `AWC_CHIP_STATES_BRACKET=0`: off). Evidence: xl signed differences +1.72 / −0.96, w 0.65,
    mean 0.32 (di-050); chip `pointer-filter-filled-error-light-ltr/click2` −1.40 / +1.72, w 0.45, mean 0.12 (di-050b).
47. **md-button capture window two frames past Chrome's (harness, di patch-28b).** A simulator capture shows the last
    committed frame, whose content is up to a frame older than the capture, plus TimelineView's content offset (probe
    `NativeIOSTimelineDateProbe`: `context.date` is 2.3 ms (iOS 18.6), 7.8 ms (iPhone 26.3), 9.2 ms (iPad 26.3) before the
    content is evaluated, 16.7 ms frames), and captures come about a frame apart. On iOS 18.6 the failing `click2` shots'
    frames approached Chrome (native minus Chrome −3.05, −0.91, then a repeat at the window end) and stopped a frame short:
    642/645 in 3 of 3 runs; captures two frames longer: 645/645 on single frames (di-050b). On iOS the md-button fixture's
    captures now run two display frames past Chrome's window (`AWC_BUTTON_STATES_WINDOW_EXTRA=<ms>`, 0 = Chrome's window);
    `FRAMES` lines print every window frame's signed difference when a shot still fails. The phases run on their own clocks
    (item 32), so the next phase's start keeps Chrome's distances.

## Open items

1. **Synthesized input latency of the simulator (harness).** UIKit delivers a synthesized touch one phase per frame (a
   click's release ~2 frames after it is queued); keys typed into a text input reach it through the keyboard 5–69 ms after
   the key-down (item 36). Fixtures timed from the queued input rather than its delivery still carry that latency:
   md-time-picker / md-color-picker taps and dial (fi, env leads `AWC_TP_*` / `AWC_CP_*`; `AWCShimTouch.deliveredAt` gives
   the delivery, items 30–31) and md-otp-field characters typed on Chrome's cadence (n3). md-button `click2` (R1-01) is
   resolved by items 46–47 (the capture, not the product: Chrome's photo between two native frames, and a capture's
   content a frame behind it).
   Per-fixture status: work/di-lab/PROGRESS.md.
2. **md-text-field (n3).** `NativeBehaviorViewIntegration` stops on canonical since n3-020 (iOS: "Edited numeric input
   retains authored step base"; macOS: "Extreme invalid length constraints do not crash native editing"), so its later
   checks do not run. `NativeTextFieldStatesIntegration` on iOS: press-focus motion 2–3 frames of 84 outside Chrome's
   envelope and `tf-throttle-*` event order (the throttle window against the harness's typing cadence); 2011 / 2009 /
   2009 of 2026. Reported to n3 (work/n3-lab/REQUESTS.md).
3. **Accessibility survey (fa).** The tools/ax iOS probe renders dialogs/sheets without the Laboratory launcher, so its
   md-side-sheet "missing Open side sheet" and Tab-order rows are probe-presentation differences (reported to fa).
