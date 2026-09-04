---
'@awc-ui/core': patch
---

**md-navigation-tab:** a large badge now sits on the tab's ICON rather than on
its indicator pill. It was anchored to the 56px-wide active indicator, so on a
tab whose label is wider than its glyph the count floated in the space beside
the icon with nothing under it — reading as a badge belonging to the label. It
is now offset by half the gap between the indicator and the icon on each axis,
which puts it on the glyph's corner whatever the label does.
