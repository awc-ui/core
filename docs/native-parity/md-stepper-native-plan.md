# Stepper native implementation plan (md-stepper, md-step)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-stepper-source-review.md](md-stepper-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-stepper/web-oracle-cloud/`. Recapture it on the
  Mac (Chrome 153) before any native parity diff.

## Current adapters

**iOS** (`packages/native-ios/Sources/AWCUI/Containers.swift` `stepper`;
`md-stepper` and `md-step` both map to it in `AWCNativeView.swift`):

* **`md-stepper`** is a 12pt `VStack` of its unslotted children.
  * Each child is re-rendered with three derived properties:
    * `active = (index == active)`;
    * **`completed = autoComplete && active > index`**, which overrides an
      authored `completed`;
    * `_index`.
  * A child's `mdStepClick` changes the step when `!readOnly` and
    (`mode == "non-linear"` or `index <= active`).
  * With `nav`, a Back button (disabled at 0 or readonly) sits beside
    Next/Finish (`nextLabel` / `finishLabel`).
    * Finish emits `mdComplete`.
    * Next is disabled by `nextDisabled`, `loading` or readonly.
    * `loading` adds a `ProgressView`.
  * `changeStep` emits `mdBeforeChange`, then **sets unconditionally**, then
    emits `mdStepChange`.
* **`md-step`** is a `Button` row.
  * The glyph is an SF Symbol: exclamation, checkmark or circle.
  * The label is semibold with the description below; "Optional" is a
    literal.
  * The active step shows its content and the `errorText`, on a 12-radius
    surface tint.

**Android** (`packages/native-android/.../AWCNavigation.kt`
`NavigationComponent`):

* **`md-stepper`** is a 16dp `Column`: the default slot, then Back
  (`OutlinedButton`) and Next/Finish (`Button`).
  * Both buttons emit `mdBeforeChange` (not cancelable), then change
    through `NavigationScope`.
  * Finish emits `mdComplete`.
  * `readonly`, `nextDisabled` and `loading` disable the buttons.
* **`md-step`** registers its index in the scope.
  * Its row is clickable when `enabled && editable` (**`editable`
    defaults to true** here; the Web default is false). A click changes
    the step with no linear rule, and emits `mdStepClick {index}`.
  * The indicator is a `FilledTonalIconButton` showing the number or
    `check`. Label, description and error text follow.
  * The active step shows its slot plus its **own** Back and Continue
    `TextButton`s (`mdStepBack` / `mdStepNext`, then `change(index±1)`
    with no upper bound) **in both orientations**. A horizontal stepper
    therefore gets two nav bars.

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Layout | Horizontal row (connectors per gap, full-width panel or `content` slot, footer nav) or vertical rail (panels expand in place, per-step nav); `mobile` compact bar | Vertical list always; no connectors; no mobile bar | Vertical column always; no connectors; per-step and footer nav both shown |
| Indicator | Numbered 32/28/24 bubble (active springs to 1.12, halo) or 10/14 dot; check/error/custom icons | SF circle, checkmark, exclamation; no number, no dot | Tonal icon button with number or check; no error glyph, no dot |
| Connector | 4/3/2 thick, outline-variant track, primary fill, linear 350ms fill toward the active step, mirrored in RTL | None | None |
| Linear gating | Back is always allowed; forward needs the target completed, or every earlier step completed, optional or disabled (fix J); unreachable headers `aria-disabled` at .38 | `index <= active` only (cannot revisit a completed later step; ignores optional and disabled) | None: any step is clickable |
| Auto-complete | Forward completes passed non-disabled steps and clears errors; backward un-completes (editable exception); authored `completed` respected | Derived from `active` and overrides authored state | None |
| Validation | Cancelable `mdBeforeChange` for every user-driven move | Emitted but not cancelable | Emitted but not cancelable |
| Errors | `error` + `error-text`; error bubble and colours; assertive announcement, cleared when fixed (fix K) | Error glyph and text | Error text only |
| Nav | Back/Continue/Finish with labels; `loading` (spinner, Back disabled) and `next-disabled` gate Continue only; `nav=false`; `hide-actions` | Back/Next/Finish; loading spinner | Back/Next/Finish plus per-step Back/Continue; Continue unbounded |
| Lazy | Only the active panel is mounted | Only the active content is rendered | Only active |
| Read-only | No button semantics, no tab stops, full contrast, `aria-current` kept | Blocks clicks | Disables the buttons only |
| Semantics | Navigation landmark named by `label`; ordered list; header button with `aria-current=step`, `aria-expanded`; polite and assertive live regions with localized words | Container label only | `selected` on the row |
| Motion | Bubble spring 500ms `(.38,1.21,.22,1)`, colour 200ms `(.34,.8,.34,1)`, connector 350ms linear, panel expand 500ms spring / collapse 200ms `(.3,0,.8,.15)` | None | None |
| Reduced motion | All step motion off | n/a | n/a |
| Density / RTL | Indicator, type and connector taper; full mirroring | No | No |
| Events | `mdBeforeChange`, `mdStepChange {index, previous}`, `mdComplete`, `mdStepClick/Next/Back {index}` | All but Next/Back | All |

## Plan

1. **Shared stepper model** (both platforms, data-only and testable
   headless):
   * clamp `active`;
   * the reachability rule (fix J) and the auto-complete rules (forward,
     backward, editable);
   * `next()`/`prev()` skipping disabled steps;
   * a cancelable before-change hook;
   * the live-message builder ("Step N of M: Label[, Optional][,
     completed], current", and the error form), with the error message
     cleared when no step is in error (fix K).
2. **iOS `StepperView`.**
   * Horizontal: a `HStack` of headers, plus connector `Capsule`s whose
     fill is a `scaleEffect(x:)` anchored at the leading edge (mirrored by
     layout direction).
   * Vertical: a rail plus disclosure panels.
   * Mobile: a compact bar.
   * Indicator: a 32/28/24 circle, `.spring` approximating
     `(.38,1.21,.22,1)` to 1.12 on activation, halo ring, and a
     `contentTransition` for the glyph.
   * Connector: 350ms `.linear`. Panels: a spring expand and a 200ms
     accelerate collapse. All off under `accessibilityReduceMotion`.
   * Accessibility:
     * the container labelled by `label`;
     * headers with the button trait, a "current step" value and
       `.isSelected`;
     * unreachable headers disabled;
     * `UIAccessibility.post(.announcement)` for step changes and errors;
     * read-only drops the button trait.
   * Stop deriving `completed` from `active`.
3. **Android `Stepper`.**
   * The same anatomy in Compose: a `Row` with weighted steps and `Canvas`
     connectors, or a `Column` rail with `AnimatedVisibility` panels.
   * Remove the per-step nav in horizontal mode; keep it in vertical,
     honouring `hideActions`. Bound `change()` to the step count. Set the
     `editable` default to false. Apply the linear rule.
   * Semantics:
     * `Role.Button` headers with `stateDescription` ("current", "completed",
       "error"), and `disabled()` when unreachable;
     * `liveRegion = Polite` / `Assertive` text nodes for the two
       announcements;
     * `paneTitle` / heading for `label`.
   * Motion: `spring` for the bubble, `tween(350, LinearEasing)` for the
     connector, all gated by the reduced-motion setting.
4. **Native fixtures:**
   * orientation × indicator × theme × direction × density;
   * the mobile bar;
   * single states (editable, custom icons, all complete, last step,
     readonly, loading, next-disabled, nav off, non-linear, long labels,
     localized, hide-actions, error);
   * hooks and lazy.

   Diff against `paint.json`, then the state runs (nav, panels, linear and
   non-linear clicks, disabled skip, keyboard, cancel, loading, error
   announce, methods, mobile) against `states.json` and
   `states-reduced.json`.

## Open decisions to settle before native work

Completion on initial `active`, linear `next()` gating, non-linear
auto-complete, Space on keydown and `reset()` vetoing. All five are listed
in the source review.
