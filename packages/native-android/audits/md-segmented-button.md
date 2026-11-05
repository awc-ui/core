# Android `md-segmented-button` and Set parity record

Source: `packages/core/src/components/md-segmented-button/` and `md-segmented-button-set/`. Native implementation: `NativeSegmentedButton.kt`, `NativeSegmentedSet.kt`, `AWCSegmentedButtonAppearance.kt`, authored-text registration and the live preview host.

## Implemented contract

- All 13 segment properties and both set properties are implemented. A standalone segment emits a proposed selection without changing its controlled `selected` value. The set commits by child identity, preserves duplicate/empty values and emits even when the resulting selection is unchanged. Initial multiple selected children are not silently normalized in a single-select set.
- The segment's `mdSegmentClick` target notification precedes the parent commit. The set stops further propagation of that internal proposal, then emits `mdChange` with the exact ordered array of selected values. Preventing default does not veto the source's set commit; stopping the proposal before the set receives it does. Native `onEvent` receives the array directly. Scoped `AWCActionEvent.rawDetail` preserves the same shape, and `segmentedSelectionValues` provides a typed accessor; the existing map-shaped `detail` remains a compatibility view.
- Actual authored descendant order drives keyboard movement and values. Retained keyed moves, wrappers, removal and nested membership retain identity. Right/Down advance and Left/Up retreat even in RTL. Hard-disabled children are skipped; soft-disabled children remain focusable but block activation. Single-select arrows activate the next child, while multiselect arrows only move focus. Enter/Space activate once on keydown.
- Native radio/checkbox roles, selected/enabled semantics, real focus, keyboard focus rings, hover/press layers and the optional ripple reflect the source behavior. The native reduced-motion policy removes animated state transitions.
- The joined row uses equal grid tracks and the source's final-child outline overlap. Corner ownership, RTL, retained leading/trailing checkmark space, density typography, inherited inset tokens and all five density rungs follow the hydrated Web fixtures. An explicit local density is resolved separately from the parent's segment-density class.
- Default and named icon slots contain real composables. The named icon is additive to the property/checkmark graphic; it does not replace it. A nonempty property label masks retained default content. Initial authored text, including named icon text, controls the source's initial label-wrapper decision; later text mutation does not rewrite that initial flag. `AWCSlotText` and `AWCMaterialSymbol` register their actual source strings. `AWCSearchableLabelScope` supplies the explicit counterpart for arbitrary native content.
- `AWCSegmentedButtonAppearanceScope` exposes containerColor, selectedContainerColor, labelColor, selectedLabelColor, outlineColor, cornerRadius and iconSize. Inherited defaults and local overrides preserve explicit zero. Lengths are dp; colors use the shared six-digit hex contract.
- Opt-in inspection publishes actual root and rendered part bounds, including state-layer, checkmark, icon and label. Applied padding is reported from physical rounded layout values. Zero-area nodes are omitted by the shared inspection contract rather than presented as visible parts.
- The Laboratory supports standalone and three-child set contexts, ordered Boolean selection, real additive text/symbol slots and a local appearance override on the first edited segment. `AWCSegmentedButtonSetStateScope` reads actual child state; the frame publishes that state only when it remains correlated with the captured layout. Event attribution retains the actual segment/set tag and node identity.

## Verification evidence

- [Final device report](evidence/md-segmented-button/device-results.xml): **6 methods passed**, with no failures/errors/skips. Five renderer methods cover all 35 hydrated Web fixture subcases, controlled/committed selection, exact payload/order/cancellation behavior, physical keyboard direction, retained reorder, initial authored-text lifecycle and actual seven-hook paint. The sixth method exercises the real live-host context, input, event and captured-state protocol.
- The native unit suite passed **86 tests**, including [7 Segmented contract methods](evidence/md-segmented-button/unit-contract-results.xml). Contract checks cover typed hooks, whitespace, exact raw arrays, density/inset cascade, identity selection, keyboard movement and nested/public state lifecycles. Fixture combinations are subcases, not additional JUnit methods.
- [Two affected Menu/Badge device regressions](evidence/md-segmented-button/slot-regression-results.xml) passed after the shared authored-text registration changes. Their [command and result](evidence/md-segmented-button/slot-regression-verification.json) are retained separately from the Segmented run.
- All 99 captured source/build inputs stayed unchanged during the final Segmented run: [hashes](evidence/md-segmented-button/source-sha256.json), [verification and exact command](evidence/md-segmented-button/verification.json), [Gradle output](evidence/md-segmented-button/device-run.log). Full fixture logs and all unit reports are retained in workspace `outputs/native-parity/md-segmented-button/android/final/`.
- Twenty production-generated Kotlin Usage/API examples compiled during the final build. Exact sources, hashes and compile evidence are retained in workspace `outputs/native-parity/md-segmented-button/examples/`; the temporary source was removed before the final APK.
- The first device attempt remains under workspace `outputs/native-parity/md-segmented-button/android/first-device/`, with four failed test methods. The failures were strict requested-padding assertions at the emulator's different pixel density, a semantics matcher targeting an outer wrapper, and expecting a zero-area inspection node. The final fixture environment explicitly matches the Web oracle's DPR 2; semantics target the actual control; the empty-label case asserts its reserved layout gap and subsequent visible part. Geometry tolerances were not widened.
- Independent review identified initial named-slot text semantics; the final dedicated lifecycle regression covers the correction. No remaining concrete review blocker was reported. [Final clean APK build](evidence/md-segmented-button/final-build.log) and [installation](evidence/md-segmented-button/final-install.log) succeeded. Laboratory browser verification is a separate step.

## Narrow-width and state-token follow-up

The additional twelve hydrated Web fixtures now pass on Android, alongside a
rerun of the original 35 fixtures. Grid tracks freeze at each segment's actual
padding floor before distributing remaining space. When those floors exceed the
host width, the children retain the source's overflow and final-child overlap.
RTL reverses placement without changing authored order. CSS corner radii use one
proportional overlap scale; a single rounded end on a 24×40 segment retains its
20px radius instead of incorrectly clamping to 12.

The unit suite now includes the track/radius regression. A native pixel test
also verifies the installed .08 hover and .12 focus/press opacity tokens,
correcting the earlier hardcoded fallback. Evidence is preserved with the
Split Button follow-up under `outputs/native-parity/md-split-button/android/`
and [its audit](md-split-button.md); no original fixture or tolerance was changed.

## Explicit native boundaries

Native font shaping, glyph rasterization and physical pixel rounding are not claimed identical to browser painting. Geometry assertions retain their original tolerances, with actual bundled Roboto typography and matching source density.

Compose content lambdas do not expose arbitrary DOM `textContent`. Public authored-text registration supplies that information without inspecting unrelated native nodes or inventing a string. DOM events, CSS selectors and browser objects are replaced by actual native event phases, typed appearance and measured part metadata. No segment or set methods are invented.
