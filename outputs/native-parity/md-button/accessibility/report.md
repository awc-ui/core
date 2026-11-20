# md-button — accessibility parity

Generated 2026-11-05T01:32:18.241Z by tools/ax. Web = Chrome AX tree of the same effective node.

## default

- Web: button:Continue · Tab: button:Continue
- macos (pass): button:Continue · Tab: button:Continue → button:Continue
- ios (pass): button:Continue · Tab: button:Continue → ∅
- android (pass): button:Continue · Tab: button:Continue → button:Continue

## disabled

- Web: button:Continue
- macos (pass): button:Continue {"disabled":"true"} · Tab: ∅ → ∅
- ios (pass): button:Continue {"disabled":"true"} · Tab: ∅ → ∅
- android (pass): button:Continue {"disabled":"true"} · Tab: ∅ → ∅

## soft-disabled

- Web: button:Continue · Tab: button:Continue
- macos (pass): button:Continue {"disabled":"true"} · Tab: button:Continue → button:Continue
- ios (pass): button:Continue {"disabled":"true"} · Tab: button:Continue → ∅
- android (pass): button:Continue {"disabled":"true"} · Tab: button:Continue → button:Continue

## toggle-selected

- Web: togglebutton:Continue · Tab: togglebutton:Continue
- macos (pass): togglebutton:Continue {"selected":"true","pressed":"true"} · Tab: togglebutton:Continue → togglebutton:Continue
- ios (pass): switch:Continue {"checked":"true"} · Tab: switch:Continue → ∅
- android (pass): togglebutton:Continue {"pressed":"true"} · Tab: togglebutton:Continue → togglebutton:Continue

## aria-label

- Web: button:Continue to checkout
- macos (pass): button:Continue to checkout
- ios (pass): button:Continue to checkout
- android (pass): button:Continue to checkout

## link

- Web: link:Continue · Tab: link:Continue
- macos (pass): link:Continue · Tab: link:Continue → link:Continue
- ios (pass): link:Continue · Tab: link:Continue → ∅
- android (pass): button:Continue · Tab: button:Continue → button:Continue

## icon

- Web: button:Continue
- macos (pass): button:Continue
- ios (pass): button:Continue
- android (pass): button:Continue

## loading

- Web: button:Continue
- macos (pass): button:Continue {"disabled":"true"}
- ios (pass): button:Continue {"disabled":"true"}
- android (pass): button:Continue {"disabled":"true"}
