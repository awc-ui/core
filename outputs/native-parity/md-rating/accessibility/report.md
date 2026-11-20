# md-rating — accessibility parity

Generated 2026-11-05T01:33:54.391Z by tools/ax. Web = Chrome AX tree of the same effective node.

## default

- Web: slider:Rating · Tab: slider:Rating
- macos (pass): slider:Rating · Tab: slider:Rating → slider:Rating
- ios (pass): slider:Rating · Tab: slider:Rating → ∅
  - expected target: ios: slider "Rating" target 224×28 below 44pt
- android (pass): slider:Rating · Tab: slider:Rating → slider:Rating
  - expected target: android: slider "Rating" target 448×56 below 48dp

## half

- Web: slider:Rating
- macos (pass): slider:Rating
- ios (pass): slider:Rating
  - expected target: ios: slider "Rating" target 224×28 below 44pt
- android (pass): slider:Rating
  - expected target: android: slider "Rating" target 448×56 below 48dp

## readonly

- Web: img:Average rating: 4 Stars
- macos (pass): img:Average rating: 4 Stars · Tab: ∅ → ∅
- ios (pass): img:Average rating: 4 Stars · Tab: ∅ → ∅
- android (pass): img:Average rating: 4 Stars · Tab: ∅ → ∅

## disabled

- Web: slider:Rating
- macos (pass): slider:Rating {"disabled":"true"} · Tab: ∅ → ∅
- ios (pass): slider:Rating {"disabled":"true"} · Tab: ∅ → ∅
- android (pass): slider:Rating {"disabled":"true"} · Tab: ∅ → ∅

## soft-disabled

- Web: slider:Rating · Tab: slider:Rating
- macos (pass): slider:Rating {"disabled":"true"} · Tab: slider:Rating → slider:Rating
- ios (pass): slider:Rating {"disabled":"true"} · Tab: slider:Rating → ∅
- android (pass): slider:Rating {"disabled":"true"} · Tab: slider:Rating → slider:Rating
