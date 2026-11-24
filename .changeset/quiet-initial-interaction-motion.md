---
"@awc-ui/core": patch
---

Render initial control state without interaction animations across the component library, including custom-element upgrade, server hydration and parent initialization. Preserve feedback for the first real action and later changes. Respect static skeletons and reduced-motion settings, and add browser regression coverage for every component.

Resolve parent-owned tab, panel and navigation state during server rendering so the first paint matches the hydrated view. Load the pre-upgrade stylesheet in the starter integrations and verify startup with delayed JavaScript and font loading.

Preserve server-rendered hosts and component classes while frameworks hydrate, including Svelte 5 dynamic children and either loading order of the framework and component runtime. Keep subsequent state changes and the first real input authoritative.
