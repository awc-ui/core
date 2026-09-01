---
'@awc-ui/core': patch
---

**md-organization-chart:** the selection trail draws cleanly at every position in
the tree.

The run from a selected node up to its parent's drop is one measured L-shaped box
(top border, side border, corner radius), and it has to compose with connectors
the branches draw themselves — from borders that are shared, partly overlapping,
and shaped differently depending on whether a branch is the first, middle, last or
only child. Five artefacts came out of that and are fixed together:

- The drawn branch's riser is HIDDEN, not merely untinted — leaving it grey still
  painted a second line beside the trail's own.
- The box lands on the same pixels that riser occupied, rather than stopping at
  the branch's centre, so selecting a node moves nothing.
- The elbow-bearing pseudo-element draws the riser AND its bus half from one box,
  and the radius curves both; where the run covers that half entirely it is
  hidden, and where the drop falls inside it — a branch wider than its sibling —
  the box and the branch both square their corner instead, so two straight lines
  coincide exactly rather than a curve leaving grey visible inside it.
- `data-trail-drawn` is cleared across every branch each pass. Clearing it only
  for the current trail left it behind on deselection, and the branch it was left
  on went on hiding its riser.
- The trail re-measures on `animationend`. Expanding a collapsed subtree animates
  a `scale()`, and `getBoundingClientRect()` reports the scaled box while it runs
  — a ResizeObserver cannot see it, because a transform changes no layout size.
