---
'@awc-ui/core': patch
---

Keep table sort arrows and header aria-sort in sync when column IDs are assigned
through JavaScript or React properties. Prefer the live column property over
stale attributes, refresh dynamically changed labels and replaced headers, and
leave nested tables' sort indicators under their own table's control.
