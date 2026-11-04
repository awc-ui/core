# Android Skeleton parity audit

Status: the dedicated renderer and public native APIs pass the focused Android
checkpoint. Integrated Laboratory review, independent final acceptance and iOS
runtime verification remain separate gates. This is not a claim that the whole
catalog is migrated or that every Android version has been verified.

## Source contract and implementation

Authority is the corrected Web `md-skeleton.tsx` and `.css`, the source review,
and the retained browser matrix under `outputs/native-parity/md-skeleton`.
All ten properties are implemented: variant, animation, lines, width, height,
fullWidth, fullHeight, ariaLabelProp, announce and density. The source has no
component events, slots or public methods; native equivalents are not invented.

`AWCSkeletonAppearance` and its scope implement all eleven hooks: color,
highlight, radius, roundedRadius, width, height, size, lineGap, pulseDuration,
waveDuration and bloomDuration. Colors preserve alpha. Physical corner shapes
preserve asymmetric and elliptical radii. `AWCSkeletonPartAppearanceScope`
styles Shape, Line or LineLast; final-line overrides cascade after the common
line override on the actual final row. Inspection reports real root and part
rectangles, including zero-size geometry.

`AWCSkeletonLength` retains points, fraction, em, rem and ch coefficients until
layout. Its parser accepts px, %, em, rem, ch and additive calc expressions.
Property dimensions override hooks; full width wins over a fixed width. A
percentage child height stays indefinite unless the source would establish a
definite host height. Full-height circle precedence, auto-height fallback,
text-row shrinking, logical-start taper and inherited/local density follow the
measured source. `AWCSkeletonSizingContext` explicitly supplies font sizes,
optional measured zero-glyph advance and definite parent height. The default ch
advance comes from the actual bundled Roboto glyph. Font sizes use native sp.

The Laboratory supplies a real 260×160dp parent, aligned at top/logical start,
with parentHeight=160 and a 16 sp context. The parent is sizing context, not a
fabricated Skeleton measurement. All eleven style fields reach the dedicated
renderer through the production preview request.

## Motion and native semantics

The native entrance retains source opacity and centered scale, including the
small spring overshoot, even when recurring animation is none. Pulse uses the
source half-cycle easing. Wave paints a clipped 200%-wide gradient with the
source stops, X skew and physical translation; effective RTL reverses the time
before easing. Custom durations include zero. Android animator preference
supplies reduced motion; the settled reduced state removes entrance and
recurring motion. Forced colors is an explicit native environment override and
uses the outline role, rather than treating increased contrast as CSS forced
colors.

Announced output has its real accessible name and polite native live region,
with explicit `AWCSkeletonBusyKey` metadata and no click action. Decorative
output removes the name and is hidden from accessibility. Android exposes no
direct Web status-role/aria-busy pair; the custom busy key is available to
native consumers and does not claim a platform screen reader busy property.
Real screen-reader announcement behavior has not been observed in this gate.
Hidden output removes layout, paint and inspector nodes. Remounting restores
the entrance without leaving a prior animation listener attached.

## Executed verification

Fourteen focused library unit methods pass. They include source integer row
conversion, affine sizing and overflow cancellation, precedence, indefinite
height, real final-row cascade, eleven-field appearance and 135 independent CSS
animation samples captured from 15 Web configurations at nine times.

Three actual Compose device methods pass: 212 mounted configurations
(106 per recorded theme), real root and part rectangles, alpha-composited paint,
accessible-name/live-region/decorative semantics, real entrance/pulse/shimmer
pixels, reduced/forced environment changes and hide/remount lifecycle. The
first actual shimmer check caught an X/Y matrix-index error that geometry and
math tests did not catch; it was corrected and the complete focused Skeleton
suite passed afterward. The failed first log remains available.

The matrix injects the exact recorded browser color roles. The browser fixture's
font route also loaded Laboratory styles, including a partial custom dark
palette. These 212 cases prove parity under those recorded palettes; they are
not independent default-theme certification. Geometry and source timing retain
their stated scope. Root/part geometry tolerance is 0.3 dp for native physical
rounding; sampled fill channels use 0.016. Captured CSS timing values use
0.00001 for opacity/phase and 0.000006 for scale.

The production live host additionally passes typed-field transport and actual
260×160dp parent checks, including a 120×72 text skeleton and 160×160 full-height
circle. Twenty-seven exact generated public Kotlin examples compile against
production APIs; temporary compilation sources were removed after byte
comparison. Source hashes, XML, logs and the exact copied examples are retained
in the component evidence directories.

## Explicit boundaries

Native Canvas, Compose layout, semantics and frame timing replace CSS and DOM;
no WebView or image recreation is used. Unsupported CSS grammar (var, min/max,
viewport units, multiplication and intrinsic sizing keywords) fails explicitly
instead of silently becoming absolute points. The typed APIs provide the
supported native sizing equivalent.

Layout caps at 32,766 physical pixels and real row allocation at 8,192 rows to
avoid invalid native constraints or unbounded allocation. Source integer
conversion is applied before that documented safety boundary. Accepted finite
length terms can cancel after intermediate overflow without creating NaN.
These limits do not claim Chromium's astronomical layout range. Pixel edge
antialiasing and system font scaling are native rendering concerns.

Verification ran on the available Android API 36 emulator. Laboratory review,
OS screen-reader behavior, additional Android versions and final independent
per-component acceptance remain explicit pending checks.

## Retained Laboratory edits and row-gap correction

The Android host now accepts strict updates for all ten source properties on the
existing mounted Skeleton. Two focused device host tests pass: updates acknowledge
the applied layout, preserve the completed entrance (real pixels remain opaque),
retain typed appearance, and reject malformed fields without replacing the session.
The actual measured text row gap is now present in inspector metadata; shape
variants report zero gap. Evidence and the updated APK/source hashes are in
`evidence/md-skeleton/retained-gap/`. Laboratory retake remains separate.

## Independent default-palette gate

A new212-case renderer matrix passes against the separate font-only default-palette
Web capture (106 per theme). This test passes no color token overrides to AWCTheme.
Actual default native paint and geometry match the fresh source fixtures; the old
Laboratory captured-token fixtures and evidence remain unchanged. Exact copied
fixture/source/APK hashes and device XML are in `evidence/md-skeleton/default-palette/`.
