---
'@awc-ui/core': patch
---

**md-navigation-rail:** the FAB's icon now stays put — in both directions.

The rail's stated invariant, documented at the top of its stylesheet, is a
stationary icon axis: a 24px icon centred in the 80px collapsed rail sits at
x=28, and the 12px expanded inset is chosen so every expanded control lands back
on 28 — "ZERO horizontal icon movement during the expand/collapse spring". Every
control kept that promise except the FAB, which broke it twice.

**Expanding**, `.md-navigation-rail__fab` added `padding-inline-start: 12px` on
top of the host's own 12px expanded inset. Double-counted, the FAB's leading
edge sat at 24 instead of 12 and its icon at x=40 against x=27.5 collapsed — and
it did not glide, it moved the whole 12.5px in a single frame and then held
while only the width animated.

**Collapsing**, the wrapper reverted to `justify-content: center`, which
resolves against the ANIMATING host width. The rail narrows 220→80 in 200ms, the
FAB runs its own 500ms morph spring, and the state flips instantly — three
unrelated timelines, so the centred FAB was dragged past its target: the icon
left 28, dipped to 16.67 (about 11px below its resting place) and sprang back. A
rubber-band on every collapse.

The FAB is now leading-anchored in both states, the same idiom the rail's logo
and toggle already use. Collapsed, the inset is whatever centres the FAB,
`(rail - fab) / 2`; expanded, the host's inset already supplies it and the
wrapper adds nothing. Both put the leading edge at 12px and the icon at 28, so
across the whole transition the FAB only changes WIDTH — nothing translates.

Measured, sampling every frame: the icon holds x=28 at every sample in both
directions, against 27.5→40 (one-frame jump) expanding and 28→16.67→27.5
rubber-banding collapsing before.

New `--md-navigation-rail-fab-size` (default `56px`) is the collapsed FAB
footprint the centring is computed from. 56px is the M3 FAB and what an extended
FAB collapses to, so it is correct for `size="standard"`, for a labelled FAB,
and for every FAB in this component's own stories. A consumer slotting a
`size="medium"` or `size="large"` icon-only FAB should set it to that width, or
its icon lands off the axis by half the difference.
