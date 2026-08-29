---
'@awc-ui/core': minor
---

**md-chip:** new `content-align` prop — `start | center | end`, default `center`.

`:host` is `justify-content: center`, which is right for the chip a chip
normally is: one that shrink-wraps its label, where the content box and the
container are the same size and alignment is a no-op. It becomes wrong the
moment a layout gives the chip a width — a grid column, `align-self: stretch`,
an explicit `inline-size`. The label then floats in the middle of a wide
outlined box and reads as an empty input rather than a chip, and a chip that is
labelling something beneath it no longer shares a leading edge with what it
names.

Until now the only fix was for the consumer to override `justify-content` from
outside the shadow root, which works but puts a component's internal layout in
the layout's hands.

The values are logical: `start` is the leading edge under `dir="rtl"` too.
`center` remains the default, so nothing changes for existing markup.
