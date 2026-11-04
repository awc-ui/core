# md-fab — SwiftUI audit

Reviewed 2026-10-20 against `packages/core/src/components/md-fab/md-fab.tsx`, its CSS, source density spacing tokens and the real Web geometry oracle at `outputs/native-parity/md-fab/web-geometry.json`. Implementation is `NativeFab.swift` and `FabAppearance.swift`; native input/focus/ripple reuse the tested button infrastructure.

| Web API | SwiftUI implementation |
| --- | --- |
| `variant` | Seven source palettes, including surface-container-high at rest and surface-container-low when lowered. Container/foreground roles resolve from the active native theme. |
| `size` | Standard56, medium80, large96 before density. Icon24/28/36. Any nonempty label uses the source standard extended geometry regardless of size. |
| `density` | Five rungs; container -4pt/rung, icon -1pt/rung and label -0.5pt/rung. Extended insets/gap use the global stylesheet's discrete spacing token payload. |
| `icon` | Real bundled Material Symbols glyph. No fabricated default icon in the production renderer. |
| `label`, `extended` | Label defaults to extended; explicit false clips/fades it to zero while retaining its accessible name. Native measured natural text width drives the 500ms spatial curve. All density rungs retain the source collapsed minimum width56. |
| `lowered` | Elevation1 at rest/focus/press and2 on hover; ordinary elevation3/4. Surface variant switches its actual container role too. |
| `disabled`, `softDisabled` | Both block pointer/keyboard/accessibility activation and state layers. Hard-disabled leaves native focus traversal; soft-disabled remains focusable. Disabled container/ink roles use source alpha. Explicit icon/label hooks still override the inner parts, as Web CSS does. |
| `ripple` | Real clipped native ripple with pointer origin; native Enter/Space/accessibility use the control center. Disabled suppresses it. |
| `mdClick` | One cancelable scoped native event. Native callback/transport detail is null because no DOM MouseEvent exists; public `event.activation` carries the actual native input ID/source. There is no selected detail, toggle, navigation or `mdChange` side effect. |
| `icon` slot | `.symbol(name, slot: "icon")` inherits resolved icon size/color; `.slotText(text, slot: "icon")` supplies an authored element, even when empty/whitespace. Raw text nodes do not count as assigned elements. Literal text inherits host typography, independently of the symbol glyph size. Multiple native slot children remain composed. |
| `setMenuIcon` | `AWCFabController` attached by `.awcFabController(controller)` exposes `await controller.setMenuIcon(String?)`. Nonempty string (including whitespace) temporarily replaces the authored icon/slot; nil or empty clears it and restores the latest authored content. Disabled does not block this method. |
| Five CSS hooks | `AWCFabAppearance(containerColor:iconColor:iconSize:cornerRadius:labelColor:)`, fieldwise inherited with `.awcFabAppearance`. Colors are validated six-digit hex; dimensions are finite0…2400pt. |
| CSS parts | State-layer, icon and label are real native visual/inspection subparts. Arbitrary CSS selector execution is not an API on SwiftUI. |
| Accessibility/direction | Native role/button action, authored `aria-label` or label, soft/hard disabled semantics, explicit/inherited RTL order. Decorative Material ligature names are not spoken. |

## Measured layout contracts

The source label `New project` at default density is approximately147.969×56 (all three size properties). With icon, insets are16/20 and label gap12. The density0…-4 expected extended widths are147.969,144,132.625,128.953,121; label-only default width115.969. A blank authored icon span still occupies24×24. Typed iconSize40 increases the default extended width to163.969. RTL mirrors the unequal logical insets and the part order.

The temporary menu icon does not mutate authored properties or slots and does not force an extended FAB to collapse. FAB Menu's separate anchor shape/icon-transition coordination belongs to the menu component, not a new public FAB property.

## Host and validation

Live and snapshot hosts accept `fabAppearanceDefaults`/`fabAppearance` and text/symbol icon slots. Live input accepts `{command:"method",method:"setMenuIcon",arguments:[string|null]}` and returns only after actual controller invocation. It also supports held pointer down/up/move/cancel. A frame and its measured inspection nodes come from the same native layout pass.

Checked-in validation paths:

- `sh packages/native-ios/scripts/test-native-button.sh --disable-build-manifest-caching` runs shared metric/appearance/palette/slot contracts, also wired into XCTest.
- `AWC_NATIVE_VIEW_FIXTURES=NativeFabViewIntegration sh packages/native-ios/scripts/test-native-views.sh --disable-build-manifest-caching` runs actual offscreen SwiftUI geometry, pixel colors, pointer/key/accessibility, scoped cancellation and controller override/clear cases.
- `node apps/native-ios-playground/scripts/test-live-fab.mjs` runs JSON configure → native view → measured frame/events → real method invocation, including disabled/blank slots and density.
- `swift build --package-path apps/native-ios-playground --disable-build-manifest-caching` compiles library and all preview products.

Current results: **141 FAB source-contract checks** passed as part of the **1,072-check** shared button/icon/group/FAB runner. **94 real native FAB view checks passed**. The live-host method test passed, and all preview products built successfully. Independent fixtures use unique native IDs and identity-guarded preference callbacks; actual property transitions retain their identity, preventing old offscreen view preferences from contaminating the next case.

## Platform boundary

This machine has macOS Command Line Tools only. SwiftUI/AppKit builds and real offscreen windows validate the shared renderer here; iOS SDK compilation, UIKit hardware keyboard/touch, iOS device rendering and VoiceOver execution remain unverified. Native event/slot/controller equivalents do not execute JavaScript, DOM MouseEvent objects, browser CSS selectors or CSS custom-property strings.
