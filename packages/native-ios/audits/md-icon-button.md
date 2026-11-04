# md-icon-button — SwiftUI audit

Source reviewed: `packages/core/src/components/md-icon-button/md-icon-button.tsx`, its CSS, ripple, focus and safe-URL helpers. Renderer: `NativeIconButton.swift`; public styling: `IconButtonAppearance.swift`; activation: `AWCIconButtonAction`; shared real native control: `NativeActionControl.swift`. Reviewed 2026-10-20.

| Web surface | Swift implementation and evidence |
| --- | --- |
| `variant` (standard/filled/tonal/outlined) | Source semantic color cascade, including toggle-off palettes, selected without toggle, disabled custom-color precedence and selected outlined transparent border. Contract and actual palette-pixel tests. |
| `size`, `buttonWidth`, `density` | Exact 5×3×5 geometry matrix; density floors, independent glyph taper, round radius independent of density. All 75 combinations measured in real SwiftUI. Explicit width may exceed parent without shrinking. |
| `shape`, `shapeMorph`, `selected` | Source round/square/selected/pressed radii and 200ms press (250ms narrow)/400ms release. Global shape token and Reduce Motion respected. Explicit corner radius changes resting radius; connected corners take precedence. |
| `connectedLeft`, `connectedRight` | Source logical corner rules for round/square, including RTL. The composite group's neighbor-motion behavior is audited separately. |
| `ripple` | Shared Material farthest-corner wave, pointer-origin or centered keyboard activation; 450ms growth/150ms release fade and independent clipping. |
| `disabled`, `softDisabled` | Both block activation and state layer; hard disabled excludes focus, soft disabled stays focusable. Semantic disabled palette overrides explicit icon/outlined colors and filled/tonal container colors exactly as source. |
| `toggle`, `selected`, `icon`, `selectedIcon` | Real state updates and bundled Material Symbols. Selected colors/shapes do not require toggle; selected glyph layer does. Dynamic selected-child presence updates without stale parts. |
| Default and `selected` slots | Raw whitespace and badge-only default slots preserve fallback. Symbols, text and element-like `AWCNode.slotText` wrappers supported. Authored empty wrappers mask fallback; incidental whitespace does not. Avatar keeps its own size. Badge does not mask glyph, follows physical top-right in RTL, and escapes the host clip while state/ripple remain clipped. |
| `href`, `target` | Safe native URL router; optional explicit native navigation coordinator for target presentation contexts. Navigation happens before toggle and event as Web source requires. Unsafe/rejected navigation still permits toggle and event. |
| `value` | Preserved component value for parent ownership; correctly absent from this component's `{selected}` event payload. |
| `groupTabindex` | Source null/0/-1 focus contract through actual native responder; shared group focus infrastructure. |
| `mdClick` | Exactly one post-navigation/post-toggle notification, `{selected}` only; no invented `mdChange`. Native event scopes support capture/target/bubble, stop propagation and observable cancellation. Cancellation cannot undo already committed effects. Truthful pointer/keyboard/accessibility source metadata. |
| Methods | Source declares none. Public `AWCIconButtonAction` is an explicit native action API, not a fabricated source method. |
| CSS parts | `state-layer`, `icon`, `selected-icon` have actual measured native counterparts; outlined state-layer bounds exclude the border. |
| Nine CSS hooks | `AWCIconButtonAppearance` / `.awcIconButtonAppearance`: containerColor, iconColor, stateLayerColor, iconSize, cornerRadius, outlineColor, outlineWidth, width, height. Same fieldwise inherited/local merge used by live and snapshot hosts. |
| Accessibility | Authored `aria-label`, native button role (also for href), selected toggle state, hard/soft-disabled semantics and real native focus. Glyphs are decorative. |

The public styling parameters use points, the renderer's logical coordinate unit. Width/height/iconSize/cornerRadius accept finite 0…2400, outlineWidth 0…16, colors `#RRGGBB`; malformed locals do not erase inherited values. Outlined boxes retain at least their two border edges when explicit dimensions are zero. Strings supplied by Laboratory's icon slot editors become `.slotText` elements, while direct `.text` values remain raw text nodes.

## Verification

Checked-in runners, not temporary-only test programs:

- `sh packages/native-ios/scripts/test-native-button.sh --disable-build-manifest-caching` runs source geometry/palette/appearance/slot/action cases shared with XCTest, plus existing md-button contracts.
- `AWC_NATIVE_VIEW_FIXTURES='NativeIconButtonViewIntegration NativeFocusViewIntegration NativeInspectionViewIntegration' sh packages/native-ios/scripts/test-native-views.sh --disable-build-manifest-caching` compiles and runs actual offscreen AppKit/SwiftUI windows. It verifies pixels, sizes, badge anchoring, dynamic slots, empty wrappers, focus, pointer release, Enter and accessibility; existing button tests protect shared-control extraction.
- `swift build --package-path apps/native-ios-playground --disable-build-manifest-caching` builds AWCUI, AWCPlayground, AWCSnapshots and AWCLivePreview.
- `node apps/native-ios-playground/scripts/test-live-icon-button.mjs` exercises real live-host JSON→native renderer→captured PNG/inspection/event delivery, including all nine appearance fields, inherited defaults/local overrides, selected slots, empty wrappers, pointer and keyboard.

Final focused results: **770 contract checks** pass (489 existing button + 281 icon-button); **268 real icon-button view checks** pass; the shared-control regression suites pass **68 focus/accessibility checks** and **88 button inspection/layout checks**. The live icon-button host test passes. All four Swift products compile. Eight generated icon-button usage/event/slot/part snippets independently typecheck; the explicit-empty-slot snippets additionally use the public `.slotText` API.

The real-view matrix caught an RTL badge-position mirroring issue, fixed by an explicit physical coordinate space for the badge overlay while preserving its content direction. The live-host test caught the previous held-pointer allowlist and now exercises icon buttons through actual scoped pointer down/up events. Empty editor text is represented as an authored wrapper, with regressions distinguishing it from raw whitespace fallback.

## Precise platform boundaries

This environment has macOS Command Line Tools and no iOS SDK, simulator or device. The shared SwiftUI implementation and AppKit responder path are compiled and executed; UIKit/iOS17+ keyboard, focus engine and VoiceOver behavior are not runtime-verified here. Native image antialiasing differs from browser rasterization.

Native named children, view styling, scoped events and URL presentation replace slots/CSS/DOM dispatch/browser windows. They do not execute arbitrary CSS, shadow-DOM retargeting, DOM MouseEvent objects, browser noopener/referrer/window behavior, positive HTML tabindex sorting or Windows forced-colors CSS. These are specific Web API boundaries, not unimplemented ordinary icon-button states. Nested components such as md-avatar/md-badge keep their own component implementations and receive their separate parity audits; this audit covers their icon-button sizing/fallback/anchor/overflow treatment.
