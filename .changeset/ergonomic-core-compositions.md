---
"@awc-ui/core": minor
"@awc-ui/react": patch
"@awc-ui/angular": patch
"@awc-ui/vue": patch
---

Add `md-search.whenClosed()` to await both exit stages and focus/scroll cleanup before removing search or opening another overlay. Preserve existing `close()` and `mdClose` timing, cancel stale focus work, and keep completion safe across reopen and disconnect.

Keep basic dialog headers/actions visible while the body scrolls and traverse slotted/shadow controls in composed keyboard order. Prevent table row Enter/Space activation from hijacking nested controls. Correct navigation previous-index bookkeeping and clamped no-op events without removing programmatic `mdChange`.

Give skeletons a theme-aware contrasting fill on filled surfaces. Document shared dialog/stepper footers, asynchronous forms and feedback, controlled routing, full-width appearance controls, and responsive table chrome. Add desktop/mobile, RTL, reduced-motion, and keyboard regression coverage.
