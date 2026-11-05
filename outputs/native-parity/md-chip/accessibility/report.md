# md-chip — accessibility parity

Generated 2026-10-29T11:11:42.801Z by tools/ax. Web = Chrome AX tree of the same effective node.

## filter

- Web: group:Design system · togglebutton:Design system · button:Remove Design system · Tab: togglebutton:Design system → button:Remove Design system
- macos (pass): group:Design system · togglebutton:Design system {"pressed":"false"} · button:Remove Design system · Tab: togglebutton:Design system → button:Remove Design system → togglebutton:Design system
- ios (pass): switch:Design system {"checked":"false"} · button:Remove Design system · Tab: switch:Design system → button:Remove Design system → ∅
  - expected target: ios: switch "Design system" target 162×32 below 44pt
  - expected target: ios: button "Remove Design system" target 18×18 below 44pt
- android (pass): togglebutton:Design system {"pressed":"false"} · button:Remove Design system · Tab: togglebutton:Design system → button:Remove Design system → togglebutton:Design system
  - expected target: android: togglebutton "Design system" target 323×64 below 48dp
  - expected target: android: button "Remove Design system" target 36×36 below 48dp

## filter-selected

- Web: group:Design system · togglebutton:Design system · button:Remove Design system
- macos (pass): group:Design system · togglebutton:Design system {"selected":"true","pressed":"true"} · button:Remove Design system
- ios (pass): switch:Design system {"checked":"true"} · button:Remove Design system
  - expected target: ios: switch "Design system" target 162×32 below 44pt
  - expected target: ios: button "Remove Design system" target 18×18 below 44pt
- android (pass): togglebutton:Design system {"pressed":"true"} · button:Remove Design system
  - expected target: android: togglebutton "Design system" target 323×64 below 48dp
  - expected target: android: button "Remove Design system" target 36×36 below 48dp

## assist

- Web: button:Add to calendar · Tab: button:Add to calendar
- macos (pass): button:Add to calendar · Tab: button:Add to calendar → button:Add to calendar
- ios (pass): button:Add to calendar · Tab: button:Add to calendar → ∅
  - expected target: ios: button "Add to calendar" target 150×32 below 44pt
- android (pass): button:Add to calendar · Tab: button:Add to calendar → button:Add to calendar
  - expected target: android: button "Add to calendar" target 300×64 below 48dp

## input

- Web: group:Alex Morgan · togglebutton:Alex Morgan · button:Remove Alex Morgan · Tab: togglebutton:Alex Morgan → button:Remove Alex Morgan
- macos (pass): group:Alex Morgan · togglebutton:Alex Morgan {"pressed":"false"} · button:Remove Alex Morgan · Tab: togglebutton:Alex Morgan → button:Remove Alex Morgan → togglebutton:Alex Morgan
- ios (pass): switch:Alex Morgan {"checked":"false"} · button:Remove Alex Morgan · Tab: switch:Alex Morgan → button:Remove Alex Morgan → ∅
  - expected target: ios: switch "Alex Morgan" target 148×32 below 44pt
  - expected target: ios: button "Remove Alex Morgan" target 18×18 below 44pt
- android (pass): togglebutton:Alex Morgan {"pressed":"false"} · button:Remove Alex Morgan · Tab: togglebutton:Alex Morgan → button:Remove Alex Morgan → togglebutton:Alex Morgan
  - expected target: android: togglebutton "Alex Morgan" target 297×64 below 48dp
  - expected target: android: button "Remove Alex Morgan" target 36×36 below 48dp

## disabled

- Web: group:Design system · togglebutton:Design system · button:Remove Design system
- macos (pass): group:Design system · togglebutton:Design system {"disabled":"true","pressed":"false"} · button:Remove Design system {"disabled":"true"} · Tab: ∅ → ∅ → ∅
  - expected state: group "Design system" disabled: true → ∅ — Web reports the chip wrapper group as disabled. AppKit groups carry no enabled state; the chip control inside reports AXEnabled false.
- ios (pass): switch:Design system {"disabled":"true","checked":"false"} · button:Remove Design system {"disabled":"true"} · Tab: ∅ → ∅ → ∅
- android (pass): togglebutton:Design system {"disabled":"true","pressed":"false"} · button:Remove Design system {"disabled":"true"} · Tab: ∅ → ∅ → ∅

## soft-disabled

- Web: group:Design system · togglebutton:Design system · button:Remove Design system · Tab: togglebutton:Design system
- macos (pass): group:Design system · togglebutton:Design system {"disabled":"true","pressed":"false"} · button:Remove Design system {"disabled":"true"} · Tab: togglebutton:Design system → togglebutton:Design system → togglebutton:Design system
  - expected state: group "Design system" disabled: true → ∅ — Web reports the chip wrapper group as disabled. AppKit groups carry no enabled state; the chip control inside reports AXEnabled false.
- ios (pass): switch:Design system {"disabled":"true","checked":"false"} · button:Remove Design system {"disabled":"true"} · Tab: switch:Design system → ∅ → switch:Design system
- android (pass): togglebutton:Design system {"disabled":"true","pressed":"false"} · button:Remove Design system {"disabled":"true"} · Tab: togglebutton:Design system → togglebutton:Design system → togglebutton:Design system
