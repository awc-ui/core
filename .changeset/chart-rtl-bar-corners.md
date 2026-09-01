---
'@awc-ui/core': patch
---

**charts:** a horizontal bar keeps its rounded end at the value under `dir="rtl"`.

`mirrorScene` flipped each bar's box but left `radius` alone, and a bar is rounded
on the end its value grows towards — the right in LTR. Mirrored, the bar grew
leftward while the rounding stayed on the right, so every RTL bar was square at
the value and rounded against the axis: the shape read backwards. The two
horizontal corner pairs now mirror with the box. Vertical bars are unaffected —
they grow along an axis this does not mirror, and their left/right corners are
symmetric.
