---
"@awc-ui/core": patch
"@awc-ui/react": patch
"@awc-ui/vue": patch
"@awc-ui/angular": patch
---

Render initial control state without interaction animations across the component library, including custom-element upgrade, server hydration and parent initialization. Preserve feedback for the first real action and later changes. Respect static skeletons and reduced-motion settings, and add browser regression coverage for every component.

Resolve parent-owned tab, panel and navigation state during server rendering so the first paint matches the hydrated view. Load the pre-upgrade stylesheet in the starter integrations and verify startup with delayed JavaScript and font loading.

Preserve server-rendered hosts and component classes while frameworks hydrate, including Svelte 5 dynamic children and either loading order of the framework and component runtime. Keep subsequent state changes and the first real input authoritative.

Preserve quoted text, explicit false values and inline styles through the React server wrapper. Serialize Vue properties using their actual component attribute aliases, including initial multiple selections. Keep formatted text intact during server validation.

Serialize Angular reactive-form values and ordinary property bindings before server rendering. Reconcile server-owned presentation with the client's actual initial state, preserve properties assigned before custom-element registration, and retain consumer attributes, styles and classes during adoption.

Handle forwarded slots and nested native input correctly, avoid unnecessary cold-start descendant scans, and release deferred element-definition subscriptions when controls disconnect.

Reserve built-in field icon geometry while fonts load, keeping custom SVG slots and caret size/font overrides intact. This prevents text fields and selects from shifting as ligatures replace fallback text.

The additional SSR ownership reconciliation measures 19.21 kB Brotli for the reference button import. Its audited budget increases from 19 to 19.3 kB; the 16 kB CSR and 2 kB React wrapper budgets remain unchanged.
