# md-split-button — accessibility parity

Generated 2026-11-05T01:32:20.078Z by tools/ax. Web = Chrome AX tree of the same effective node.

## default

- Web: button:Publish · button:More actions · Tab: button:Publish → button:More actions
- macos (pass): button:Publish · button:More actions · Tab: button:Publish → button:More actions → button:Publish
- ios (pass): button:Publish · button:More actions · Tab: button:Publish → button:More actions → ∅
  - expected target: ios: button "Publish" target 100×40 below 44pt
  - expected target: ios: button "More actions" target 48×40 below 44pt
- android (pass): button:Publish · button:More actions {"expanded":"false"} · Tab: button:Publish → button:More actions → button:Publish

## expanded

- Web: button:Publish · button:More actions · Tab: button:Publish → button:More actions
- macos (pass): button:Publish · button:More actions {"expanded":"true"} · Tab: button:Publish → button:More actions → button:Publish
- ios (pass): button:Publish · button:More actions · Tab: button:Publish → button:More actions → ∅
  - expected target: ios: button "Publish" target 100×40 below 44pt
  - expected target: ios: button "More actions" target 48×40 below 44pt
- android (pass): button:Publish · button:More actions {"expanded":"true"} · Tab: button:Publish → button:More actions → button:Publish

## disabled

- Web: button:Publish · button:More actions
- macos (pass): button:Publish {"disabled":"true"} · button:More actions {"disabled":"true"} · Tab: ∅ → ∅ → ∅
- ios (pass): button:Publish {"disabled":"true"} · button:More actions {"disabled":"true"} · Tab: ∅ → ∅ → ∅
- android (pass): button:Publish {"disabled":"true"} · button:More actions {"disabled":"true","expanded":"false"} · Tab: ∅ → ∅ → ∅

## soft-disabled

- Web: button:Publish · button:More actions · Tab: button:Publish → button:More actions
- macos (pass): button:Publish {"disabled":"true"} · button:More actions {"disabled":"true"} · Tab: button:Publish → button:More actions → button:Publish
- ios (pass): button:Publish {"disabled":"true"} · button:More actions {"disabled":"true"} · Tab: button:Publish → button:More actions → ∅
- android (pass): button:Publish {"disabled":"true"} · button:More actions {"disabled":"true","expanded":"false"} · Tab: button:Publish → button:More actions → button:Publish
