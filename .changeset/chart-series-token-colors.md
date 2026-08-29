---
'@awc-ui/core': patch
---

**charts:** a series or slice coloured with `var(--md-sys-color-*)` or
`color-mix(...)` now renders. `CSS.supports('color', 'var(--x)')` is true
because substitution is deferred, so token references passed the validity guard
and then failed on canvas — `fillStyle` rejects them silently and keeps its last
colour, producing a blank chart with an empty console. `resolveSeriesColor` now
routes them through `resolveComputedColor`, the same resolver axis bands always
used, twelve lines away in the same file. Plain hex/rgb/named colours are
untouched, and because resolution happens inside the chart, a theme or accent
flip re-resolves on the chart's own theme watcher — no consumer-side probe or
listener needed.
