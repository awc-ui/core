---
"@awc-ui/core": minor
"@awc-ui/react": minor
---

Make imperative overlay opening safe before the first CSR render. Add `whenClosed()` to dialogs, side sheets, menus, and FAB menus without changing existing `close()` or `mdClose` timing. Expose a React `useOverlay` hook that waits for Core's exit completion before notifying consumers to unmount, and ignores close events from nested controls.
