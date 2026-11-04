# Android `md-badge` parity record

Source: `packages/core/src/components/md-badge/md-badge.tsx` and `.css`. Native implementation: `NativeBadge.kt`, `AWCBadgeAppearance.kt`, direct IconButton slot composition and the live preview host.

## Implemented contract

- All six properties: variant, value, max, icon, shape and density. Small dots omit content; large badges use the source height/minimum-width and content-padding rules. Numeric strings follow finite ECMAScript Number parsing, including radix prefixes and exponent input. Values above max use the threshold plus sign; other values retain the first four UTF-16 units, with an unpaired surrogate represented by the native replacement character.
- Visible text follows CSS nowrap whitespace collapse, retaining nonbreaking spaces. The accessible name retains the displayed value before visual whitespace normalization. Small dots announce “notification”; an empty large value falls back to its icon name. Status changes use a polite native live region, without consuming the parent's activation.
- The actual parent supplies rectangular/circular physical top-right anchoring through `AWCBadgeHost`. Circular inset uses 14.6447% of each parent dimension, and offset fractions use the badge's own width/height. RTL retains physical anchoring but reverses inner content order. Direct IconButton badges share that placement calculation and keep their own size instead of taking the glyph slot size.
- A nested Badge inherits the resolved IconButton density when its own density is omitted or zero, matching the absence of a zero-density CSS override. Negative local rungs override inheritance. Height, icon size, typography and padding all use the resolved value.
- The real named icon slot supports arbitrary native content, multiple children and explicit empty replacements. A present empty element suppresses the fallback while retaining its icon-sized box. Small variant content is not laid out. `AWCMaterialSymbol` is a reusable typed glyph alternative.
- `AWCBadgeAppearanceScope` exposes all ten hooks: containerColor, labelColor, cornerRadius, iconColor, iconSize, offsetX, offsetY, largeHeight, largePadding and smallSize. `AWCBadgeOffset(points, fraction)` supports mixed native length/relative offsets; `AWCBadgePadding(top, right, bottom, left)` preserves physical four-side padding. Zero values and parent/local cascade are retained.
- Inspection is opt-in and publishes actual root/label/icon/slot bounds. Applied padding comes from the same rounded/clamped physical pixel values used by layout. A measured root marker publishes that evidence in the captured layout pass, preventing later metadata-only state changes from invalidating the frame. Zero-area nodes are omitted by the shared inspection contract.
- The Laboratory fixture uses a 48×48 notification IconButton and a separate Badge overlay. The host parses all ten fields, nested offset objects, padding arrays and real text/symbol slots; it merges defaults and local appearance and inspects only the Badge. The notification parent also receives explicit 48×48 appearance sizing.

## Verification evidence

- [Final device report](evidence/md-badge/device-results.xml): **7 methods passed**, no failures/errors/skips. Four Badge methods cover all 75 hydrated Web source fixtures, eight inherited-density states, polite status updates, parent activation, actual fractional/clamped padding and stable snapshot identity. Real Badge/Menu host tests and the affected direct IconButton slot regression also passed.
- The native unit suite passed **79 tests**, including [four Badge contract tests](evidence/md-badge/unit-contract-results.xml). Numeric parsing/formatting, UTF-16 slicing, whitespace, all ten typed hooks, coordinate calculation and density inheritance are covered. Fixture combinations are subcases, not additional JUnit methods.
- All 105 captured source/build inputs stayed unchanged throughout the final run: [hashes](evidence/md-badge/source-sha256.json), [verification and exact command](evidence/md-badge/verification.json), [Gradle output](evidence/md-badge/device-run.log). Full device geometry logs and all unit reports are retained in workspace `outputs/native-parity/md-badge/android/final/`.
- Eleven production-generated Kotlin Usage/API examples compiled with `:app:compileDebugKotlin`. Exact sources, hashes and compile evidence are retained in workspace `outputs/native-parity/md-badge/examples/`; temporary sources were removed afterward.
- Earlier failures remain under workspace `outputs/native-parity/md-badge/android/initial-unit/`, `first-device/` and `capture-fixed/`. They include a draft physical-coordinate rounding expectation, JSON-null slot decoding, the real post-layout inspection publication defect and a zero-height boundsInRoot test measurement. The final geometry test reads actual layout position/size for a zero-height box; no rendering dimension or tolerance was changed to hide that case.
- The final APK containing Badge and Menu was installed on the reserved Android 16 emulator. Browser integration verification remains a separate step.

## Inspection follow-up

The small dot now omits typography metadata because it renders no label. A
focused device regression verifies the small root has no typography or label
node, then switches to large and verifies real root/label typography returns.
Large-badge layout and paint are unchanged. This check passed in the Split
Button follow-up run recorded in [that audit](md-split-button.md).

## Explicit native boundaries

The source fixture containing two emoji uses the operating system's emoji font. Android Noto emoji measured 36.952dp versus 32px in the Mac Chrome reference; the test records this difference and asserts actual glyph width plus source padding and anchoring instead of pretending the fonts match. Other geometry cases retain their original strict tolerances. Native glyph rasterization is not claimed pixel-identical to browser paint.

Native layout coordinates are bounded to 32766 physical pixels for safe Compose measurement/placement; inspection reports applied geometry and applied padding. DOM/CSS objects and CSS selector access are replaced by actual Compose content, typed appearance and opt-in measured parts. No Badge events or methods are invented.
