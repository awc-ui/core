# Status Dot — SwiftUI checkpoint

The dedicated renderer replaces the previous fixed-size, semantically inaccurate
preview. This is a macOS SwiftUI checkpoint, not an iOS runtime certification.

All seven properties are implemented: state, size, inline, shape, live, label and
density. The eight typed appearance fields preserve explicit zero values,
RGBA colors and logical insets expressed as points plus a fraction of the
containing parent's dimension. `.awcStatusDotOverlay` measures the actual parent;
inline dots belong in ordinary layout. The accessibility label is never rendered
as visible text. The source exposes no events, methods, slots or CSS parts.

Diameter, inherited density, physical-pixel outline snapping, circular anchors,
RTL, hidden state, theme colors and the invisible inset ring follow the measured
source. The pulse uses the source's two separately eased intervals and an
exterior-only halo, so translucent fills retain their original color. Zero
duration stops the pulse and restores the invisible state's static ring.

`outputs/native-parity/md-status-dot/swift-verification.json` links the exact
source hashes, retained executable, runtime, logs and measured output. The
focused runner passes 1,687 contract assertions and 1,001 actual-render
assertions against 100 Web configurations in each theme. These comprise 196
visible layout records and four hidden cases, plus actual color-pixel and
pulse-lifecycle checks. The source fixture and each failed attempt are retained.

Reproduce with:

```sh
AWC_STATUS_DOT_MEASUREMENTS=/tmp/status-dot-results.json \
  sh packages/native-ios/scripts/test-native-status-dot.sh
```

The XCTest wrapper shares the contract cases, but XCTest is unavailable in the
installed Command Line Tools; these results come from the standalone native
runner. The OS reduced-motion branch and accessibility announcements have been
reviewed in source, not exercised through VoiceOver or an OS preference change.
Increased-contrast behavior, iOS simulator/device execution, Laboratory
integration and the independent final audit remain pending.
