# md-segmented-button — accessibility parity

Generated 2026-11-05T01:32:19.718Z by tools/ax. Web = Chrome AX tree of the same effective node.

## standalone

- Web: radiogroup: · radio:Day · radio:Week · radio:Month · Tab: radio:Day → radio:Week
- macos (pass): radio:Day {"selected":"true","checked":"true"} · radio:Week {"checked":"false"} · radio:Month {"checked":"false"} · Tab: radio:Day → radio:Week
- ios (pass): checkbox:Day {"selected":"true","checked":"true"} · checkbox:Week {"checked":"false"} · checkbox:Month {"checked":"false"} · Tab: checkbox:Day → checkbox:Week
  - expected target: ios: checkbox "Day" target 116×40 below 44pt
  - expected target: ios: checkbox "Week" target 116×40 below 44pt
  - expected target: ios: checkbox "Month" target 117×40 below 44pt
- android (pass): radio:Day {"checked":"true"} · radio:Week {"checked":"false"} · radio:Month {"checked":"false"} · Tab: radio:Day → radio:Week
