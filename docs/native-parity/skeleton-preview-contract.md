# Skeleton shared preview contract

Status: source-backed shared controls, validation and copyable recipe generation
are implemented. Dedicated native renderers, native example compilation and
Laboratory acceptance are still pending. No support declaration is added by
this shared-code checkpoint.

## Appearance and length values

The eleven fields are `color`, `highlight`, `radius`, `roundedRadius`, `width`,
`height`, `size`, `lineGap`, `pulseDuration`, `waveDuration`, `bloomDuration`.
Transport keys are `skeletonAppearanceDefaults` and `skeletonAppearance`.
Defaults merge by field; only the matching Skeleton root accepts local styles.

Colors accept six- or eight-digit hex values. Both radii use the shared physical
`AWCCornerShape`, preserving asymmetric corners, elliptical axes and percentages.
Durations are finite, nonnegative seconds, including zero.

The four sizing/gap fields use `AWCSkeletonLength`:

```json
{"points":-32,"fraction":1,"em":0,"rem":0,"ch":0}
```

This represents `calc(100% - 32px)` without computing an assumed parent size.
Every coefficient is finite and signed; omitted coefficients become zero.
The renderer resolves terms using the actual parent and font context, then
applies the source property's used-value rules. It must avoid nonfinite
intermediate geometry for accepted finite coefficients.

The editor and native property validator accept `px`, `%`, `em`, `rem`, `ch`
and additive `calc()` expressions. Unitless standalone zero is accepted.
Other CSS grammar, including `var()`, multiplication, `min()`, viewport units
and intrinsic sizing keywords, is reported as unsupported for native
translation. Web properties remain CSS strings. No arbitrary CSS execution or
silent conversion to absolute points is claimed.

Property width/height override appearance values. Empty property strings use
their source defaults. Full width and full height preserve their source
precedence. An indefinite percentage height is distinct from a zero or definite
height; it must not be evaluated against an unrelated preview frame.

## Public sizing context and recipe

`AWCSkeletonSizingContext` contains `fontSize=16`, `rootFontSize=16`,
`zeroGlyphAdvance=nil`, and `parentHeight=nil`. A nil glyph advance measures
the real bundled Roboto regular zero glyph at the chosen font size. A different
native font requires its actual measured zero advance; SwiftUI's opaque Font
value is not falsely treated as an introspectable numeric size.

`parentHeight=nil` means an auto/indefinite containing block. A definite
container supplies its actual height explicitly, because a loose native layout
proposal alone does not encode CSS definiteness.

The shared Laboratory recipe is an actual 260×160 parent with a 16-unit font
context, child aligned at the top and logical start. Native snippets supply
`parentHeight=160` through `.awcSkeletonSizingContext(...)` or
`AWCSkeletonSizingContextScope(...)` and create the corresponding real parent.
Defaults are three text rows, wave animation and full width. The extra height
is deliberate context for editing full height; it is not component geometry.

## Parts and evidence

The source exposes `shape`, `line`, and `line-last`. Explicit source annotations
now make all three discoverable through normal CEM/docs/compiler generation.
The native API agreement is `AWCSkeletonPartAppearance(color, width, height,
cornerShape)` scoped to Shape, Line or LineLast. Line applies to every row;
LineLast merges afterward on the actual tapered row, without inventing a
duplicate measured part. These part overrides are separate from the eleven
component hooks.

The shared tests verify exact source-hook drift, relative length preservation,
malformed data rejection, zero and signed terms, all eleven controls, invalid
edit recovery, native request scope, all seven framework recipes and part
example gating. The corresponding logs and source hashes are retained in
`outputs/native-parity/md-skeleton/shared-evidence.json`.

The original Web oracle remains independent: 106 configurations per theme,
actual motion samples and 17 source tests. The added annotations change
documentation only; no Skeleton runtime behavior was modified by this shared
implementation. Native execution, copied-example compilation, both Laboratory
previews, iOS runtime and final independent acceptance were separate gates at
that historical shared checkpoint. Current results are recorded in the
[consolidated Skeleton audit](md-skeleton.md).

## Retained property updates

The strict shared `update` operation covers all ten source properties. It
validates variant/animation enums, finite line counts, canonical density rungs,
boolean flags and UTF-8 strings bounded to 4096 bytes. Relative width/height
strings remain authored strings. Updates preserve their ordered edges on one
mounted instance and do not invent events or restart the entrance animation.

Swift applies each patch to the retained root node and drains the actual
SwiftUI observation before acknowledging it. Android acknowledges a frame
committed with the matching property revision. Both native host handlers are
implemented and have focused runtime checks; the integrated Laboratory retake
is recorded separately. Styles, sizing context and explicit Reset retain their
deliberate configuration/remount path.

The retained shared transport suite passes 163 relevant checks across Skeleton,
Progress and Snackbar, including two focused Skeleton regressions. Exact scope,
command and hashes are in `outputs/native-parity/md-skeleton/retained-shared-evidence.json`.
