# md-divider — accessibility parity

Generated 2026-10-29T11:11:40.691Z by tools/ax. Web = Chrome AX tree of the same effective node.

## horizontal

- Web: separator:
- macos (pass):  · text: Separator
  - expected text-extra: macos exposes text Web does not: "Separator" — Web role=separator (aria-orientation). SwiftUI has no separator role: the divider is a labelled element "Separator" with its orientation as value, which VoiceOver reads like Chrome's separator.
- ios (pass):  · text: Separator Horizontal
  - expected text-extra: ios exposes text Web does not: "Separator Horizontal" — Web role=separator. UIKit has no separator trait: label "Separator" + value orientation (VoiceOver: "Separator, Horizontal").
- android (pass):  · text: Separator
  - expected text-extra: android exposes text Web does not: "Separator" — Web role=separator. Android has no separator role: the divider is described "Separator", as on macOS and iOS.

## vertical

- Web: separator:
- macos (pass):  · text: Separator
  - expected text-extra: macos exposes text Web does not: "Separator" — Web role=separator (aria-orientation). SwiftUI has no separator role: the divider is a labelled element "Separator" with its orientation as value, which VoiceOver reads like Chrome's separator.
- ios (pass):  · text: Separator Vertical
  - expected text-extra: ios exposes text Web does not: "Separator Vertical" — Web role=separator. UIKit has no separator trait: label "Separator" + value orientation (VoiceOver: "Separator, Horizontal").
- android (pass):  · text: Separator
  - expected text-extra: android exposes text Web does not: "Separator" — Web role=separator. Android has no separator role: the divider is described "Separator", as on macOS and iOS.
