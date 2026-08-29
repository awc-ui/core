---
'@awc-ui/core': patch
---

**md-table-toolbar:** a slotted `md-select` no longer starves the other actions
beside it.

`md-select`'s host is `inline-size: var(--md-select-width, 100%)` — the right
default in a form column, and a claim on the entire line when the select is one
control among several. In a toolbar's actions row that made the select's flex
basis the whole actions box, so the flex algorithm had to shrink something. What
it shrank was the filter chip next to it: `md-chip`'s label sets
`overflow: hidden`, which drops the chip's automatic minimum size to zero, so it
collapsed silently rather than pushing back — 95px of chip squeezed into 79,
rendering "Open only" as "Open ...".

The actions row now sizes a slotted select by its content (`--md-select-width:
auto`), so the row adds up on its own and nothing has to shrink. This is the
same mechanism the block already used for slotted icon buttons: the container
tells its slotted controls what size means in there, through their own public
custom properties.

A consumer who genuinely wants a full-bleed select in a toolbar can set
`--md-select-width` back, or pass `full-width`.
