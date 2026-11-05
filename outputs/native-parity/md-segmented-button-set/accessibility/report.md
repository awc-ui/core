# md-segmented-button-set — accessibility parity

Generated 2026-10-29T11:11:39.460Z by tools/ax. Web = Chrome AX tree of the same effective node.

## single

- Web: radiogroup: · radio:Day · radio:Week · radio:Month · Tab: radio:Day → radio:Week → radio:Month
- macos (pass): radio:Day {"selected":"true","checked":"true"} · radio:Week {"checked":"false"} · radio:Month {"checked":"false"} · Tab: radio:Day → radio:Week → radio:Month → radio:Day
- ios (pass): checkbox:Day {"selected":"true","checked":"true"} · checkbox:Week {"checked":"false"} · checkbox:Month {"checked":"false"} · Tab: checkbox:Day → checkbox:Week → checkbox:Month → ∅
  - expected target: ios: checkbox "Day" target 116×40 below 44pt
  - expected target: ios: checkbox "Week" target 116×40 below 44pt
  - expected target: ios: checkbox "Month" target 117×40 below 44pt
- android (pass): radio:Day {"checked":"true"} · radio:Week {"checked":"false"} · radio:Month {"checked":"false"} · Tab: radio:Day → radio:Week → radio:Month → radio:Day

## multiselect

- Web: checkbox:Day · checkbox:Week · checkbox:Month · Tab: checkbox:Day → checkbox:Week → checkbox:Month
- macos (pass): checkbox:Day {"selected":"true","checked":"true"} · checkbox:Week {"checked":"false"} · checkbox:Month {"checked":"false"} · Tab: checkbox:Day → checkbox:Week → checkbox:Month → checkbox:Day
- ios (pass): checkbox:Day {"selected":"true","checked":"true"} · checkbox:Week {"checked":"false"} · checkbox:Month {"checked":"false"} · Tab: checkbox:Day → checkbox:Week → checkbox:Month → ∅
  - expected target: ios: checkbox "Day" target 116×40 below 44pt
  - expected target: ios: checkbox "Week" target 116×40 below 44pt
  - expected target: ios: checkbox "Month" target 117×40 below 44pt
- android (pass): checkbox:Day {"checked":"true"} · checkbox:Week {"checked":"false"} · checkbox:Month {"checked":"false"} · Tab: checkbox:Day → checkbox:Week → checkbox:Month → checkbox:Day
