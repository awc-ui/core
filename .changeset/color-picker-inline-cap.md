---
'@awc-ui/core': patch
---

**md-color-picker:** the inline variant no longer overflows a container
narrower than its designed width. `max-inline-size: 100%` now caps the host —
the same house rule `md-side-sheet` ships. `--md-color-picker-width` still sets
the designed width; it just can no longer win against a smaller parent.
