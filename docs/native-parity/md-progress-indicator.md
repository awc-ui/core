# Progress Indicator parity checkpoint

Status: dedicated SwiftUI and Compose implementations, shared controls and
compiled public examples are available. Integrated Laboratory editing, styling
and completion checks pass on the available native hosts. Android animated
part inspection also passes after the coherent-capture correction and retake. Actual iOS execution, operating-system screen-reader
validation and the final independent migration audit remain open.

## Contract and shared integration

All fourteen source properties are represented: variant, value, max,
indeterminate, thickness, wave, waveAmplitude, waveLength, waveSpeed, size,
fourColor, label, complete and density. The source has one void `mdComplete`
event, three visual parts and no slots or public methods.

`AWCProgressIndicatorAppearance` exposes the thirteen public hooks in both
libraries. The shared Styles panel carries the same fields through inherited
defaults and local overrides. RGB/RGBA colors, physical elliptical corner
shapes, zero stop size and signed gap/trailing-space values are preserved.
Corner hooks affect linear boxes; circular paths retain their source caps.
Four-color cycling applies only to flat circular indeterminate progress.

Web, SwiftUI and Compose examples use an authored 300-unit parent. Linear
progress fills it; circular progress retains its intrinsic size. Copyable
completion examples change `complete` on an existing mounted component and
remount explicitly for Reset. Initial `complete=true` is inert, false does not
reset terminal state, and indeterminate ignores completion. The actual native
event has null detail; no fabricated completion method is exposed.

The Laboratory's strict retained `update` transport preserves the root instance
and ordered property changes. An acknowledgement confirms application, not
animation completion. Android waits for a GPU frame committed with the matching
property revision; Swift drains the actual root property observation. Session
replacement rejects pending browser promises and ignores late responses.
Uncertain failures are reported without replay or an implicit remount.
Theme, appearance, viewport and Reset still use the explicit remount path.

Details and the request schema are in
[the retained-preview contract](progress-preview-contract.md).

## Evidence

| Gate | Executed evidence |
| --- | --- |
| Web source | 193 tests and full build; 92 configurations per theme, 52 additional numeric/direction configurations, captured paths/keyframes and completion events; 2,195 main and 443 edge assertions |
| Shared controls and transport | 119 relevant regression checks, including strict source-property drift, ordered false/true updates, cancelled sessions, all thirteen fields, seven framework snippets and actual completion recipes |
| SwiftUI/AppKit | 2,808 checks: 51 contracts and 2,757 actual native checks; 184 theme configurations plus 52 numeric/direction cases, 54 timed animation configurations and additional RTL samples; 39 actual live-host checks and snapshot execution |
| Compose | 112 unit cases and nine device methods, including 236 mounted configurations, 829 nonempty captured wave contours plus empty paths, real lifecycle, retained host updates, RGBA/preferences and RTL paint; four focused path-oracle methods additionally pass after the rotated inspection correction |
| Public examples | Twenty generated Swift examples typechecked and twenty generated Kotlin examples compiled against the actual public APIs |
| Laboratory | Web, macOS SwiftUI and Android RTL 300×8 styled previews; editable fourteen properties and thirteen styles; actual one-shot completion events, terminal-state behavior and explicit reset. Android animated circular part inspection passes on the corrected host; the earlier failure is preserved |

The workspace output directory `outputs/native-parity/md-progress-indicator`
contains Web/source/shared/Swift manifests, exact generated examples and compile
logs. Android runtime logs, XML, source hashes and raw reflection images are
retained under `packages/native-android/audits/evidence/md-progress-indicator`.
The platform audits are
[Swift](../../packages/native-ios/audits/md-progress-indicator.md) and
[Android](../../packages/native-android/audits/md-progress-indicator.md).

Independent review found and resolved the incorrect RTL indeterminate path
phase, physical corner reflection and nonfinite derived Swift geometry.
The shared update path was checked to retain identity and defer completion to
the real renderer. Final review found one additional Android inspector-only
issue: at nonzero circular rotation it reported a tight rotated contour/fixed
circle box instead of the transformed local SVG element box. The correction now
transforms the measured local rectangle while preserving the actual painted
path. All four focused path-oracle methods pass, including nonzero-angle flat
and wavy rectangles within 0.04 dp. Logs, XML and installed APK/source hashes are
retained in `inspection-final`. The Laboratory inspector retake then found a
second issue: the installed host filters changing part rectangles between its
draw and PixelCopy stages, removing animated circular parts from the available
inspection data. Root component bounds remain present. The failed capture is
retained in `laboratory-proof.json`. The corrected host holds surface submission
briefly during PixelCopy and pairs its image with the committed measurement
snapshot. Eight focused device methods pass, including twenty rotating captures
and the production capture-ticket timeout guard. Independent review verifies
all five recorded source/APK hashes and the final eight-method XML. The actual
Laboratory retake on APK `f1945827…` exposes “Inspect hovered parts” during
rotation and selects “Active circle”; successive delivered bounds change from
36.38 to 48.92 dp. The saved screenshot independently confirms that selected
part and its overlay. This specific inspector gate is closed.

Independent review opened the three `laboratory-*-styled.png` screenshots and
confirmed the same RTL composition, stop placement, physical corner treatment
and 300×8 root size at their displayed scale. This is a visual review of the
captured configuration, not a pixel identity claim. The retained browser proof
also records real `mdComplete` null payloads, no second event after toggling
false/true on a terminal instance, and reset to the default 300×10 wavy linear
recipe on both native hosts. Swift's fresh circular instance completes at
84×84; its runtime is macOS/AppKit.

The original browser matrices use the recorded Laboratory token maps. Their
palette comparisons establish parity for those inputs, not a fresh default-
library browser palette certification. See
[reference theme provenance](reference-theme-provenance.md).

## Boundaries and remaining gates

Native drawing uses real paths and platform accessibility APIs. SVG element
bounds exclude stroke; they must not be presented as painted extents.
Native edge antialiasing remains platform-dependent. Android's final reflection
check compares contours at 0.001 dp and allows one measured hardware coverage
step only at identified edge neighborhoods; raw 127/28,800 differing pixels
are retained rather than described as pixel-identical.

Accepted finite values retain their author input while used native geometry
and tessellation stay bounded. Swift uses the independently measured Chrome
length boundary before Float conversion; Android uses its 32,766 physical-pixel
constraint boundary. Both bound path allocation and report effective measured
geometry. These extreme-input limits are explicit implementation boundaries.

Reduced-motion and contrast evidence comes from isolated native fixtures, not
changing the user's OS preferences. Swift's public forced-colors modifier is
an explicit semantic palette; increased contrast alone preserves authored
colors. Android uses the corresponding explicit native override. Neither is
claimed to reproduce every operating system's browser forced-color palette.

Executed Apple evidence is macOS SwiftUI/AppKit. UIKit compilation, iOS device
rendering and VoiceOver remain unverified; Android evidence is the available
API 36 emulator, not every supported OS release. Dynamic ancestor density
changes without a source component render remain outside the source acceptance
evidence. OS accessibility review, fresh default-browser palette acceptance
and the independent all-component audit remain open before certification.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeProgressIndicatorViewIntegration` | **2808/2808** | **2808/2808** | **2808/2808** |
| **Total** | **2808/2808** | **2808/2808** | **2808/2808** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
