---
'@awc-ui/core': patch
---

**md-menu-item:** a selected item's trailing text and supporting text now take
the selected on-colour with the headline. Selection flipped the `__trailing`
container to `inherit`, but the count is `__trailing-text`, which carries its
own `color` — and a child's own colour beats anything its parent inherits — so
a selected item's number stayed on-surface-variant, unreadable on the selected
container. Fixed for the base and both menu variants.
