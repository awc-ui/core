# Skeleton parity checkpoint

Status: dedicated SwiftUI and Compose renderers, shared controls and compiled
public examples are implemented. Laboratory styling and geometry pass on Web,
macOS SwiftUI and Android. Retained property edits, measured row-gap inspection
and the separate fresh default-browser palette comparison also pass. Actual
iOS execution, OS screen-reader delivery and the independent all-component
audit remain open.

## Contract

All ten source properties are represented: variant, animation, lines, width,
height, fullWidth, fullHeight, ariaLabelProp, announce and density. The source
declares no events, authored slots or public methods; none are fabricated.
The eleven appearance fields and all three parts (shape, line, line-last) have
public typed native equivalents. Last-line overrides merge after the common
line override on the actual tapered row.

`AWCSkeletonLength` retains point, percentage, em, rem and ch coefficients until
layout. The parser accepts those units and additive calc expressions, including
finite terms whose intermediate decimal representation exceeds ordinary Double
range. A definite parent height and actual font/zero-glyph context are supplied
through `AWCSkeletonSizingContext`. Unsupported arbitrary CSS is reported
explicitly; it is not converted to a fabricated fixed width.

The Laboratory uses a real 260×160 parent. That wrapper is sizing context,
while the component retains its natural 260×64 three-row default. Width/height
properties, hook precedence, full-width/full-height behavior, indefinite
percentage height, RTL taper and density match the captured source scenarios.
All variants retain the entrance even with recurring animation=none. Pulse,
shimmer and their durations have native implementations; reduced motion removes
entrance and recurring motion.

Announced skeletons have native loading semantics and the authored label;
decorative skeletons are hidden from accessibility. Native semantic responder
tests are separate from an OS screen-reader announcement check.

## Executed evidence

| Gate | Evidence |
| --- | --- |
| Web reference | 106 measured configurations per recorded theme, 135 paused motion samples across 15 scenarios, 5,136 oracle assertions, 17 source tests and development build |
| Shared integration | Original 118-check shared checkpoint, independent 82-check recheck, plus strict ten-property retained-update and ordered-session regressions; exact logs and hashes are retained separately |
| SwiftUI/AppKit | 3,714 checks: 25 contracts and 3,689 actual native checks; 42 actual live-host checks; three preview products built |
| Compose | Fourteen focused unit methods including 135 captured CSS motion samples; three device methods covering 212 mounted configurations, real paint, semantics, motion and preferences; typed live-host sizing checks |
| Public examples | Twenty-seven exact generated Swift examples typecheck and twenty-seven Kotlin examples compile against the public libraries |
| Laboratory | All ten controls exercised on each native platform; all eleven shared styles; Web, macOS and Android RTL styled root measures 200×105; retained edit retake measures 200×134 with row gap 6, full-height circle 160×160 with gap 0, and reset 260×64 with row gap 8 on both hosts |
| Fresh default palette | Separate font-only Web reference, 106 configurations per theme; Swift passes 1,974 checks and Android compares all 212 configurations with no captured color-token injection |

These are distinct suites and configuration counts, not an aggregate count of
independent tests. The manifests, exact generated examples, compile logs and
screenshots are under `outputs/native-parity/md-skeleton`. Platform details are
in the [Swift audit](../../packages/native-ios/audits/md-skeleton.md) and
[Android audit](../../packages/native-android/audits/md-skeleton.md). The
[source review](md-skeleton-source-review.md) records the Web behavior and
[preview contract](skeleton-preview-contract.md) records shared sizing rules.

Independent review opened all three `laboratory-*-styled.png` screenshots.
They show the same four-row composition, 60% final-row RTL taper, translucent
color and asymmetric corners at the displayed scale. The inspection readouts
agree on 200×105. This visual review is not a pixel identity claim.

The integrated review exposed two issues that the initial renderer tests did
not close: property edits restarted native sessions and replayed the entrance,
and the inspector omitted the real text-row gap. The original failed gate is
preserved in `laboratory-proof.json`; the appended retained-edit/gap retake
passes on both native hosts. Strict ten-property updates apply to the same
mounted root, backed by 42 Swift host checks and two focused Android host
methods checking the applied ACK, entrance retention and actual gap metadata.
Laboratory interactions exercise all ten controls and confirm the text, circle
and reset dimensions above. The independent reviewer opened the final Android
reset screenshot and verified its 260×64 and 8/0 inspector readouts.

Appearance changes and explicit Reset may deliberately remount. Ordinary
property changes preserve the root instance. The final review and verified
artifact hashes are in `laboratory-independent-review.json`.

## Boundaries

The original browser matrices retain the actual Laboratory token maps and
prove parity for those recorded inputs. They remain unchanged. The separate
`default-palette` gate uses a font-only stylesheet and unmodified library
tokens; both native oracles use their generated defaults without injecting
the captured colors. This closes the fresh default-palette comparison for
Skeleton specifically; see [theme provenance](reference-theme-provenance.md).

Swift bounds used lengths at the measured Chrome limit of 16,777,214 logical
units and caps real text-row allocation at 4,096. Android bounds layout at
32,766 physical pixels and caps rows at 8,192. Those explicit extreme-input
safeguards prevent invalid constraints or unbounded allocations. They are not
claims of unlimited Web layout parity. Native antialiasing and font scaling
retain platform behavior.

The executed Apple host is macOS/AppKit. UIKit compilation, iOS rendering and
VoiceOver have not run on this machine. Android evidence uses the available
API 36 emulator. Preference tests use isolated fixture overrides; no claim is
made that the user's OS settings or screen reader were exercised. Native
forced-color overrides are explicit equivalents, not the browser CSS media
environment. OS accessibility review, actual iOS execution and the final independent
audit remain required before full certification.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeSkeletonViewIntegration` | **3724/3724** | **3714/3714** | **3724/3724** |
| **Total** | **3724/3724** | **3714/3714** | **3724/3724** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
