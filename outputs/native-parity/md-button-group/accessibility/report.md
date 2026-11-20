# md-button-group — accessibility parity

Generated 2026-11-05T01:32:18.189Z by tools/ax. Web = Chrome AX tree of the same effective node.

## default

- Web: radiogroup: · togglebutton:Day · togglebutton:Week · togglebutton:Month · Tab: togglebutton:Day
- macos (pass): togglebutton:Day {"selected":"true","pressed":"true"} · togglebutton:Week {"pressed":"false"} · togglebutton:Month {"pressed":"false"} · Tab: togglebutton:Day → togglebutton:Day → togglebutton:Day → togglebutton:Day
- ios (pass): switch:Day {"checked":"true"} · switch:Week {"checked":"false"} · switch:Month {"checked":"false"} · Tab: switch:Day → ∅ → switch:Day → ∅
  - expected target: ios: switch "Day" target 58×40 below 44pt
  - expected target: ios: switch "Week" target 67×40 below 44pt
  - expected target: ios: switch "Month" target 73×40 below 44pt
- android (pass): togglebutton:Day {"pressed":"true"} · togglebutton:Week {"pressed":"false"} · togglebutton:Month {"pressed":"false"} · Tab: togglebutton:Day → togglebutton:Day → togglebutton:Day → togglebutton:Day

## multi-select

- Web: togglebutton:Day · togglebutton:Week · togglebutton:Month · Tab: togglebutton:Day
- macos (pass): togglebutton:Day {"selected":"true","pressed":"true"} · togglebutton:Week {"pressed":"false"} · togglebutton:Month {"pressed":"false"} · Tab: togglebutton:Day → togglebutton:Day → togglebutton:Day → togglebutton:Day
- ios (pass): switch:Day {"checked":"true"} · switch:Week {"checked":"false"} · switch:Month {"checked":"false"} · Tab: switch:Day → ∅ → switch:Day → ∅
  - expected target: ios: switch "Day" target 58×40 below 44pt
  - expected target: ios: switch "Week" target 67×40 below 44pt
  - expected target: ios: switch "Month" target 73×40 below 44pt
- android (pass): togglebutton:Day {"pressed":"true"} · togglebutton:Week {"pressed":"false"} · togglebutton:Month {"pressed":"false"} · Tab: togglebutton:Day → togglebutton:Day → togglebutton:Day → togglebutton:Day

## no-selection

- Web: togglebutton:Day · togglebutton:Week · togglebutton:Month · Tab: togglebutton:Day
- macos (pass): togglebutton:Day {"selected":"true","pressed":"true"} · togglebutton:Week {"pressed":"false"} · togglebutton:Month {"pressed":"false"} · Tab: togglebutton:Day → togglebutton:Day → togglebutton:Day → togglebutton:Day
- ios (pass): switch:Day {"checked":"true"} · switch:Week {"checked":"false"} · switch:Month {"checked":"false"} · Tab: switch:Day → ∅ → switch:Day → ∅
  - expected target: ios: switch "Day" target 58×40 below 44pt
  - expected target: ios: switch "Week" target 67×40 below 44pt
  - expected target: ios: switch "Month" target 73×40 below 44pt
- android (pass): togglebutton:Day {"pressed":"true"} · togglebutton:Week {"pressed":"false"} · togglebutton:Month {"pressed":"false"} · Tab: togglebutton:Day → togglebutton:Day → togglebutton:Day → togglebutton:Day
