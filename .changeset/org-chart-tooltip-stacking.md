---
'@awc-ui/core': patch
---

**md-organization-chart:** the toggler's tooltip is no longer painted under the
node below it — while open, or while fading out.

`md-tooltip`'s popup is `position: fixed; z-index: 1500` — high enough to clear
anything on the page, and irrelevant here, because a z-index only ranks an element
among its siblings inside the nearest STACKING CONTEXT. The node card is one
(`position: relative` plus the `z-index: 2` that lifts it above the connector
lines), so 1500 resolved inside the node while the node itself still ranked 2
against its siblings — and any node painted later in the DOM covered the tooltip
outright. Measured on a four-node tree: the popup rendered at its correct
position, with its full z-index, entirely behind the child node beneath it.

The stylesheet already warned against `transform` / `will-change` on the node for
being the same defect one step worse (a containing block cuts the popup off rather
than merely losing it); a stacking context was the half nobody had named.

The node the pointer or the keyboard is in now lifts above its siblings, and the
lift OUTLASTS the pointer: the popup fades out over `duration-short2` instead of
being hidden at once, so dropping back the moment `:hover` was lost re-trapped it
mid-fade and it vanished under the node below rather than fading in place. The
hold reads the same motion token the tooltip's own `visibility` defer does, so the
two cannot drift. Measured after mouse-out: z-index 4 at +30ms and +90ms with the
tooltip still the topmost element at its own centre, back to 2 by +400ms.

The resting paint order is unchanged.
