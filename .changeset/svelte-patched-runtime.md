---
"@awc-ui/svelte": major
---

Require Svelte 5.57 or later so integrations use a runtime with the current security fixes. Svelte 4 is no longer supported. When upgrading client applications, replace `new App({ target })` with `mount(App, { target })` and `$destroy()` with `unmount(app)` from `svelte`.
