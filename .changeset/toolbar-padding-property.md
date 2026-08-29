---
'@awc-ui/core': patch
---

**md-table-toolbar:** `--md-table-toolbar-padding-inline` now actually does
something.

The property is documented at the top of the stylesheet and was read into
`--_pad-inline`, but `padding-inline` then inlined the density expression
directly and never referenced it — so setting the property was a silent no-op,
and anything trying to line up with the toolbar's left edge (a filter row under
it, a caption beside it) had to guess and re-derive the expression by hand.

`--_pad-inline` now carries the density expression as its default and
`padding-inline` uses it. The rendered value is unchanged at every rung —
24 / 22 / 20 / 18 / 16px — so this only affects consumers who were already
setting the property and getting nothing.
