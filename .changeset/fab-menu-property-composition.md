---
'@awc-ui/core': minor
---

FAB menus preserve consumer-controlled icons and support property-driven item labels.

`md-fab` exposes `setMenuIcon()` for the menu's temporary visual glyph. The menu no
longer overwrites the authored `icon` property, so framework rerenders cannot undo
the close glyph and icon updates made while open appear when the menu closes.
Custom slotted icons are preserved through the same morph and cleanup.

FAB-menu typeahead reads current item `label` properties as well as slotted text,
including property changes that leave an older label attribute in the DOM.
