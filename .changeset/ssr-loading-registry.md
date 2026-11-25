---
'@awc-ui/core': patch
---

Render loading indicators safely during SSR when the hydrate environment exposes a null browser custom-element registry. Loading controls retain their server-rendered spinner, while browser-only lazy registration remains deferred until needed.
