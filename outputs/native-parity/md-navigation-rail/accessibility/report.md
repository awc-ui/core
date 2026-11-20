# md-navigation-rail — accessibility parity

Generated 2026-11-08T17:59:46.428Z by tools/ax. Web = Chrome AX tree of the same effective node.

## default

- Web: navigation:Navigation · tablist:Navigation · tab:Home · tab:Saved · tab:Settings · Tab: tab:Home
- macos (pass): navigation:Navigation · tablist:Navigation · tab:Home {"selected":"true"} · tab:Saved · tab:Settings · Tab: tab:Home
- ios (pass): button:Home {"selected":"true"} · button:Saved · button:Settings · Tab: button:Home
  - expected missing: navigation "Navigation" has no ios counterpart — Web nav landmark around the tablist. UIKit exposes landmarks only as a container type, never as an element: the rail is a labelled container (SwiftUI .contain, the rail label) whose destinations VoiceOver reads as tabs (button + selected trait), as md-navigation-bar.
- android (pass): tab:Home {"selected":"true"} · tab:Saved · tab:Settings · text: Navigation · Tab: tab:Home
  - expected missing: navigation "Navigation" has no android counterpart — Web nav landmark. Compose has no landmark role: the rail is a traversal group labelled by its label (contentDescription), read before its destinations (Role.Tab + selected), as md-navigation-bar.
  - expected text-extra: android exposes text Web does not: "Navigation" — The nav landmark / tablist name (aria-label). Compose has neither role: the traversal group carries the label as its contentDescription, read before the destinations, so the checker reports it as text (as md-tabs).

## expanded

- Web: navigation:Navigation · button:Toggle navigation · tablist:Navigation · tab:Home · tab:Saved · tab:Settings · Tab: button:Toggle navigation → tab:Home
- macos (pass): navigation:Navigation · button:Toggle navigation {"expanded":"true"} · tablist:Navigation · tab:Home {"selected":"true"} · tab:Saved · tab:Settings · Tab: button:Toggle navigation → tab:Home
- ios (pass): button:Toggle navigation · button:Home {"selected":"true"} · button:Saved · button:Settings · Tab: button:Toggle navigation → button:Home
  - expected missing: navigation "Navigation" has no ios counterpart — Web nav landmark around the tablist. UIKit exposes landmarks only as a container type, never as an element: the rail is a labelled container (SwiftUI .contain, the rail label) whose destinations VoiceOver reads as tabs (button + selected trait), as md-navigation-bar.
  - expected target: ios: button "Toggle navigation" target 40×40 below 44pt
- android (pass): button:Toggle navigation {"expanded":"true"} · tab:Home {"selected":"true"} · tab:Saved · tab:Settings · text: Navigation · Tab: button:Toggle navigation → tab:Home
  - expected missing: navigation "Navigation" has no android counterpart — Web nav landmark. Compose has no landmark role: the rail is a traversal group labelled by its label (contentDescription), read before its destinations (Role.Tab + selected), as md-navigation-bar.
  - expected text-extra: android exposes text Web does not: "Navigation" — The nav landmark / tablist name (aria-label). Compose has neither role: the traversal group carries the label as its contentDescription, read before the destinations, so the checker reports it as text (as md-tabs).

## horizontal

- Web: navigation:Navigation · tablist:Navigation · tab:Home · tab:Saved · tab:Settings · Tab: tab:Home
- macos (pass): navigation:Navigation · tablist:Navigation · tab:Home {"selected":"true"} · tab:Saved · tab:Settings · Tab: tab:Home
- ios (pass): button:Home {"selected":"true"} · button:Saved · button:Settings · Tab: button:Home
  - expected missing: navigation "Navigation" has no ios counterpart — Web nav landmark around the tablist. UIKit exposes landmarks only as a container type, never as an element: the rail is a labelled container (SwiftUI .contain, the rail label) whose destinations VoiceOver reads as tabs (button + selected trait), as md-navigation-bar.
- android (pass): tab:Home {"selected":"true"} · tab:Saved · tab:Settings · text: Navigation · Tab: tab:Home
  - expected missing: navigation "Navigation" has no android counterpart — Web nav landmark. Compose has no landmark role: the rail is a traversal group labelled by its label (contentDescription), read before its destinations (Role.Tab + selected), as md-navigation-bar.
  - expected text-extra: android exposes text Web does not: "Navigation" — The nav landmark / tablist name (aria-label). Compose has neither role: the traversal group carries the label as its contentDescription, read before the destinations, so the checker reports it as text (as md-tabs).

## labels-none

- Web: navigation:Navigation · tablist:Navigation · tab:Home · tab:Saved · tab:Settings · Tab: tab:Home
- macos (pass): navigation:Navigation · tablist:Navigation · tab:Home {"selected":"true"} · tab:Saved · tab:Settings · Tab: tab:Home
- ios (pass): button:Home {"selected":"true"} · button:Saved · button:Settings · Tab: button:Home
  - expected missing: navigation "Navigation" has no ios counterpart — Web nav landmark around the tablist. UIKit exposes landmarks only as a container type, never as an element: the rail is a labelled container (SwiftUI .contain, the rail label) whose destinations VoiceOver reads as tabs (button + selected trait), as md-navigation-bar.
- android (pass): tab:Home {"selected":"true"} · tab:Saved · tab:Settings · text: Navigation · Tab: tab:Home
  - expected missing: navigation "Navigation" has no android counterpart — Web nav landmark. Compose has no landmark role: the rail is a traversal group labelled by its label (contentDescription), read before its destinations (Role.Tab + selected), as md-navigation-bar.
  - expected text-extra: android exposes text Web does not: "Navigation" — The nav landmark / tablist name (aria-label). Compose has neither role: the traversal group carries the label as its contentDescription, read before the destinations, so the checker reports it as text (as md-tabs).
