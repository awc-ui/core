# Switch native implementation plan and Chrome oracles

The contract comes from `packages/core/src/components/md-switch/` and the
[source review](md-switch-source-review.md). Oracles were captured with Chrome 153 headless,
DPR 1 and trusted CDP input (mouse and keyboard), from the private core build in
`work/selection-tree` (identical sources). Pages and harness: `outputs/native-parity/md-switch/web-reference/`
(`paint.html`, `states.html`, `common.js`, `oracle.mjs`, `server.mjs`). Results:
`outputs/native-parity/md-switch/web-oracle/`.

## Oracles

**Paint** (`web-paint.json`, 430 cases, one PNG each):
- matrix (360): theme × direction × density 0…−4 × selected × icons (none, icons, selected only) × rest/disabled/soft-disabled;
- hooks (32): all twelve hooks together × theme × direction × selected × icons × rest/disabled;
- single (24): each hook alone, unselected and selected;
- parts (2): `track` (6px radius, background, border colour), `handle` (3px radius, colour, opacity .8), `icon`, `state-layer`;
- slots (2): a 16×16 `currentColor` element in `selected-icon` / `unselected-icon`;
- focus (5): `setFocus()` light/dark × selected and soft-disabled;
- validation (4): `required` / custom message × LTR/RTL after `reportValidity()`;
- hidden (1).

Each case records the host, track, handle container, state layer, handle, icon, slotted and support
boxes, computed colours, radii, outline, role/ARIA and tab index.

**States** (`web-states.json`, 13 runs; `web-states-reduced.json`, the four pointer runs with
`prefers-reduced-motion: reduce`): hover, press, release, leave, Tab focus (from a preceding
button), Space, Space, Enter, Tab away, for light/dark, LTR/RTL, unselected/selected, with and
without icons, all hooks, density −4, soft and hard disabled, a cancelled `mdInput`, a form reset
and press-hold-move-off (`drag-off`: press, four frames, then move 60px down). Every animation
frame of every phase is sampled — including the frames while the step's input is delivered —
with container position, handle box, handle/track/outline colours, state-layer opacity/display,
icon, classes and `aria-checked`, plus a rest sample, the CSS animations started, events with
times (`focus`, `blur`, `pointerleave`, `mdInput`, `mdChange` with `defaultPrevented`, `reset`) and
a PNG per phase. Samples and events share one time base (`performance.now()`).

## Native renderers

- Swift: `AWCNativeSwitch` (`NativeSwitch.swift`) with `AWCSwitchAppearance` /
  `AWCSwitchPartAppearance` (`SwitchAppearance.swift`), dispatched for `md-switch` in
  `AWCNativeView` in place of the generic `checkControl`; UIKit and AppKit share the view, with the
  focus bridge providing keyboard focus, Space routing and accessibility.
- Compose: `NativeSwitch` (`NativeSwitch.kt`) with `AWCSwitchAppearance`, `AWCSwitchPartAppearance`,
  `AWCSwitchAppearanceScope`, `AWCSwitchPartAppearanceScope`, `AWCSelectionReducedMotionScope` and
  `AWCSwitchInspectionScope`, dispatched for `md-switch` in `AWCComponent` in place of the Material
  `Switch` adapter.

Both follow the source cascade rule by rule; transitions use the CSS transition model
(retargeting, reversal shortening) on the frame clock, starting in the frame that first renders a
change.

## Acceptance tests

- macOS: `NativeSwitchPaintIntegration` (every paint case: boxes ±0.6, colours premultiplied ±0.012,
  focus ring, tab index, every flat pixel of the clip) and `NativeSwitchStatesIntegration` (each
  rendered frame compared at its render time with Chrome's samples within ±2 frames and a monotone
  envelope across sample gaps; events, cancellation, settle values and phase paint).
- Android: `NativeSwitchParityTest` and `NativeSwitchInteractionTest` with byte-identical assets
  (`SwitchWebPaint`, `SwitchWebStates`, `SwitchWebStatesReduced`) on the test clock, with real
  mouse and key injection at Chrome's event times.
