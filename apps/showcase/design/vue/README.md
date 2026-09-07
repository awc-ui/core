# Pictor · Vue

A native Vue 3 port of the Pictor design studio. Vue templates render the application and AWC custom elements; the framework-free `@awc-ui/pictor-model` package owns document edits, history, curated starting designs, and browser persistence. It does not mount React or an iframe.

## Run

From the repository root after the workspace install and core/showcase-kit builds:

```sh
pnpm --filter @awc-ui/showcase-design-vue dev
pnpm --filter @awc-ui/showcase-design-vue lint
pnpm --filter @awc-ui/showcase-design-vue test
pnpm --filter @awc-ui/showcase-design-vue build
pnpm --filter @awc-ui/showcase-design-vue serve
```

Development runs at `http://localhost:4378/showcase/design/vue/`. The production server accepts `PORT` and serves the same mount path. The build copies the AWC lazy runtime and emits static HTML entries for every known route.

## Application

Projects, project details, assets, asset details, profile, and editor routes use the same data and shared styles as the sibling implementations. The editor includes pointer drawing, selection, group movement and resizing, padded workspace pan and Fit, layers, artwork/live UI/color insertion, inspector, history, export, and interactive presentation. The command palette and component lens persist across navigation.

`src/composables/useDocument.ts` subscribes a Vue ref to the shared document store. `v-awc` assigns custom-element properties and subscribes to exact-case AWC events. Native Vue state owns view controls and transient canvas previews; committed changes go through the shared store. All ports use the same versioned browser storage key on a given origin, so switching frameworks keeps the active design.

## Verification

`lint` checks all TypeScript and Vue templates. `test` mounts the actual Vue components with the shared store in an isolated DOM and checks routes, dialogs, command search, custom-event control updates, drawing, selection, group gestures, pan, undo/redo, and persistence. It does not simulate browser layout or AWC shadow-root rendering; visual and custom-element integration checks require a real browser.
