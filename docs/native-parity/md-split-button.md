# Split Button migration checkpoint

Status: the shared contract, dedicated native renderers and generated examples
have focused verification. Focused Laboratory properties, styles, input and additive-slot checks pass; broader acceptance, iOS execution,
assistive technology review and the separate final audit remain pending. The final Swift
outlined state-layer inspection correction passed its native rerun.

## Implemented contract

The [source review](md-split-button-source-review.md) records fourteen properties,
two events, one additive default slot, seven CSS parts and no methods. Six public
hooks map to `AWCSplitButtonAppearance`: containerColor, labelColor, iconColor,
outlineColor, cornerRadius and iconSize. Local/default scopes merge by field and
preserve zero. Only the leading glyph uses the icon hooks; the trailing glyph
retains its source size and label ink. Outlined ignores container color.

Both halves remain independently focusable and actionable. Hard and soft disabled
states block activation; soft disabled retains focus. Leading event detail is
null. Trailing state commits before the exact `{ checked }` notification, so
canceling the event does not undo it. Native input provenance remains separate
from that detail. `controls` connects to a real mounted `AWCPopupTargetScope`
inside `AWCPopupScope`; it does not create or open a popup.

The Laboratory keeps the additive slot alongside the property label, exposes
the icon-only accessible name, and persists actual captured `splitButtonChecked`
across property edits and platform changes. Web reads the actual component
property; native captures supply a separate correlated Boolean. Event values are
not used to invent state. Usage snippets preserve the resulting property, slot
and all six styles.

Native inspector spacing remains measured. Split's outlined halves consume their
border before padding, unlike controls whose strokes overlay layout. Guides apply
that distinction only to the known measured Split halves. Android reports the
same rounded physical border that paint and layout use.

## Recorded evidence

Workspace artifacts are under `outputs/native-parity/md-split-button`.

| Gate | Recorded result |
| --- | --- |
| Web source | 69 Stencil/Jest tests passed; 50 hydrated browser fixture subcases with source, runtime and artifact hashes |
| Shared integration | 174 tests passed at the Split integration checkpoint; later related checks are retained separately |
| Inspector | 28 tests passed, including both native platforms, both Split halves, scaled images and existing overlaid-border controls |
| Public examples | 16 generated Swift examples typechecked against the macOS native API; 16 generated Kotlin examples compiled |
| SwiftUI/AppKit | 945 actual checks in the final reviewed run, 68 existing focus checks and 13 live-host checks; outlined state-layer correction passed |
| Android | 98 unit cases passed; primary 11-method device run had ten passes and one test-locator failure; the corrected pixel method passed separately |
| Laboratory | Native properties, six styles, independent events and retained checked state verified; Web/Swift/Android additive slot passed; actual24px controls centered in the 100 px capture |
| iOS / final audit | Pending |

The [Swift record](../../packages/native-ios/audits/md-split-button.md) and
[Android record](../../packages/native-android/audits/md-split-button.md) retain
their exact commands, boundaries and platform details. Android device checks
cover all fifty source subcases, independent input, post-commit state, popup
focus, additive content, all styles and fractional-density border geometry.
Additional Segmented, Badge and Menu regressions in that run are supporting
evidence, not extra Split fixture cases.

`examples/verification.json` preserves both exact generated source files,
compiler commands and hashes. Compile success is distinct from runtime behavior.
Earlier Android synchronization/input/locator failures remain in their original
logs; the initial combined run is not relabeled as wholly passing.

The right-panel default-slot recipe initially omitted its editor, although
slot transport and examples worked. The corrected editor now exposes additive
text without clearing `label`; 42 related documentation/Split regressions pass.
The Laboratory then measured Web 289.73×56 and Swift 290.5×56 for the retained
Create project label plus ` + extra`. Android property/style/event checks passed,
including outlined/sm/density −4 at 141.5×24 and actual trailing checked state
retained after property edits. `laboratory-in-progress.json` preserves this
checkpoint, including the later Android additive-slot retake at 291×56, versus
Swift 290.5×56 and Web 289.73×56. Its sm/density−4 retake renders 185.5×24 at y38
in the 100 px capture, confirming actual centering.

## Remaining acceptance and boundaries

Independent review identified two border-related issues: Android initially mixed
rounded layout with fractional paint/inspection, and Swift initially measured
the outlined state-layer part over the full half rather than its actual inner
box. Android's focused physical-border regression passes. Swift's final reviewed
run passes 945 checks and its real-host rerun passes 13; `swift-evidence.json`
links `swift-view-reviewed.log` and `swift-live-reviewed.log`. Those reports
close the outlined-part correction after the earlier 845-check checkpoint.

Native typography, glyph rasterization and elevation are not asserted
byte-identical to Chromium. Typed appearance and actual native accessibility
relationships replace CSS selectors and browser ARIA objects. macOS SwiftUI
execution is not iOS execution, and automated semantics are not a manual
VoiceOver/TalkBack audit. The integrated Laboratory and final independent review
must close these gates explicitly.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeSplitButtonViewIntegration` | **945/945** | **945/945** | **945/945** |
| **Total** | **945/945** | **945/945** | **945/945** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
