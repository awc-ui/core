---
'@awc-ui/core': minor
---

**md-organization-chart:** a selection now traces back to its root.

Selecting a node outlined that node and nothing else, so in a tree more than two
levels deep the reader had to follow identical grey connectors by eye to work out
where it hung. The selected branch and every ancestor of it now carry
`md-org-chart__branch--on-path` and the `branch-on-path` CSS part, and the
connectors that belong to them take `--md-org-chart-selected-color`.

The drop out of each node on the path and the riser back up into it belong to
exactly one node each, so those are tinted directly. THE HORIZONTAL RUN IS
MEASURED instead: the bus is tiled from a half per child and the parent's drop
stands at the group's 50%, which coincides with a half boundary only when every
sibling is the same width — and a node is sized by its own name. So the run is
drawn as one element spanning the measured distance from the outermost riser to
the drop, re-measured on reflow (the tree's box, not just the viewport's, because
a webfont landing changes the content and not the container).

Three shapes were tried and rejected first, each recorded in the stylesheet so
they are not repeated: tinting the branch's own bus halves (they span its full
width, so the colour ran past the riser and ended in mid-air over the neighbour —
a bracket around the node, not a line into it); tinting nothing horizontal (two
coloured verticals floating off a grey bus); and arithmetic over whole halves,
which lands on the boundary nearest the drop and leaves a visible stub of grey
short of the junction.

New parts: `branch` on every tree item, `branch-on-path` on those on the trail.
Multiple selections each get their own trail. No new markup and no layout change:
the connectors were already drawn, and the ring is a `box-shadow`.
