# Android `md-split-button` parity record

Source: `packages/core/src/components/md-split-button/md-split-button.tsx` and `.css`.
Native implementation: `NativeSplitButton.kt`, `AWCSplitButtonAppearance.kt`,
`AWCPopupScope.kt` and the live preview adapter.

## Implemented contract

- All fourteen properties are implemented: variant, size, disabled, softDisabled,
  icon, label, trailingIcon, trailingChecked, menuLabel, haspopup, controls,
  fullWidth, ripple and density. Five sizes and five density rungs follow the
  source's separate leading/trailing glyph sizes, padding and typography.
  Density zero/absence inherits the actual ancestor density.
- The halves have independent native focus, hover, press and optional ripple.
  Hard-disabled removes focus eligibility; soft-disabled retains focus while
  blocking activation. Enter and Space activate once on keydown. Keyboard focus
  and pointer focus use their actual input origin.
- `mdLeadingClick` callback detail is null; `mdTrailingClick` detail is exactly
  `{ checked }`, emitted after updating the mutable trailing state. Canceling
  either notification does not reverse the source's committed behavior.
  Scoped `AWCActionEvent.rawDetail` retains the same null/object shape; its
  existing map-shaped compatibility detail is empty for the leading action.
  Activation metadata describes actual native input, not an invented DOM event.
- `AWCSplitButtonStateScope` reads committed state. The Laboratory frame exposes
  `splitButtonChecked` only when it remains correlated with the captured native
  layout; configured `trailingChecked` remains an input. An unrelated property
  change does not reset an internally committed toggle.
- Default content is additive after the optional leading icon and property
  label. Retained content stays mounted across label/style updates. Glyphs are
  decorative; arbitrary authored content retains its own semantics.
- The six typed hooks are containerColor, labelColor, iconColor, outlineColor,
  cornerRadius and iconSize. Defaults and local overrides preserve explicit
  zero. The icon-size hook affects only the leading glyph. Outlined remains
  transparent despite an authored container hook; disabled paint overrides
  enabled custom colors. Full width grows the leading half while the trailing
  half retains intrinsic width.
- Logical corners and padding mirror in RTL. The checked trailing half becomes
  a pill and rotates its glyph. Shape/rotation use the source's 200ms standard
  easing and state opacity uses 100ms with the installed token values, including
  .12 focus/press and .08 hover. Native reduced-motion disables these transitions.
  The source's asymmetric shape-morph opt-out is retained through
  `AWCSplitButtonShapeMorphScope`.
- Seven measured parts expose leading, trailing, both state layers, leading icon,
  label and trailing icon. Inspector padding/border use the physical rounded
  values that layout and paint actually apply, including fractional device
  density. No requested one-dp value is misreported after physical rounding.
- `AWCPopupScope` connects controls IDs to actual `AWCPopupTargetScope` instances.
  The trailing action exposes its label, expanded state and popup kind, and an
  accessibility focus action only while the referenced target is mounted.
  This moves real native focus without creating or opening a menu. The component
  has no invented imperative methods.

## Verification evidence

- The [primary focused run](evidence/md-split-button/primary-device-results.xml)
  executed **98 unit cases** with zero failures,
  including six Split Button contract tests. Its **11 device methods had ten
  passes and one test-locator failure**. The corrected state-layer pixel method
  then [passed on its own](evidence/md-split-button/state-layer-results.xml).
  These results are retained separately; the initial
  report is not rewritten as a green combined run.
- Device coverage includes all **50 hydrated Web fixture subcases**, independent
  pointer/keyboard actions, post-commit cancellation/state, real popup target
  focus, all six appearance hooks, retained additive content, painted hover/
  focus/press, fractional-density border layout/paint/inspection, and actual
  live-host events and captured state. Fixture combinations are subcases, not
  extra JUnit methods.
- The same primary run passed the original 35 Segmented source fixtures, all
  twelve new narrow-grid fixtures, small Badge inspection, and the real Menu
  lifecycle regression. The painted state-layer method also verifies the
  Segmented installed opacity tokens.
- All 120 captured inputs, including the sixteen generated Kotlin examples,
  stayed unchanged during the primary run. Sources, report XML, logs, exact
  commands and hashes are retained under
  `outputs/native-parity/md-split-button/android/`. The focused pixel rerun only
  changed the test locator to the actual Segmented control node.
- Sixteen production-generated Usage/API examples compiled successfully.
  Their exact source, hashes, compiler output and command are retained in
  `outputs/native-parity/md-split-button/examples/`; temporary sources were
  removed before the deliverable APK.
- Earlier reports remain in `first-device`, `popup-focus`, `overlay-first`,
  `overlay-focus-first` and `overlay-and-menu`. They preserve test synchronization,
  mouse/touch input sequencing, a legitimate native focus move caused by the test's
  Right-arrow probe, and the Segmented semantics-locator correction. No geometry
  or color tolerance was widened to hide a failure.
- Independent review identified the fractional-density border discrepancy;
  the final physical-border regression covers the correction. No further
  concrete Android Split Button blocker was reported. Browser integration
  verification remains a separate step.
- [Exact commands, report totals and APK hash](evidence/md-split-button/verification.json),
  [primary inputs](evidence/md-split-button/primary-source-sha256.json) and
  [final source hashes](evidence/md-split-button/final-source-sha256.json) are
  retained in this repository. The [final build](evidence/md-split-button/final-build.log)
  and [APK installation](evidence/md-split-button/final-install.log) succeeded.
  That final build also passed the Menu host regression after naming its
  measured viewport “md-fab-menu overlay”; it did not alter those bounds.

## Explicit native boundaries

Native text shaping, glyph rasterization and elevation shadows are not claimed
pixel-identical to Chrome. Geometry checks use bundled Roboto and the source
density, with declared fixed tolerances. Android accessibility exposes actual
native focus, expanded state and target actions rather than browser ARIA objects.
Scoped typed appearance and measured parts replace CSS selector/DOM access.
Automated semantics checks do not constitute a manual TalkBack audit.
