---
'@awc-ui/core': patch
---

Preserve nested components' own styling during SSR hydration. Parent class annotations distinguish authored classes from each child's host classes, so date-picker labels, select backgrounds and spacing, menus, and nested buttons retain their initial appearance while later state changes still remove obsolete classes.
