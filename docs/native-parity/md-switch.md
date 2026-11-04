# Switch parity checkpoint

Status: dedicated SwiftUI and Compose renderers replace the generic adapters in production
dispatch (`AWCNativeView`: `md-switch` → `nativeSwitch`; `AWCComponent`: `md-switch` →
`NativeSwitch`). Public appearance and part APIs exist on both platforms. The macOS and Android
runtime checks below pass against trusted-input Chrome oracles. This is an implementation
checkpoint (gates 1, 2, 4 and 5), not the final
all-component audit, and not an iOS runtime claim. Source review: [md-switch-source-review.md](md-switch-source-review.md);
oracles and test design: [md-switch-native-plan.md](md-switch-native-plan.md).

## Contract and implementation

- All properties: `selected`, `disabled`, `softDisabled`, `required`, `name`, `value`, `icons`,
  `showOnlySelectedIcon`, `selectedIcon`, `unselectedIcon`, `density` 0…−4 (a local density
  overrides the inherited one) and `valueMissingLabel` (through the native form rules).
- Events: `mdInput` is cancelable through the native event scopes (`AWCEventScope` /
  `AWCActionScope`); when it is not cancelled the switch commits and emits `mdChange`. Both carry
  `{selected}`. A cancelled toggle is still observed by `onEvent`, but an associated native form
  keeps its value (as the source's form value).
- Pointer: press sets the pressed state and focuses without the focus-visible ring, leaving the
  host clears it while the active state stays until release, and only a release on the host
  toggles. Keyboard: Space toggles on key-down with the 150 ms pressed pulse and ignores key
  repeat (on macOS through the dispatched `NSEvent.isARepeat`, installed with the md-checkbox pass); Enter is inert. Hard disabled is not focusable and ignores the pointer; soft disabled
  stays focusable and hoverable but never toggles.
- Form: the switch registers with the native form (`AWCFormScope` / `AWCFormState`); reset restores
  the initial state without events, and the reset is animated like the source.
- Slots: `selected-icon` / `unselected-icon` replace the glyph inside the 16pt icon box. The source
  has no default slot, so authored default-slot content is not rendered (the previous generic
  Android adapter rendered it as a label).
- Motion: CSS transition semantics (retargeting, reversal shortening) on the frame clock;
  position/size on the spatial fast spring, colours/state layer on the effects fast spring, both
  read from the theme tokens. Transitions start in the frame that first renders a change. Reduced
  motion (system setting or `awcSelectionReducedMotion` / `AWCSelectionReducedMotionScope`) is instant.

**Hooks and parts.** `AWCSwitchAppearance` carries the twelve hooks (lengths in points/dp,
colours `#RRGGBB`/`#RRGGBBAA`); `AWCSwitchPartAppearance` carries the part rules that win over
hooks and every state: track colour/outline/shape, handle colour/shape/opacity (group opacity
with the icon), icon colour and state-layer colour. Swift: `.awcSwitchAppearance(_:for:)`,
`.awcSwitchPartAppearance(_:for:)`; Compose: `AWCSwitchAppearanceScope`, `AWCSwitchPartAppearanceScope`.

## Verification

| Check | Result |
| --- | --- |
| Source tests (switch/checkbox/radio) | 12 suites, 249 tests pass |
| macOS paint (`NativeSwitchPaintIntegration`, 426 cases) | 10335/10335 checks; worst flat pixel 1/255 |
| macOS interaction (`NativeSwitchStatesIntegration`, 17 runs incl. reduced motion and form reset) | 28963/28963 checks |
| Android paint (`NativeSwitchParityTest`, 426 cases) | 10335/10335 checks |
| Android interaction (`NativeSwitchInteractionTest`, 17 runs) | 26285/26285 checks |

Every paint case compares host, track, container and handle boxes (±0.6), track/outline/handle/
state-layer/icon colours (premultiplied, ±0.012), handle opacity, focus ring, tab index and every
flat pixel of the clip (≤0.5% over 6/255, mean ≤1). The interaction runs compare every rendered
frame's handle position (±0.35) and size (±0.2), handle/track/outline colours (±0.012) and
state-layer opacity (±0.004, or hidden) with Chrome's per-frame samples within ±2 frames, plus
event names, payloads and cancellation, settle values and the paint at the end of every phase.

## Differences and limits

- Accessibility role: Compose uses `Role.Switch` with a toggleable state. AppKit/UIKit have no
  switch role for a custom view, so SwiftUI exposes the checkbox role with the selected state (as
  `NSSwitch` reports itself).
- `setFocus()`, the constraint-validation methods, the inline validation presentation and `mdValidityChange`
  are native since gate 3 ([selection-laboratory.md](selection-laboratory.md)); the four validation paint cases pass. Inside a native
  form, `required` also follows the native form rules.

## Full suites after installation

The renderers are installed in `packages/native-ios` (selection-patch.py: new files plus anchored
dispatch, `.disabled` exemption and fixture-list edits) and `packages/native-android` (new files plus
the anchored dispatch line in `AWCComponent.kt`; androidTest classes and assets).

- Swift: all 51 view fixtures pass individually (incl. `NativeListPaintIntegration` 29418/29418 and
  `NativeListStatesIntegration` 106044/106044, whose rows compose switches), and all 8 package scripts
  pass (`outputs/native-parity/md-switch/native-swift/full/`).
- Android: 264 device tests, 259 pass; the 5 failures are the known pre-existing ones with unchanged
  messages (`everySourceTagComposesNatively`, `genericProgressUsesSourceDefaultMaximum`,
  `segmentedSetCoordinatesSelectionAndContainerEvent`, two `NativePreviewPresentationTest` cases).
  `NativeListStatesTest`/`NativeListPaintTest` (switch rows) pass. Unit tests: 195/195
  (`outputs/native-parity/md-switch/native-android/full/`).
- iOS (UIKit): compiled and executed in the simulator harness on iOS 26.3 and 18.6 (section "iOS simulator execution" below).

Evidence: `outputs/native-parity/md-switch/native-{swift,android}/checkpoint.json`.

## Laboratory (gate 3)

Complete 2026-10-26: see [selection-laboratory.md](selection-laboratory.md). The twelve hooks, all twelve properties as retained updates, the four typed parts, both icon slots and every method through `AWCSelectionControlController` (`setFocus` and the constraint-validation methods); `mdValidityChange` is native. The four validation paint cases now run and pass (macOS, Android and the iOS simulator: 10,447/10,447 each). The supporting line now sits inside the host on both platforms (host height includes it; the text overflows toward the inline end).

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeSwitchPaintIntegration` | **10447/10447** | **10447/10447** | **10447/10447** |
| `NativeSwitchStatesIntegration` | **16579/16579** | **16651/16651** | **16597/16597** |
| **Total** | **27026/27026** | **27098/27098** | **27044/27044** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
