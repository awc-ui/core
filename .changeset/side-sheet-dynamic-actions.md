---
'@awc-ui/core': patch
---

Fix side-sheet action footers missing when React or another consumer adds their
slotted buttons after the sheet connects. Action presence now follows direct
light-DOM additions, removals, slot reassignment, and reconnects; nested action
slots no longer create an empty footer. Custom close and back controls retain
native slot assignment and fallback behavior without stale one-time listeners.
