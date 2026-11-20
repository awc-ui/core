# md-icon-button — accessibility parity

Generated 2026-11-05T01:32:18.478Z by tools/ax. Web = Chrome AX tree of the same effective node.

## toggle

- Web: togglebutton:Favorite · Tab: togglebutton:Favorite
- macos (pass): togglebutton:Favorite {"pressed":"false"} · Tab: togglebutton:Favorite → togglebutton:Favorite
- ios (pass): switch:Favorite {"checked":"false"} · Tab: switch:Favorite → ∅
  - expected target: ios: switch "Favorite" target 40×40 below 44pt
- android (pass): togglebutton:Favorite {"pressed":"false"} · Tab: togglebutton:Favorite → togglebutton:Favorite

## toggle-selected

- Web: togglebutton:Favorite
- macos (pass): togglebutton:Favorite {"selected":"true","pressed":"true"}
- ios (pass): switch:Favorite {"checked":"true"}
  - expected target: ios: switch "Favorite" target 40×40 below 44pt
- android (pass): togglebutton:Favorite {"pressed":"true"}

## plain

- Web: button:Settings
- macos (pass): button:Settings
- ios (pass): button:Settings
  - expected target: ios: button "Settings" target 40×40 below 44pt
- android (pass): button:Settings

## disabled

- Web: togglebutton:Favorite
- macos (pass): togglebutton:Favorite {"disabled":"true","pressed":"false"} · Tab: ∅ → ∅
- ios (pass): switch:Favorite {"disabled":"true","checked":"false"} · Tab: ∅ → ∅
- android (pass): togglebutton:Favorite {"disabled":"true","pressed":"false"} · Tab: ∅ → ∅

## soft-disabled

- Web: togglebutton:Favorite · Tab: togglebutton:Favorite
- macos (pass): togglebutton:Favorite {"disabled":"true","pressed":"false"} · Tab: togglebutton:Favorite → togglebutton:Favorite
- ios (pass): switch:Favorite {"disabled":"true","checked":"false"} · Tab: switch:Favorite → ∅
- android (pass): togglebutton:Favorite {"disabled":"true","pressed":"false"} · Tab: togglebutton:Favorite → togglebutton:Favorite

## link

- Web: button:Docs
- macos (pass): button:Docs
- ios (pass): button:Docs
  - expected target: ios: button "Docs" target 40×40 below 44pt
- android (pass): button:Docs
