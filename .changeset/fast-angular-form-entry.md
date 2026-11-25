---
'@awc-ui/angular': minor
'@awc-ui/core': patch
---

Add `@awc-ui/angular/forms` for applications using native custom elements with Angular forms. The entry exports the existing SSR-aware value accessors without importing every component proxy; the main Angular entry and `AwcUiModule` keep the same accessor identities and behavior.

Skip the pre-upgrade property metadata scan when a newly constructed custom element has no own properties. Existing upgraded elements still preserve configurable own properties, including non-enumerable values, and their precedence over initial attributes.
