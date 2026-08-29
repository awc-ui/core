---
'@awc-ui/core': patch
---

**md-navigation-rail:** slot presence (logo, header, fab, footer) is now seeded
from the light DOM in `componentWillLoad`, before the first render. It used to
be written only by each slot's `slotchange`, which fires after first render — so
every rail's first painted frame had no `--with-fab` class, a hidden FAB
wrapper, and no header-space padding: the destinations painted ~99px high and
dropped one frame later on every cold load, and a consumer could only pre-pad
from outside with copies of the rail's internal expressions. `slotchange` still
owns every later change.
