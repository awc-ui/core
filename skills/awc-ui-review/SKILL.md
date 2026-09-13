---
name: awc-ui-review
description: Review or fix AWC UI Core integrations for documented API usage, accessibility, responsive layout, forms, and overlay behavior. Use for an AWC interface audit or a specific AWC interaction or layout defect; keep review-only requests read-only.
---

# Review an AWC UI integration

Find concrete, reproducible defects in the requested surface and distinguish consumer integration mistakes from Core component defects. Preserve the task's scope: an audit produces findings; a requested fix may change the affected code. Neither implies a redesign, package upgrade, deployment, or changes to unrelated projects.

## Establish the contract

Determine the installed `@awc-ui/core` and framework wrapper versions from the manifest and lockfile. Read the affected component manuals and framework integration guidance before judging behavior.

- In an installed package, use the resolved `@awc-ui/core/main-llm.md`, `src/components/<tag>/readme.md`, and `custom-elements.json`.
- In a Core checkout, use root `main-llm.md`, `packages/core/src/components/<tag>/readme.md`, `packages/core/custom-elements.json`, and the corresponding framework package documentation.
- When an AWC MCP server is available, `search_components`, `get_component`, `list_guides`, and `get_guide` provide discovery and documentation. Resources include `awc://components/{tag}/manual`, `awc://components/{tag}/api`, and `awc://guides/{id}`. Verify the server version matches the consumer before treating its API as available. The review must also work with local documentation alone.

Treat the director as reference material for the current task. Do not restart its product interview or impose a new configuration on an existing project. If a newer Core release already addresses the defect, identify the installed-version gap instead of claiming the current consumer has that fix.

## Investigate the affected behavior

Start from the user's reproduction and inspect both consumer code and the rendered component. Follow only the checks relevant to the surface:

- **API and state:** Wrong prop/event names, missing custom element registration, wrapper/Core mismatch, incorrect `event.detail`, conflicting controlled state, or repeated remounts. Confirm accepted children and slot placement; do not assume a visually similar control shares another component's contract.
- **Layout:** Compare before/after bounds for selection, validation, collapse, tab changes, and loading. Check shrinkable grid/flex ancestors, long labels, full-width fields, and logical padding. A stable toolbar must accommodate both its ordinary and selection actions.
- **Tables:** Confirm the Core container or frozen-header table owns the intended scroll region. Keep toolbar/pagination outside it via their documented slots. Verify real horizontal scrolling on a narrow viewport and in RTL when supported; hiding document overflow does not repair an unreachable column.
- **Forms:** Check a real form, control names, validation messages, first-invalid focus, Enter submission, correction/reset, and disabled/loading submission. Preserve inline Core validation. Read form-controller documentation before replacing component validation or adding event handlers.
- **Overlays and steps:** Check one action region, reachable footer actions at small heights, first focus, keyboard dismissal, focus restoration, and nested picker behavior. Do not unmount an overlay on its initial close event if its exit is still running; inspect `whenClosed()` or the wrapper helper. For async step validation, follow the documented veto-and-commit contract rather than recursively calling navigation methods.
- **Accessibility and presentation:** Verify accessible names on icon actions and inputs, keyboard order, selected/error contrast, icon font loading, relevant light/dark themes and density, and reduced-motion behavior. Check labels and directional layout in the locales the project supports.
- **Feedback:** Confirm loading states reflect real work, skeletons reserve meaningful space, refreshes retain useful context, and failures leave a clear recovery action. Check duplicate submission behavior rather than only the spinner's appearance.

Prefer evidence from a browser reproduction and the smallest relevant automated check. A screenshot can establish alignment but not keyboard, focus, or scrolling behavior. State when those could not be exercised.

## Fix at the appropriate layer

When a fix is requested, use a documented public API or consumer layout correction if the component already supports the behavior. If a minimal valid composition still fails, identify it as a Core defect. In a Core-library task, fix that shared behavior and add a focused regression check; in a consumer-only task, report the Core issue and keep any local workaround narrow and explicit. Do not silently edit installed package files or expand into a library-wide refactor.

For reviews, lead with actionable findings: severity, file/location, concrete trigger, observable impact, and the smallest recommended correction. Omit hypothetical issues and stylistic preferences presented as bugs. For fixes, report the changed behavior and checks performed. If no issue is found, say so and name any material verification gap.
