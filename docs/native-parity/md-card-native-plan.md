# Card native implementation plan and Chrome oracles

Status: preparation only. The native implementation, Laboratory integration and acceptance are still
pending. The contract comes from `packages/core/src/components/md-card/` (tsx/css/tests) and the
[source review](md-card-source-review.md). The oracles were captured on 2026-10-23 with Chrome 153
headless, a 1200×900 viewport, DPR 1 and trusted CDP input. Files are in
`outputs/native-parity/md-card/web-oracle/`; `oracle-manifest.json` holds the hashes and commands.

## Contract inventory

**Properties**

| Property | Default | Values and behaviour |
| --- | --- | --- |
| `variant` | `elevated` | `elevated`, `filled`, `outlined` |
| `interactive` | false | Reflected. |
| `dragEnabled` | false | Reflected as `drag-enabled`. |
| `disabled` | false | Reflected. Visual only when interactive, but it also blocks drag on any card. |
| `softDisabled` | false | Reflected as `soft-disabled`. Same scope as `disabled`. |
| `ripple` | true | Applies when interactive **or** drag-enabled. |
| `fullWidth` / `fullHeight` | false | Set 100% on that axis; min/max hooks still apply. |
| `density` | 0 | 0…−4. Local value wins over an inherited `[data-density]`. |

**Events**
- `mdClick` carries the original `MouseEvent`.
  - Pointer clicks are trusted (button 0, detail 1, client point).
  - Keyboard Enter/Space calls `el.click()`: an untrusted click with detail 0 and client point (0,0).
  - Nothing is emitted when disabled, when soft-disabled, or in the frame after a drag release.
  - It is **also** emitted when an authored inner control is clicked or keyboard-activated, because the card's handler does not check the click target.
- `mdDragStart`, `mdDragMove` and `mdDragEnd` share one detail: `{clientX, clientY, offsetX, offsetY, startX, startY}` in viewport px.
  - Start fires once, when the Manhattan distance first reaches ≥ 5, immediately followed by a move with the same detail.
  - End fires on pointerup only if a drag started.
  - Cancel and lost capture abort silently.
  - The drag accepts only one primary pointer with button 0.
  - It is not started from inside authored interactive content.
  - It is cancelled when disabled, soft-disabled or `dragEnabled=false` is set, or on disconnect, including re-entrantly from an `mdDragStart` handler.
  - While dragging, the host gets `translate(dx,dy)` prepended to the authored transform and `z-index: 1000`. Authored values and priorities are restored afterwards.

**Slots and methods.** One default slot with arbitrary content. No public methods.

**Semantics**
- `role="button"` and `tabindex` (0, or −1 when hard-disabled) only when interactive and the composed content (including open shadow roots) has no focusable/interactive control.
- `aria-disabled="true"` for interactive disabled or soft-disabled cards acting as a button.
- `aria-grabbed` is `false`, or `true` while dragging, when drag is enabled.
- Keyboard Enter/Space on the host itself triggers a centred ripple, then a click.

**CSS hooks (14)**
- Defaults:
  - container color: surface-container-low (elevated), surface-container-highest (filled), surface (outlined)
  - container shape: 12px. The token wins at every density.
  - container elevation: e1 (elevated), none otherwise
  - outline color: outline-variant; outline width: 1px
  - state-layer color: on-surface
  - width / min / max: auto / auto / none; height / min / max: auto / auto / none
  - padding: max(8, 16+2d); gap: max(4, 8+d)
- Internal: body-medium typography with size max(12, 14+.5d), line-height max(16, 20+d) and 0.25 tracking. Overflow is clipped and the layout is a column flex.

**Parts.** `state-layer` exists when interactive or draggable. `outline` exists for the outlined variant and is painted *above* authored content, like the state layer (z-index 1) and the ripple.

**States**

| State | State layer | Elevation (elevated / filled+outlined) |
| --- | --- | --- |
| hover | .08 | e2 / e1 |
| focus-visible | .12 | e1 / none |
| :active | .12 | e1 / none |
| dragged class | .16 | e4 / e3 |

- Outlined focus-visible turns the border on-surface.
- The focus ring is 3px secondary at a 2px offset. It shows for soft-disabled cards too.
- Disabled (interactive): container color is on-surface 12% over transparent, content on-surface 38%, no elevation (`!important`), border on-surface 12%.
  - Hard-disabled also gets `pointer-events: none`.
  - Soft-disabled hides the state layer (display none) but stays focusable.
- Custom elevation hooks are overridden by every state rule.

**Motion**
- box-shadow and background-color: short2 = 100ms, standard easing cubic-bezier(.2,0,0,1).
- State-layer opacity: short1 = 50ms, same easing.
- Reduced motion removes both; the ripple still animates (450ms grow, 150ms fade).
- Ripple: origin at the physical pointer position; radius to the farthest corner; scale 0→1 over 450ms at 0.12 opacity.
  - It is held while pressed and fades 150ms after release once growth ends.
  - Keyboard triggers a centred wave that releases automatically.
  - The color is the card's currentColor.
- Forced-colors rules are source-reviewed only.

## Current native state

**Swift.** `Presentation.swift` `card`, the generic adapter, provides:
- `VStack` with `padding(20)` and spacing `max(4, 12+2d)`
- radius 20; `theme.surface` for every variant
- outlined stroke in primary at 30%; shadow black 8% with radius 5
- invented slots media/headline/supporting-text/actions; `mdClick` on tap

Gaps against the contract:
- every variant color and shape; padding/gap/typography density; all 14 hooks; both parts
- fullHeight and min/max sizing; clipping and the layer order of outline/state-layer above content
- state layers and elevation transitions, focus ring, ripple, keyboard activation and focus semantics
- the role/tabindex rules for nested interactive content
- disabled and soft-disabled visuals and behaviour
- the whole drag contract (threshold, translate/z-index, events, click suppression, cancellation)
- reduced motion and dark elevations

**Android.** `AWCComponent.kt` `md-card` uses Material3 Card/OutlinedCard/ElevatedCard with radius 16dp and no padding. Interactive cards use `Card(onClick)` and ignore the variant. Gaps: the same list as Swift, plus density, which is not read at all. Material default colors and elevations differ from the source tokens.

**Support metadata is stale**
- `NativeSupport.json` and `support.json` declare `adapter-implemented` with drag, ripple and fullHeight (iOS) or density (Android) unsupported.
- The compiler IR `md-card.json` records source sha `420f71e5…`, which no longer matches `md-card.tsx` (`79f4bf82…`), so it must be regenerated.

**Reusable infrastructure (Swift)**
- `AWCNativeButtonRipple` (NativeButton.swift; use `honorsReducedMotion: false` to match md-ripple)
- `AWCNativeBoxShadow` / `AWCBoxShadow` (BoxShadow.swift; interpolation and blur r = b/√2 verified against Chrome by the accordion floating test)
- `AWCCornerShape` / `AWCNativeCornerShape` for asymmetric elliptical radii
- `AWCCSSTransitionTrack` / `AWCCSSColorTrack` (CSS transition retarget/reversal)
- `AWCNativePointerState`, `awcInspect` (with multi-node rootID `"a|b"`), `AWCButtonFocusHandle` / `AWCNativeButtonFocusBridge`
- `awcNativeDensity` / `AWCNativeDensity`
- the accordion chassis pointer pattern for viewport-coordinate drags (`AccordionFloating.swift`)

**Reusable infrastructure (Android)**
- `nativeSourceRipple` / `nativeKeyboardRipple` (AWCNativeRipple.kt)
- `AWCBoxShadow` / `NativeShadowLayer` / `Modifier.accordionShadow` (σ verified by the floating test)
- `AWCCornerShape`, `AWCDensityScope`, `inspectAWCNode`, `AWCButtonFocus`
- `NativeAccordionFloating.kt`'s captured-pointer handling, which also fixes Compose's Exit-as-first-move issue

## Implementation plan (both platforms)

1. Add a dedicated `AWCNativeCard`/`NativeCard` renderer and `AWCCardAppearance` with the 14 hooks. Use the same field names on both platforms:
   - containerColor, containerShape, containerElevation, outlineColor, outlineWidth, stateLayerColor
   - width/minWidth/maxWidth and height/minHeight/maxHeight as affine lengths with percentage of the proposed parent size
   - padding (insets), gap

   Add `AWCCardPartAppearance` for the `state-layer` and `outline` parts. Resolve from theme tokens, never Material defaults.
2. Layout:
   - a column with gap and padding, and body-medium density typography inherited by authored text
   - sizing order: CSS min wins over max; full* = 100% of the parent proposal, capped by min/max
   - clip to the shape. Zero-size still includes padding. Hidden means zero.
   - outline and state layer drawn above content; the outline inset inside the same geometry
3. State machine:
   - hover, focus-visible, pressed and dragged inputs. Pressed outranks dragged while the pointer is held, which matches Chrome.
   - state-layer opacity on a 50ms CSS transition; elevation and container colour on 100ms; both instant under reduced motion
   - the ripple is unaffected by reduced motion
   - soft-disabled hides the layer; hard-disabled ignores the pointer
   - role/tabindex/focusability from the inspected composed content. Native equivalent: a scope that knows whether authored slot content contains focusable controls; expose an explicit override because native view trees cannot be introspected like the DOM.
4. Drag:
   - one primary pointer, Manhattan threshold 5, viewport client coordinates (reuse the accordion viewport/pointer capture)
   - `translate` plus raised z-index while dragging; restore afterwards
   - start, then move with the same detail; end only after a start; click suppression for one frame; silent cancel paths
   - cancel on disable / dragEnabled=false / disappear, including from inside the start callback
   - authored controls keep their own gestures
5. Activation: keyboard Enter/Space on the card itself gives a centred ripple and `mdClick` with keyboard metadata. Inner controls bubble `mdClick` like Chrome; document this as source behaviour.
6. Laboratory: a `card-appearance.js` module (14 fields, two parts); live hosts on both platforms; examples; updated support policies and regenerated IR.

## Oracle → contract coverage

**`web-paint.json`** (448 cases, 447 PNGs; `paint.html`). Each case records the host rect and the computed style (padding, gap, radii, colors, shadow, typography, focus outline, cursor, transitions), attrs (role/tabindex/aria-*), state-layer and outline part boxes and styles, ripple presence, child rects with inherited typography, and scroll size.
- **matrix (360):** 3 variants × light/dark × LTR/RTL × 5 densities × {plain, interactive, disabled, softDisabled, non-interactive disabled+softDisabled (no visuals), dragEnabled}.
  - Covers: variant tokens and dark elevations; density padding/gap/typography with the radius held at 12; disabled/soft-disabled paint and semantics; aria-grabbed; part presence; RTL text alignment with physical geometry.
- **hooks (48):** all 14 hooks × 3 variants × themes × directions × {plain, interactive, disabled, softDisabled}. Shows that disabled rules override the color and elevation hooks.
- **single-hook (14):** each hook alone, including min > max conflicts.
- **parts (1):** `::part(outline)` and `::part(state-layer)` styling.
- **layout (25):**
  - fullWidth × fullHeight; capped 260×200; calc/percent 248×144; min wins (250×190); zero size 32×32; empty 320×32
  - overflow clip at 70px height; hidden
  - inherited density (−4: 320×114) and local density winning (−1: 320×132)
  - wrapping at 160px in LTR/RTL
  - media composition with a full-bleed block clipped by the corners, plus md-button actions, in 3 variants × LTR/RTL
  - nested button / generic focusable / authored content semantics

  `authoredControls: true` marks cases whose authored UA controls must be masked in native paint comparisons.

**`web-states.json`** (57 runs, 315 phases, 7,038 frame samples, 315 PNGs; `states.html`). Every frame records state-layer display/opacity/color, host box-shadow/background/color/transform/z-index, the focus ring, the outlined border color, and every ripple wave (box, opacity, scale, color). Each run also records transition and animation records (target, property, start, duration, easing, from/to) and events with timestamps.
- **pointer** (hover/press/release/leave) and **keyboard** (Tab focus, Enter, Space, Tab away) for 3 variants × 2 themes. Covers state layers, elevation transitions (100ms / 50ms), the ripple's physical origin, radius 259.24, 450ms grow and 150ms fade, the untrusted keyboard mdClick, the focus ring and the outlined focus border.
- **drag** (hover, press, 4px creep with no start, 18px start, three moves, release, leave) and **dragClick** (drag release suppresses mdClick; the next click emits it). Covers threshold, payloads, translate, z-index 1000, aria-grabbed, and the held ripple during the drag.
- **rippleOff** (no waves).
- **softDisabled**: no layer, no ripple, a prevented click, focusable with the ring, Enter inert.
- **disabled**: no hover, skipped by Tab.
- **nested**: background press emits mdClick and a ripple; an inner-button press also ripples the card and emits card mdClick; Tab focuses the inner button; Enter on the inner button emits card mdClick.
- **custom** hooks, 3 variants: the state elevation overrides the hook, and the custom state-layer color.
- **RTL** pointer and drag, 3 variants.

**`web-states-reduced.json`** (9 runs, 45 phases, 1,071 samples, 45 PNGs) uses `prefers-reduced-motion: reduce`. The host and state-layer transitions are removed and the values are instant; ripple animations still run.

**Lifecycle.** Existing evidence (`web-lifecycle.json`, 18 synthetic scenarios) covers cancel and lost capture, re-entrant start handlers, authored-style restoration, shadow-root observation and reconnect. Native lifecycle tests should replay those scenarios.

## Source/CEM drift and findings

- **Dragged visuals never appear with physical input.**
  - `:host(.md-card--*.md-card--draggable:active)` (elevation) and `:host(.md-card--draggable:active) .md-card__state-layer` have higher specificity than the `.md-card--dragged` rules.
  - During a held trusted-mouse drag Chrome therefore paints .12 and the pressed elevation (e1 elevated, none filled/outlined), not .16 and e4/e3.
  - The source review's "drag uses .16 / elevation 4" came from synthetic events without `:active`.
  - Native must match the measured Chrome behaviour (pressed outranks dragged while held). The CSS intent should go to source review.
- **mdClick from inner controls.** Activating an authored inner control (pointer or keyboard) emits the card's `mdClick`. This is undocumented; the readme only mentions mouse clicks on the card.
- **Documentation scope.** "state-layer (interactive only)" in the CSS header comment and "ripple … when interactive" in the prop/readme text are both also true for drag-enabled cards. The readme parts list is already correct.
- **Stale IR.** The compiler IR source hash is stale (pre-fix source). CEM matches the source: 9 props, 4 events, 14 hooks, 2 parts, 1 slot.
- **Stale native metadata.** Both support policies predate the source fixes and claim adapter coverage that the adapters do not provide (for example Swift density, variant tokens).
- **Ripple and reduced motion.** md-ripple ignores reduced motion. This is consistent with the accordion finding.
