---
'@awc-ui/core': minor
---

**md-date-picker:** the trigger's 360px width ceiling is now a public property,
`--md-date-picker-trigger-max-width` (default `360px`; set `none` to fill a wide
form column the way `md-time-picker` does). It was the only bare literal in a
`:host` block where every other dimension is configurable, and it left a picker
in a form column 200px short of its neighbours with no way out but overriding
the host from outside. The panel is unaffected — it sizes from its own panel
properties, never from the host.
