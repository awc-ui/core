# Android Meter parity audit

Status: dedicated renderer, public appearance, native formatting and Laboratory
adapter implemented. Focused Android verification passes with the explicitly
excluded Arabic glyph-width comparison below. Integrated Android Laboratory QA and independent review passed, with the
explicit Arabic fallback-width boundary retained. This is not a claim of universal
pixel-identical rendering or of testing every Android OS version.

## Source and public contract

Authority: `packages/core/src/components/md-meter/md-meter.tsx` and `.css`,
`docs/native-parity/md-meter-source-review.md`, the 98 hydrated browser fixtures
per theme in `outputs/native-parity/md-meter/web-{light,dark}.json`, and the
separate three-case `web-overflow.json` captured from actual Chrome DOM.

The native implementation accepts all fourteen properties: value, min, max,
label, showLabel, showValue, valueText, locale, formatOptions, color, variant,
size, thickness and density. There are no source events, methods or slots.
`AWCMeterAppearance` / `AWCMeterAppearanceScope` expose the seven source hooks:
indicatorColor, trackColor, trackShape, height, labelColor, valueColor and size.
The five measured visual parts are track, indicator, label, value and circular.

Finite bounds/value are sanitized and clamped once for geometry, formatting and
semantics. Empty/inverted ranges are zero percent. Opposite-sign extreme finite
bounds use scaled subtraction, matching the corrected source, so the full
finite range produces 0/25/50/75/100 rather than NaN.

Linear layout fills its native parent, keeps the label/value baseline, ellipsizes
the label before shrinking the value, and places a value-only header at inline
start. RTL mirrors the fill and header. Circular layout retains its intrinsic
box, captions up to twice the diameter, clockwise arcs in both directions and
independent user-unit stroke geometry. Zero viewport paths measure zero; the
browser's residual unpainted SVG user-space bounds are not fabricated as native
layout. Fractional path transforms reflect the actual drawn circle, avoiding
compound integer-centering errors in inspection.

Text uses the same bundled Roboto font data as Web. Actual native shaped run
advances determine its content box; Compose intrinsic-width guard pixels do not
inflate it. Fixed line boxes do not expand when a fallback font has taller glyphs.
Unbroken centered values overflow symmetrically beyond the ring; unbroken
captions overflow from inline start. Only ring paint is clipped to the viewport.

## Formatting and accessibility

`NativeMeterFormat` uses public Android ICU APIs. Modern NumberFormatter is used
on API30+, with DecimalFormat/CompactDecimalFormat/MeasureFormat on API26–29.
Options include decimal/percent/currency/unit styles, localized grouping,
numbering system, compact/scientific/engineering notation, integer/fraction/
significant precision, rounding priority/increment/mode, trailing-zero policy,
and sign/accounting behavior. Decisions depending on zero or integer status use
the rounded native result. Invalid combinations preserve the source fallback.
No JavaScript runtime, remote formatter, WebView or Laboratory-formatted strings
are used. The fallback raw number representation uses a shortest decimal that
round-trips to the actual Double, including subnormal and exponential cases.

The source host's read-only range maps to Android range semantics and a formatted
state description. `AWCMeterRangeKey` additionally preserves the exact Double
range because the platform accessibility range API uses Float. Visual children
have no duplicate announcement. No default focus target, action, indeterminate
state, live activity announcement or synthetic event is added.

The source's 300ms value transition and 200ms arc opacity use the shared native
frame clock. Reduced motion disables them. Explicit forced-colors environment
mapping uses native onSurface/outline; increased Android contrast is not claimed
to be the browser's CSS forced-color mode.

## Verification

Final recorded command used Java23.0.1 and the existing Android SDK, on emulator
5554 running Android16:

```
./gradlew :native-ui:testDebugUnitTest :app:connectedDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=dev.awc.playground.NativeMeterFormatTest,dev.awc.playground.NativeMeterParityTest,dev.awc.playground.LivePreviewHostTest#meterUsesActual300DpParentAndTypedStylesWithCustomAlphaRoles \
  --console=plain
```

- 106 native unit cases passed, including three new Meter contract methods.
- Six focused device methods passed. The main renderer method checks 196 browser
  configurations, exact formatted/range semantics, root/part geometry and actual
  linear color pixels. Geometry tolerance is 0.51dp physical rounding; RGB
  comparison tolerance is 0.02 for raster/compositing quantization. These were
  not widened to hide failures.
- 75 independently generated en-US Intl cases are checked through six native
  API-compatibility branches (26,28,30,33,34,36): 450 exact output comparisons.
  This executes every branch on the current device's ICU, not six historical OS
  images. Locale data on older Android releases has not been independently
  certified. The oracle records Node22/ICU78.2/CLDR48 separately from Chrome DOM
  evidence.
- Three separately captured Chrome long-word configurations verify actual native
  overflow paint, layout and RTL/LTR anchoring.
- Device methods also verify real width animation, reduced-motion application,
  clockwise RTL ring paint, explicit palette changes, and actual live-host
  300dp parent sizing, alpha theme roles, typed local/default styles and hidden
  inspection behavior.
- 24 actual metadata-gated Kotlin Usage/API examples compiled successfully. The
  exact source, hashes and compiler log are archived under the shared
  `outputs/native-parity/md-meter/examples` directory. A later test assertion
  overload compilation failure is recorded separately and was corrected; it is
  not represented as a failed production-example compilation.

`audits/evidence/md-meter/final` retains the passing log, results, actual fallback
font/advance log and hashes of the exact tested source/assets. Earlier failed
runs remain under `format-first`, `first` and `second`. They exposed real legacy
formatting, text sizing, fallback line-box and fractional path issues; fixes did
not alter the Web oracle. The final preview APK was installed successfully for
integrated Laboratory QA.

## Explicit boundaries and remaining review

**Arabic glyph width is not a cross-platform match.** The shared Roboto asset
contains Latin glyphs only. Actual Android shaping reports
`/system/fonts/NotoNaskhArabic-Regular.ttf`; the native `٣٨٪؜` box is16dp while
macOS Chrome's Geeza Pro box is19.328125px. Both light/dark comparisons log this
exception explicitly instead of passing a looser global tolerance. The exact
Arabic string, line height16, host height24 and track placement remain checked.
A shared licensed Arabic fallback would be needed to close this typography
boundary consistently; no Apple font was copied and no width was fabricated.

Android inspection reports actual layout/path geometry and applied typography,
not browser nodes or CSS computed-style objects. Native rasterization and Float
accessibility constraints remain distinct from browser APIs.

An extraordinarily large finite size is bounded to 32766 physical pixels by
the native layout contract. Center text size, line height and padding derive
from that same applied diameter; inspection reports those actual values. This
is smaller than Chrome's finite layout ceiling and is an explicit native
physical limit. Circular stroke paint saturates only after it covers every
pixel of the clipped viewport. No infinite Float enters Skia, and stroke is not
misreported as a CSS border. The additional safety run in `evidence/md-meter/safety`
passes four device methods: all 196 original configurations, overflow, motion,
and the new extreme-size/stroke/zero transition. The tested APK was installed
successfully. The parent then verified this final APK in the Laboratory: all
fourteen property controls, RTL GB formatting, omitted versus empty formatting
options, custom case-sensitive alpha theme roles, all seven appearance controls,
circular/linear density and zero-size fallback, and Reset behavior. The scoped
review found no remaining ordinary-range implementation blocker.
