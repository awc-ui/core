# md-split-button — Swift native parity

The dedicated renderer implements the complete source component contract: fourteen properties, two events, the additive default slot, six typed appearance hooks and seven measured visual parts. No public Web methods exist. The implementation uses two actual SwiftUI buttons with independent AppKit/UIKit responder bridges; it does not delegate to a generic combined button.

## Source mapping

| Source surface | Native implementation and verification |
| --- | --- |
| variant, size, density | All four palettes, five sizes and five density rungs match the hydrated Web oracle. Inherited density uses the existing finite native density environment; canonical local negative values override it. The default outer radius derives from base size, and trailing glyphs never density-taper. |
| icon, label, trailingIcon, default slot | Bundled decorative Material Symbols, actual Roboto text measurement and an additive child slot. Visible ASCII whitespace collapses and label text stays on one line. Leading iconSize affects only the leading glyph. Slot text does not replace the label. |
| fullWidth | The leading half takes remaining width and its label truncates; the trailing half retains intrinsic width. The split gap is exactly2pt. Source border/padding floors and logical RTL placement are retained. |
| trailingChecked | Actual local state updates before its event; unrelated prop updates retain that state, while changed authored trailingChecked wins. Checked trailing padding becomes symmetric, corners use the outer radius and the glyph rotates180 degrees. |
| disabled, softDisabled | Both halves block actions and override all enabled custom colors. Hard-disabled excludes both tab entries; soft-disabled keeps independently focusable native controls. Outlined disabled stays transparent. |
| menuLabel, haspopup, controls | A separately named trailing accessibility control exposes expansion and popup kind. AWCPopupScope/AWCPopupTargetScope resolve an actual mounted native group and offer a localized Move to popup action. The action focuses the first eligible AWC descendant, otherwise its real native group. An absent/unmounted target has no fabricated focus action. Changing target identity and action localization is tested. No popup is opened or closed implicitly. |
| ripple | Each half owns a clipped Material ripple. Pointer presses and native keyboard activation have independent origins. Keyboard pulses do not create an extra CSS-active morph state; focus remains the visual authority. |
| mdLeadingClick / mdTrailingClick | Exact detail null / {checked}, with native input provenance in activation. Events are dispatched after committing trailing state and canceling them does not roll back. Both Enter and Space use real native responder input. |
| six hooks | AWCSplitButtonAppearance(containerColor,labelColor,iconColor,outlineColor,cornerRadius,iconSize), applied with .awcSplitButtonAppearance, merges inherited defaults by field. Outlined ignores containerColor; disabled discards enabled ink/container overrides. |
| seven parts | leading, trailing, leading-state-layer, trailing-state-layer, icon, label and trailing-icon have measured inspection nodes. Outlined border consumes layout, so child padding is measured inside that border. |

The renderer preserves source interaction details: independent100ms state-layer transitions,200ms corner/rotation transitions, reduced-motion bypass, asymmetric shape-morph opt-out, elevated inner-edge shadow clipping and source hover/focus/pressed elevation precedence. Both source default roles and actual theme token values are used; no fixed Web-derived measurement metadata is invented.

## Executed evidence

- Source oracle:50 hydrated browser fixtures in `Tests/Fixtures/split-button-web-geometry.json` (the independently captured workspace oracle is preserved). Includes25 size/density combinations, all variants and disabled states, checked/RTL, additive slot content, all appearance hooks and constrained/full width.
- `AWC_NATIVE_VIEW_FIXTURES='NativeSplitButtonViewIntegration NativeFocusViewIntegration' sh packages/native-ios/scripts/test-native-views.sh --disable-build-manifest-caching`: SplitButton945/945 real SwiftUI/AppKit layout/pixel/keyboard/accessibility/lifecycle checks. The existing focus suite also passed68/68 actual keyboard, focus-visual and accessibility checks.
- `swift build --package-path apps/native-ios-playground --disable-build-manifest-caching`: all three preview products built. Both LiveRenderer and SnapshotRenderer accept defaults/local appearance. Live frames publish actual correlated splitButtonChecked.
- `node apps/native-ios-playground/scripts/test-live-split-button.mjs`:13 direct JSON-host checks exercise actual held-pointer and keyboard input, both exact event payloads, state capture, RTL, styles, default slot and the576pt full-width preview area inside640pt capture. The same script checks the small Badge inspector no longer reports nonexistent typography.
- Independent review corrections are included: outlined state-layer drawing and measured bounds exclude the real border; disabled state layers are absent. The final host rerun passed13/13 and all16 generated Swift examples typechecked.
- Both the view fixture and live test are wired into the checked-in native test runners, not temporary manual compilations.

Source/test/log hashes and exact command logs are under workspace `outputs/native-parity/md-split-button`. Natural text-width tolerance is0.8pt for native font measurement; heights, glyph dimensions, logical padding and the inter-control gap have strict checks. The implementation measures each actual native part rather than inferring them from the oracle.

## Precise platform boundaries

This machine provides macOS Command Line Tools only. These are actual macOS SwiftUI/AppKit tests; the UIKit responder code has not been compiled against an iOS SDK or exercised on a device/VoiceOver. Browser DOM events, CSS selectors/parts and ARIA objects are represented by native events, typed styles, measured nodes and actual native accessibility relationships. Native font rasterization and anti-aliasing need not be byte-identical to Chromium. CSS forced-colors mode has no macOS/iOS CSS runtime counterpart; native accessibility settings remain the platform authority.
