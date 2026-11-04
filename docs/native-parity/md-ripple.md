# md-ripple native checkpoint

Status: **gates 2–3 (dedicated native primitive, Laboratory) verified on macOS SwiftUI, the iOS simulator and the Android emulator**
against Mac Chrome 153 oracles (2026-10-27). Laboratory integration (gate 3), accessibility evidence and the
independent final audit are pending. Source contract: [md-ripple-source-review.md](md-ripple-source-review.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Surface decorator (the composition the Web element forms with its positioned parent) | `.awcRipple(disabled:cornerRadius:contentColor:controller:appearance:)` | `Modifier.awcRipple(disabled, cornerRadius, contentColor, controller, appearance)` |
| `md-ripple` node (`AWCNativeView` / `AWCComponent`) | fills its slot; clip radius `awcRippleHostCornerRadius`, colour `awcRippleContentColor` | `LocalAWCRippleHostCornerRadius`, `LocalAWCRippleContentColor` |
| Six hooks | `AWCRippleAppearance` (typed or `cssValues:` text) + `.awcRippleAppearance(_:)` | `AWCRippleAppearance` (typed or `cssValues`) + `AWCRippleAppearanceScope` |
| `trigger()`, `whenSettled()` | `AWCRippleController` + `.awcRippleController(_:)` | `AWCRippleController` + `AWCRippleControllerScope` (`wave` reads the current wave) |
| `--md-sys-ripple-enabled` | theme token `--md-sys-ripple-enabled` or `awcRippleEnabled` | theme token or `LocalAWCRippleEnabled` |

Behaviour mirrors the source: the host's own gestures keep working (presses are observed simultaneously / in the initial
pointer pass, never consumed); only a primary press inside the rounded host shape starts a wave (Chrome hit-tests the
border radius); the origin is physical (no RTL mirroring); the radius reaches the farthest corner of the host rectangle
grown by the two extents; the wave grows with the hook duration and easing at constant opacity and fades for 150 ms with
the standard curve once the press is released *and* growth has completed; a new press or `trigger()` replaces the wave and
only that cycle's waiters settle; `whenSettled()` keeps the source's 200 ms bound; disabling, losing the key window
(macOS) / leaving the active scene (iOS) / losing window focus (Android) and leaving the hierarchy remove the wave at once;
suppression allocates nothing and hides a running wave; a hidden ripple still tracks presses but paints nothing. Hook
fallbacks follow the source exactly (JavaScript `Number()` opacity with clamping, concrete px-only extents, ms/s/unitless
durations, Chrome-valid `<easing-function>` text: keywords, `cubic-bezier()`, `steps()`, `linear()`).

## Evidence (jobs n1-002…018, A001…A005)

Oracles (`outputs/native-parity/md-ripple/web-oracle-mac/`, Chrome 153.0.8010.36, DPR 1, trusted input) are shared
byte-identically by `packages/native-ios/Tests/Fixtures/ripple-web-*` and the Android assets `RippleWeb*`.

| Run | Result |
| --- | --- |
| macOS SwiftUI `NativeRippleIntegration` | 1,790/1,790 checks (160 frozen paint frames with wave box/scale/opacity/clip and every flat pixel; 8 motion configurations within Chrome's two-frame envelope plus removal times; 21 behaviour scenarios) |
| iOS simulator (iPhone 17 Pro, iOS 26.3.1, harness) | 1,785/1,785 (the secondary-button checks do not apply to touch) |
| Android emulator `NativeRippleParityTest` | paint 1,103/1,103, motion 24/24, behaviour 27/27 (including a foreign second-finger release) |

Motion tolerance: native values must lie within Chrome's values from 2f + 7 ms earlier to 2f + 1 ms later (f = Chrome's
measured frame interval; 40/34 ms at 60 fps, the project rule): Chrome starts a Web Animation on the frame after it is
created, starts the fade on the frame after the grow's `finished` promise and only observes removal at its next frame.
Native releases are replayed at Chrome's measured `pointerup` times.

## Oracle notes
- Press points stay clear of the rounded-corner hit edge: Chrome's sub-pixel corner hit test (a 0.52 px-outside press hit,
  0.6 px missed) is not a contract; circles use points well inside.
- A hidden (`display:none`) ripple keeps its wave but Chrome reports no transform for it; nothing paints on either side.

## Remaining
Independent final audit. Laboratory gate 3 and the accessibility evidence are recorded below (2026-10-28); the
iOS keyboard Tab walk belongs to the shared UIKit focus traversal of the focus bridge (iOS track), not to the ripple.

## Laboratory (gate 3) — 2026-10-28

- **Recipe:** the Web recipe is a token-styled button surface ("Tap to see the ripple": label-large, 16 × 24 padding,
  16 radius, on-surface on surface-container-highest). SwiftUI and Compose render the same surface with
  `AWCRippleExampleSurface` (one native button element and keyboard stop; keyboard activation starts no wave, as the
  source listens to pointer presses only).
- **Styles panel:** the six hooks (`ripple-appearance.js`): colour (#RRGGBB/#RRGGBBAA), peak opacity, both extents (px),
  grow duration (ms) and grow easing (CSS easing text validated like Chrome: keywords, `cubic-bezier()` with x in 0…1,
  `steps()`, `linear()`), applied in place on both hosts (`.awcRippleAppearance` / `AWCRippleAppearanceScope`).
- **Properties:** `disabled` updates in place (retained update); unknown properties and wrong types are rejected.
- **Methods:** `trigger()` and `whenSettled()` through `AWCRippleController` on both hosts (whenSettled returns within
  its 200 ms bound).
- **Examples:** 8 copyable SwiftUI examples typecheck and 8 Compose examples compile (usage, theme, appearance,
  appearance defaults, disabled, both methods): `outputs/native-parity/md-ripple/laboratory/RippleExamples.*`.
- **Policies:** NativeSupport.json / support.json declare the property, both methods, the six hooks and no parts.

| Run | Result |
| --- | --- |
| Studio `ripple-integration.test.mjs` (+ examples, appearance and coverage suites in the canonical tree) | 36/36 |
| SwiftUI live host `test-live-ripple.mjs` | 13/13 |
| Android `LivePreviewRippleHostTest` | 1/1 |
| Android parity suite after the host changes | paint, motion, behaviour green |

## Accessibility (tools/ax) — 2026-10-28

Cases `default` and `disabled` (Laboratory presentation) on Web, macOS, iOS and Android
(`outputs/native-parity/md-ripple/accessibility/report.md`): every platform exposes exactly one button named
"Tap to see the ripple"; the ripple adds no element and no text (Web `aria-hidden`, native accessibility-hidden).
macOS and Android Tab orders match Web. iOS: the Tab walk reaches no element — the shared UIKit keyboard-focus
traversal of `AWCNativeButtonFocusBridge` (owned by the iOS track, the same for every focus-bridge control); the ripple
itself is not involved. Android reports the 48 dp touch-target info only.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeRippleIntegration` | **1785/1785** | **1785/1785** | **1785/1785** |
| **Total** | **1785/1785** | **1785/1785** | **1785/1785** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
