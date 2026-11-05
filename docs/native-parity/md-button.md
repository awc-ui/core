# Button parity checkpoint

Status (2026-10-28, fork fx): gates 1, 2, 4 and 5 against Chrome 153 on macOS, with the native renderers in
production dispatch (`AWCNativeView` → `AWCNativeButtonStyle`, `AWCComponent` → `NativeButton`). The md-fab
elevation work is part of this checkpoint ([md-fab.md](md-fab.md)). iOS runtime is fork fi's
(`work/fi-lab/REQUESTS.md`); the final all-component audit is separate.
Source review: [md-button-source-review.md](md-button-source-review.md).

## Source (gate 1)

Two defects, fixed test-first in `packages/core/src` (details in the source review):

* (a) A keyboard-focused link button had no focus ring and no focus state layer.
* (b) A link button's anchor covered only the content box (ripple sized to the label, 20 px tall anchor).

md-button, md-button-group and md-split-button spec + e2e: 280/280.

## Browser reference (gate 2)

`outputs/native-parity/md-button/web-oracle/` (Chrome 153.0.8010.36, macOS, DPR 2, trusted CDP input, oracle
pages in `web-reference/`):

* Paint: 317 md-button cases (variants × sizes × shapes × states × themes × RTL, densities, 28 single hooks,
  hook combinations, parts, slots, link, loading with the loader frozen at t = 0) + 37 md-fab cases.
* States: 35 pointer/keyboard/link/toggle/hooks runs with per-frame samples, animation records, events,
  focus and phase screenshots with their capture windows (`shotStart`/`shotEnd`); reduced motion: 5 runs.
* The fixtures are byte-identical on both platforms (Swift `Tests/Fixtures/button-web-*`, Android
  `androidTest/assets/ButtonWeb*`).

## Renderers and APIs (gate 4)

* **Elevation:** `box-shadow: var(--md-sys-elevation-N)` from the theme token, drawn outside the border box (it
  never shows through a translucent container), interpolated between levels like a CSS box-shadow transition.
  Swift `AWCElevationShadow` (on `AWCNativeBoxShadow`, `.outer`), Compose `awcElevationLayers` +
  `accordionShadow`. Used by md-button and md-fab (levels 3/4, lowered 1/2).
* **State layer:** `stateLayerOpacity` (Swift `AWCButtonAppearance`, Compose `AWCButtonAppearance`) models
  `::part(state-layer) { opacity }`, which outranks the per-state opacities.
* **Ripple:** colour = the label colour (md-ripple's `currentColor`), painted under the state layer (DOM order),
  playing under reduced motion like Chrome (`awcReducedMotion` / `AWCButtonReducedMotionScope` override for tests).
* **Press:** the pressed state (state layer, shape morph, ripple) comes from the press itself — pointer down
  inside the button until pointer up — not only SwiftUI's `isPressed` (late on iOS 18; fi's patch-29 pattern).
* **Soft-disabled / loading:** excluded from the generic `.disabled` wrapper, so a press focuses the button while
  activation stays blocked (`AWCButtonAction.perform`), as Chrome focuses a `tabindex="0"` host.
* **Compose layout:** the inline padding rounds once for both sides (fractional density insets), and an authored
  label slot is laid out as source text (Chrome letter-spacing advances).

## Results (gate 5)

| Check | Swift (macOS, AppKit host) | Android (emulator, API 36) |
| --- | --- | --- |
| Paint: border box, label/loader boxes, every flat pixel (354 cases) | 1086/1086 | 712/712 |
| Interaction: events, focus, best-of-capture-window phase paint (35 + 5 runs) | 645/645 | 645/645 |

Capture-window rule: a phase is compared with the native frames inside Chrome's recorded capture window. For a
release fade, the window reaches back by the lag Chrome's own samples show (md-ripple starts the fade on the first
frame at or after the 450 ms grow end, so it starts 0 or 1 frame late depending on Chrome's frame phase; measured
per phase, never assumed). The native fades start exactly at the grow end.

Full suites: see `work/claude-runner/INTEGRATION.md` (i2).

## Known differences

* Android: Compose places content at whole pixels; the border box is compared to 1 dp (Chrome's fractional
  LayoutUnits).
* The Laboratory's button appearance module exposes the CSS hooks; the `::part(state-layer)` opacity is a
  native API (`stateLayerOpacity`) without a Laboratory control.

## Evidence

`outputs/native-parity/md-button/`: `source-tests/`, `web-oracle/`, `native-swift/` (paint/states results,
captures, logs), `native-android/` (XML, device JSON, logs).

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeBehaviorViewIntegration` | no result | no result | no result |
| `NativeBehaviorMain` | **164/164** | **164/164** | **164/164** |
| `NativeButtonAppearanceViewIntegration` | **24/24** | **24/24** | **24/24** |
| `NativeButtonMain` | **1073/1073** | **1073/1073** | **1073/1073** |
| `NativeButtonPaintIntegration` | **1086/1086** | **1086/1086** | **1086/1086** |
| `NativeButtonStatesIntegration` | **645/645** | **645/645** | 636/645 |
| `NativeFocusViewIntegration` | **68/68** | **68/68** | **68/68** |
| `NativeInspectionViewIntegration` | **88/88** | **88/88** | **88/88** |
| **Total** | 3148/3148 | 3148/3148 | 3139/3148 |

Press, click and focus-on-press now come from the UIKit touch (`AWCTouchPressRouter`, ios-harness.md iOS fixes 23): button states pass on iOS 26.3 and the iPad; iOS 18.6 keeps 2–9 click-shot pixel checks (ios-harness.md Open items 1). `NativeBehaviorViewIntegration` (the shared behaviour fixture) stops on canonical at an md-text-field check (n3-020, Open items 2), so it has no count.

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
