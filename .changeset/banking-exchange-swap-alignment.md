---
'@awc-ui/showcase-kit': patch
---

**banking:** the exchange ticket's swap control now sits on the same line as
the two currency selects it sits between. The row is a three-column grid with
`align-items: start`, so the 40px icon button aligned to the top of a 56px
select and rode 8px high. It is now offset by half the difference between the
two heights — and only the grid ITEM is offset, not the tooltip and the button
both, which doubled it to 16px on the first attempt. Below 720px the row stacks
and the control centres instead.
