# Badge migration checkpoint

Status: Web reference, SwiftUI and Android renderers, compiled native examples and focused Laboratory checks passed. iOS execution, accessibility review and the independent final audit remain pending.

## Implemented contract

Both native replacements expose all six source properties: `variant`, `value`, `max`, `icon`, `shape` and `density`. The named icon slot preserves authored presence, including an empty element and multiple children; authored content overrides the fallback icon. The small variant suppresses label and icon content. Badge has no public events or methods.

Value handling follows the source's finite JavaScript numeric conversion, overflow threshold and four UTF-16-unit truncation. This includes hexadecimal/binary/octal values, negative and fractional maxima, split surrogate replacement and untruncated overflow labels. Visual text collapses CSS ASCII whitespace while its accessible name retains the source value; nonbreaking spaces are retained.

The ten appearance fields are `containerColor`, `labelColor`, `cornerRadius`, `iconColor`, `iconSize`, `offsetX`, `offsetY`, `largeHeight`, `largePadding` and `smallSize`. Offsets carry an absolute length plus a fraction of the badge's own dimension. Padding carries four physical sides. The `label` and fallback `icon` parts have native appearance/inspection counterparts; authored slot elements remain separately measurable. Native interfaces accept resolved colors and lengths rather than evaluating CSS expressions.

SwiftUI's `.awcBadgeOverlay { ... }` and Android's `AWCBadgeHost(badge = { ... }) { ... }` measure the actual parent and preserve its intrinsic dimensions. Rectangular/circular parent anchors use the source's physical top-right placement even in RTL; internal content follows RTL. Icon-button badge slots reuse these rules. `shape` describes the parent anchor, not the badge radius.

The right panel and generated examples expose typed offset/padding controls, all appearance fields and the icon slot. The Web and native recipes use the same 48×48 notification-button parent, with no special preview-only top/right offsets.

Composition preserves inherited density: an absent or zero Badge density does not reset the containing component's density token. A local −1…−4 value overrides it. Actual nested Icon Button regressions cover resulting height, typography, padding and anchor geometry.

## Recorded verification

Workspace artifacts are under `outputs/native-parity/md-badge`.

- Web: 64 tests; 75 hydrated browser configurations. The original 69-case fixture/evidence is preserved separately. The six added cases cover asymmetric RTL with fallback/multiple icons, leading/newline/nonbreaking whitespace and small-variant suppression of authored content.
- SwiftUI/macOS: 264 contract checks and 834 actual rendered-layout checks passed, followed by the 284-check Icon Button renderer regression including 16 new nested-density checks. These include all 75 fixtures, native inspection bounds and authored background-color pixels. `swift-density-verification.json` records the latest source/artifact hashes and runtime scope; the earlier verification is preserved.
- Shared Laboratory controls, normalization, slot transport and generated-code regressions: 141 passed; `shared-integration-evidence.json` preserves the exact command and inputs.
- Eleven generated Swift examples and eleven generated Kotlin examples compile. `examples/verification.json` contains separate compiler logs and reproducible source.
- Android: 79 unit tests and seven device test methods passed, including the 75 source fixtures, eight nested-density states, accessibility/status updates, applied fractional/clamped padding, actual host capture, Menu host regression and direct Icon Button slot replacement. All 105 source/build inputs stayed unchanged during the final run. Evidence is in `android/final`.
- Live Laboratory checks passed for the shared styled, RTL, dense, named-slot
  and small-variant cases. Both native hosts measured the styled badge at
  55×24 with physical padding 2/9/4/5. A later reload verified the small badge at
  4×4, position 516/30, with unused typography correctly omitted on both hosts.
  `laboratory-proof.json` retains the earlier observations and the separately
  identified corrected small-typography results.

The Swift standalone runner executes the same contract cases used by the XCTest wrapper. The installed Command Line Tools do not provide XCTest; the failed XCTest attempt is retained rather than reported as a test pass.

## Explicit boundaries and remaining gates

For the two-emoji fixture, CoreText's AppleColorEmoji fallback produces a 39 pt badge versus Chrome's 32 px badge. The actual glyph run, source padding, height and anchoring are verified and the width difference is retained in `swift-measurements-75.json`. This is a proposed, narrowly scoped OS emoji-font exception, awaiting independent audit acceptance; it does not waive ordinary text, geometry or appearance mismatches.

SwiftUI posts low-priority accessibility announcements when the named status changes; Android exposes a polite live region. Actual VoiceOver/TalkBack validation remains pending. Browser forced-colors behavior and native increased-contrast behavior require a separate accessibility review.

iOS simulator execution: see [iOS simulator execution (gate 6)](#ios-simulator-execution-gate-6). macOS compilation/rendering
is not an iOS runtime pass. Final component acceptance still requires
accessibility review and independent review of the retained native and
Laboratory evidence.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeBadgeViewIntegration` | **264/264** | **264/264** | **264/264** |
| **Total** | **264/264** | **264/264** | **264/264** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
