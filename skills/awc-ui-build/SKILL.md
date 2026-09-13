---
name: awc-ui-build
description: Build or update interfaces using AWC UI Core components and their framework wrappers. Use when a project uses @awc-ui/core or the user requests AWC components; preserve the existing framework and product scope.
---

# Build with AWC UI

Implement the requested interface with documented Core components, tokens, and interaction contracts. Resolve already-decided framework, design, and behavior from the project and conversation; ask only for missing information that affects the task. A small edit does not require a new product interview or app scaffold.

## Locate the matching documentation

Inspect the project's package manifest and lockfile for `@awc-ui/core` and its framework wrapper version. Use documentation matching that version before relying on a newer feature.

- **Installed package:** Find the resolved `@awc-ui/core` directory, normally `node_modules/@awc-ui/core`. Read its `main-llm.md`, `src/components/<tag>/readme.md`, and `custom-elements.json`. Workspace and package-manager links may resolve elsewhere.
- **Core checkout:** Use root `main-llm.md`, `packages/core/src/components/<tag>/readme.md`, and `packages/core/custom-elements.json`. Framework setup is documented in the matching `packages/<framework>/README.md`.
- **Optional AWC MCP:** Discover available tools. Use `search_components` to find candidates, `get_component` to read their manuals/API, and `list_guides` / `get_guide` for setup and composition guidance. The equivalent resources are `awc://components/{tag}/manual`, `awc://components/{tag}/api`, and `awc://guides/{id}`. Check the server's library version against the consumer version; MCP is not required.

Read the relevant setup, decision-matrix, and composition sections of the build director. Then read each selected component's manual before writing its markup, including its alternatives, accepted children, slots, events, and state contract. Do not infer AWC props from a similarly named component in another library. If documentation and installed types differ, inspect the installed implementation or report the specific version mismatch.

## Compose the interface

- Use the project's existing registration strategy and framework wrappers. Do not register components repeatedly on every render. Keep browser-only registration outside SSR server code, and load Core tokens once.
- Verify the document loads the expected text and icon fonts. An `icon` name alone does not install the Material Symbols font; use the existing asset policy and documented icon options.
- Choose components by the user's interaction: navigation, selection, disclosure, search, feedback, or an action. Confirm the manual's “When NOT to use” before substituting one control for another.
- Prefer public props, slots, CSS parts, and tokens over Shadow DOM manipulation or duplicated controls. Use normal semantic HTML and layout CSS around Core components where no component is needed. Do not add components solely to increase the count.
- Read custom event payloads from `event.detail` and use the wrapper's documented event names. Keep state controlled consistently; preserve stable element identity when changing tabs or selection so component initialization does not replay unnecessarily.
- Let flexible children shrink (`min-inline-size: 0`) and use logical properties. Apply documented full-width behavior where the field or group should fill its container. Keep readable table columns inside the Core scroll region instead of clipping page overflow.

## Preserve the interaction contracts

For forms, use a real form, named form-associated controls, and a submit button. Core handles inline constraint feedback and single-line Enter submission; preserve those paths instead of adding hidden value mirrors, browser validation popovers, or duplicate key handlers. Read the current form guide for controller APIs and async validation.

For dialogs, sheets, and steppers, read the relevant composition and lifecycle guidance. Use one intentional action region; avoid both the stepper's built-in navigation and a duplicate custom footer. Allow overlay close animations to finish before removing the element. Use the documented React `useOverlay` helper when appropriate and available in the installed wrapper version.

Represent actual pending work with a component's built-in `loading` state, a Core loading/progress indicator, or a layout-matched skeleton. Prevent repeated submissions and retain useful existing content during refreshes. Do not add artificial delays to make a loader visible.

## Verify the requested result

Run the project's relevant build and checks. Exercise the changed interaction, including its invalid, empty, pending, or error state when applicable. Check a narrow viewport, keyboard operation, and the project's supported themes/densities/RTL. Confirm icons render, actions remain reachable, and selection or validation does not unexpectedly move surrounding controls. Report what changed, what was verified, and any remaining limitation.
