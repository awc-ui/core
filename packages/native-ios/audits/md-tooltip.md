# md-tooltip — Swift native parity

Status: dedicated native implementation and the initial macOS renderer/controller/host gates pass. Supplemental typed-part fixtures, exact generated examples and integrated Laboratory acceptance remain open. Native support declarations have not yet been expanded.

## Source contract and native API

`AWCNativeView` renders an actual anchor with an independent popup through a caller-sized `AWCTooltipScope`. The popup does not enlarge the anchor or participate in its parent's normal layout. The scope supplies the overlay coordinate space and window-level Escape ownership.

All twelve source properties have retained native behavior: `text`, `subhead`, `variant`, `position`, `autoPosition`, `offset`, `crossOffset`, `open`, `showDelay`, `hideDelay`, `disabled`, and `density`. All twelve placements resolve the physical side, logical alignment, RTL conversion, integer source measurement, main-axis flip and cross-axis clamp. A mounted popup follows anchor, content and viewport changes. Local density spacing tokens and inherited density typography are handled separately.

`AWCTooltipController` attaches through `.awcTooltipController`. Asynchronous `show()` and `hide()` cancel pending trigger timers and confirm applied state; they do not wait for the visual transition. `mdOpen` and `mdClose` carry null detail and remain component instance events. Disabled opening normalizes closed, and re-enabling does not implicitly open.

Pointer/focus entry uses the source delay; exiting uses its grace period. Moving into the popup or its authored actions preserves visibility. Escape closes and suppresses immediate reopening until trigger exit/re-entry. Owned popup focus returns to the prior anchor; unrelated focus stays unchanged. Detachment removes listeners and timers, while reattachment restores them without replaying `mdOpen`. Touch invocation is provided by a simultaneous long-press gesture; actual iOS touch execution remains unverified.

Four public outlets use `.awcTooltipSlot(.anchor/.subhead/.content/.actions)`. Builders accept actual SwiftUI views and retain author-owned handlers and explicit typography. The typed `text:` overload uses the component's bundled Roboto, tracking and source line boxes. Structured `AWCNode` children also preserve the four outlets. A builder may supply `accessibilityLabel` because arbitrary native views do not expose DOM `textContent`; typed text and node outlets derive their own authored description. Rich descriptions include rendered heading/supporting content and omit fallback text and action labels. Plain descriptions use the actual plain text property.

Eleven sparse appearance fields map the source hooks through `AWCTooltipAppearance`: six colors, plain/rich shapes, plain maximum width and rich minimum/maximum width. Colors retain alpha. `AWCTooltipLength` retains point, percentage, em, rem, ch and additive calc coefficients. The sizing context carries native parent/font/root/zero-glyph measurements. Physical asymmetric and elliptical corner shapes retain their source order in RTL.

Five typed part targets are `popup`, `text`, `subhead`, `supportingText`, and `actions`. Their appearance provides ink, background, border, corner shape, weight, logical start padding, signed logical start margin, font size, line height and tracking. Explicit source descendant typography and slotted action colors retain their specificity. This is a typed native styling interface, not an arbitrary CSS parser; selectors, pseudo-elements and browser-only syntax remain Web APIs.

## Rendering, semantics and transport

The component renders the source 100ms standard curve, scale .9↔1 and grouped opacity. The transform pivots toward the anchor using a stable viewport wrapper, avoiding fractional-size rounding of the intrinsic popup. Rich elevation is painted outside the surface so transparent container colors are not darkened internally. Reduced motion commits the endpoint directly. An explicit native forced-colors option adds the semantic one-point border; OS forced-colors execution is not claimed.

On macOS, the authored native anchor keeps its role and label and receives the actual `AXHelp` description. The visible popup exposes a native help-tag role. Real responder tests exercise focus into authored actions, activation, conditional focus restoration, unrelated-focus preservation and detach/reattach. These in-process semantic checks do not establish VoiceOver delivery or OS accessibility traversal.

The Laboratory host accepts strict retained twelve-property updates and real viewport resizing on the same controller. Width is bounded to 320–1200pt and height to 1…min(2000,floor(2,000,000/width)), rounded after clamping. Height defaults to 240 only when omitted; the UI sends its actual canvas height. These allocation limits belong to preview capture, not the public scope. Resize acknowledgements carry the committed replacement frame. Methods use correlated accepted/result messages, distinct from transition completion. Events reflect `open` into the retained node, so an explicit `open:true` update reopens after method-driven hiding even when initial configuration was open.

## Evidence and limits

The initial combined gate passes 2,587 renderer assertions and 39 controller assertions. It compares 102 configurations per theme against the independently captured font-only/default-token source matrix, with no captured palette injection. It includes actual RGB/RGBA pixels, authored outlets, fractional geometry, RTL glyph alignment, 32 recorded Web transition samples, native transition pixels, reduced-motion endpoints, and real AppKit accessibility/focus cases. The actual native host passes 42 protocol, pointer, keyboard, property, method and viewport checks. Supplemental part acceptance is still pending, so these totals are not a blanket acceptance of every public part-field combination.

Executed evidence is macOS SwiftUI/AppKit. This environment has no iOS SDK, simulator or device. UIKit compilation and execution, native touch, hardware-keyboard routing, VoiceOver operation, and actual OS reduced-motion/contrast preferences remain unverified. Native scope ownership is limited to one scene/window; unrelated windows do not share a browser document overlay stack. Arbitrary transformed native parent matrices and mixed-family modal coordination are not asserted by this component checkpoint.
