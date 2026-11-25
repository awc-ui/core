---
'@awc-ui/core': patch
---

Resolve tabs forwarded through wrapper slots before the tablist implementation loads. Tab panels now establish their accessibility links regardless of component bundle arrival order, without adding timers or delaying the first render.
