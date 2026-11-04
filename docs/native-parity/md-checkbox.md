# Checkbox parity checkpoint

Status: dedicated SwiftUI and Compose renderers replace the generic adapters in production
dispatch (`AWCNativeView`: `md-checkbox` → `nativeCheckbox`; `AWCComponent`: `md-checkbox` →
`NativeCheckbox`; md-radio keeps the shared adapter until its own gate). Public appearance and part
APIs exist on both platforms. The macOS and Android runtime checks below pass against trusted-input
Chrome oracles captured on the Mac (Chrome 153) from the build with the gate-1 fixes (C1 key repeat,
C2 reduced motion). This is an implementation checkpoint (gates 1, 2, 4 and 5), not the final audit or an iOS runtime claim. Contract and source decisions:
[md-checkbox-source-review.md](md-checkbox-source-review.md); plan: [md-checkbox-native-plan.md](md-checkbox-native-plan.md).

## Contract and implementation

- Properties: `checked`, `indeterminate`, `disabled`, `softDisabled`, `required`, `name`, `value`,
  `error`, `errorText`, `supportingText`, `density` 0…−4 (local over inherited), `valueMissingLabel`
  (through the native form rules) and the decorative mode (`ariaHidden="true"`: no tab stop, hidden
  from accessibility).
- Activation: a click toggles (indeterminate → checked, indeterminate cleared) and emits `mdChange`
  `{checked, indeterminate}` through the native event scopes; Space toggles on key-down **once per
  press** (repeats ignored) with the 150 ms pressed pulse and a centred ripple; Enter does nothing.
  Hard disabled is inert and unfocusable; soft disabled stays focusable but never toggles.
- Paint: target circle, state layer (hover 0.08, focus-visible 0.12, active 0.12; hidden when
  disabled), md-ripple wave clipped to the state-layer circle (450 ms grow, 150 ms fade, 0.12, the
  current state-layer colour), container with outline, the `check`/`remove` glyph in Material
  Symbols FILL 1 / wght 600, the supporting/error line (start-aligned with the box, overflowing
  toward the inline end) and the focus ring at the state-layer edge (a rectangle around the host
  when it has a supporting line), with the source's error/disabled cascade.
- Motion (CSS transition semantics on the frame clock, starting in the frame that first renders a
  change): container colours `short2` standard; squish `scale(0.82)` with `short4` standard in and
  `medium4` emphasized-decelerate out; state layer `short1`; the glyph entrance keyframes
  (0 → 1.18 → 1, per-interval easing) when the mark appears, not on checked ↔ indeterminate. Reduced
  motion removes all of them except the ripple, as the source does after C2.
- Form: registration with the native form; reset restores the initial `checked` and `indeterminate`
  without events.

**Hooks and parts.** `AWCCheckboxAppearance` carries the fourteen hooks (lengths in points/dp, the
container shape as a corner shape, colours `#RRGGBB`/`#RRGGBBAA`); `AWCCheckboxPartAppearance`
carries `target` colour, `state-layer` colour and opacity, `container` colour/outline/shape,
`icon` colour and `supporting-text` colour. Swift: `.awcCheckboxAppearance(_:)`,
`.awcCheckboxPartAppearance(_:)`; Compose: `AWCCheckboxAppearanceScope`, `AWCCheckboxPartAppearanceScope`.

## Verification

| Check | Result |
| --- | --- |
| Source tests (Mac, private build with C1/C2) | checkbox suites pass (`source-tests/mac-checkbox-suites.log`) |
| macOS paint (`NativeCheckboxPaintIntegration`, 258 cases) | 5957/5957 checks |
| macOS interaction (`NativeCheckboxStatesIntegration`, 12 runs + 3 reduced) | 34938/34938 checks |
| Android paint (`NativeCheckboxParityTest`, 258 cases) | 5699/5699 checks |
| Android interaction (`NativeCheckboxInteractionTest`, 15 runs) | 23310/23310 checks |

Paint compares target, state-layer and container boxes (±0.6), container/outline/state-layer/icon/
supporting colours (premultiplied ±0.012), glyph, icon opacity and size, supporting text and
position, focus ring and offset, tab stop and every flat pixel of the clip (RTL clips clamped to the
viewport as Chrome does). The interaction runs compare every rendered frame's container scale
(±0.004), container/outline colours (±0.012), state layer (±0.004), glyph scale (±0.02) and glyph
opacity (±0.012) with Chrome's per-frame samples within ±2 frames, plus `mdChange` payloads, settle
values and the paint at the end of every phase (ripple included). Chrome samples a frame before the
component writes its classes, so the frame in which a glyph entrance starts (keyframe 0, invisible) is
added from the recorded animation start; nothing is widened.

## Differences and limits

- Mixed state: macOS reports `AXValue` 2 through the shared focus bridge, iOS the value "Mixed", Compose
  `ToggleableState.Indeterminate` ([accessibility.md](accessibility.md)).
- The Swift key-repeat filter reads the AppKit event being dispatched (`NSEvent.isARepeat`); UIKit
  delivers one press per physical press. The macOS window-level harness does not inject repeats, so
  the Swift filter is not exercised by a test; Compose is (`heldSpaceTogglesOnce`).
- The two inline-validation paint cases run through the native method controller since gate 3 and pass
  ([selection-laboratory.md](selection-laboratory.md)). Open source decisions (aria-invalid at rest when required; disabled
  fieldset) are recorded in the source review.

## Full suites after installation

Installed with the same mechanics as md-switch: `selection-patch.py` (new files; anchored dispatch,
`.disabled` exemption and fixture-list edits in `packages/native-ios`) and `install.py` (new files plus
the anchored dispatch line in `AWCComponent.kt`; androidTest classes and byte-identical assets).

- Swift: all 53 view fixtures pass (`outputs/native-parity/md-checkbox/native-swift/full/`), including
  switch 10335/10335 + 28921/28921 and checkbox 5957/5957 + 33918/33918 inside the suite.
  `NativeBehaviorViewIntegration` clicked the old adapter's label row at x = 80; the source checkbox
  is the 48pt host only (no label slot), so its click moved onto the host centre (an anchored test
  edit); it then passes (35/35). `NativeFabMenuViewIntegration` failed once in the suite and passed on
  its rerun; the fixture contains no selection control.
- Swift scripts: badge, behaviour, button, button-hosts, divider, preview and status-dot pass.
  button-hosts and preview first failed because the playground's stale SwiftPM build plan did not see
  the new AWCUI files; after `swift package clean` of the playground both pass. `test-native-fab-menu.sh`
  fails at "Close restores authored anchor glyph" (4 runs) while the same fixture passes through the
  views runner; it passed in the md-switch run and has no checkbox, so this is recorded as an open
  intermittent issue, not as a pass.
- Android: 267 device tests; the 5 known pre-existing failures remain (same messages). Three other
  tests failed only under the concurrent Swift suite (`NativeAccordionAccessibilityTest`,
  `systemInjectedMouseHoverReachesTheHeader`, `NativeBottomSheetMotionTest`) and pass on an isolated
  rerun. Inside the suite: switch 10335/10335 + 26285/26285, checkbox 5699/5699 + 23310/23310,
  `heldSpaceTogglesOnce` passes. Unit tests 195/195.
- iOS (UIKit) compile: the Xcode build now runs but stops at an existing error outside these renderers
  (`SnackbarNativeAccessibility.swift:61`, implicit `self` in a closure), so UIKit compilation of the
  switch/checkbox views is still unverified.

Evidence: `outputs/native-parity/md-checkbox/native-{swift,android}/checkpoint.json`.

## Laboratory (gate 3)

Complete 2026-10-26: see [selection-laboratory.md](selection-laboratory.md). The fourteen hooks, all twelve properties as retained updates, the five typed parts and the constraint-validation methods through `AWCSelectionControlController`; `mdValidityChange` is native. The two validation paint cases now run and pass (macOS and the iOS simulator 6,019/6,019; Android 5,759/5,759). Compose now shows the reported message in the supporting line with the error colours, as SwiftUI did.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeCheckboxPaintIntegration` | **6019/6019** | **6019/6019** | **6019/6019** |
| `NativeCheckboxStatesIntegration` | **17766/17766** | **17778/17778** | **17748/17748** |
| **Total** | **23785/23785** | **23797/23797** | **23767/23767** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
