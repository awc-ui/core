# Pictor shared model

`@awc-ui/pictor-model` is the framework-free document engine used by the HTML, React, Vue, Svelte, and Angular design showcases. The private workspace package exports TypeScript directly; each application bundles it with its own native UI. `styles.css` supplies the common workbench, canvas, profile, and dialog styling alongside `@awc-ui/showcase-kit/design/app.css`.

## State and adapters

`createDocumentStore()` returns `getSnapshot()`, `subscribe(listener)`, and `dispose()`. Read the initial snapshot before subscribing; listeners announce subsequent changes. Snapshot identity stays stable until state changes. Treat returned layers and history as read-only and use the `DocumentApi` methods to edit them.

Each port owns its rendering and event bindings. React uses `useSyncExternalStore`; the Vue, Svelte, and Angular adapters bridge subscriptions into their native reactive state. The HTML port subscribes directly and updates DOM surfaces. Canvas gestures and panel state belong to those adapters; document transactions, undo/redo, templates, storage validation, previews, and SVG generation belong here.

`commitLayers(kind, transform, nextSelection?)` commits a validated batch as one undoable edit. It protects locked layers and rejects invalid trees atomically. `replaceCanvas(layers)` explicitly replaces the canvas in one undoable transaction. `layersForFile(fileId)` returns current edits, cached edits, or curated initial layers without opening or saving that file, so previews and editors show the same content.

## Local persistence

Documents, selections, and undo/redo history use the versioned local-storage key `awc:pictor:documents:v1`. Existing valid v1 documents are restored as saved, including content created before curated starter designs. Invalid active documents fall back to the initial design. Changes and an initially subscribed workspace autosave; `save()` reports success immediately through its return value and `saveStatus`.

Ports on the same origin share this cache. Another origin or browser has a separate workspace. There is no server sync; export important work before clearing site data. SVG/PNG output represents live controls as labeled vectors and does not reproduce every interactive canvas effect. JSON export contains layer data; the showcase has no JSON import UI.

## Checks

From the repository root:

```sh
pnpm --filter @awc-ui/pictor-model verify
pnpm --filter @awc-ui/showcase-design-svelte build
pnpm --filter @awc-ui/showcase-design-svelte verify
```

The Node model tests bundle the actual engine with esbuild and replace only the browser storage boundary. They cover snapshot notifications, initial autosave, legacy caches, file switching, history transactions, nested groups and duplicates, preview consistency, invalid data, storage failure, and SVG XML escaping.

The common browser runner accepts `html`, `react`, `vue`, `svelte`, or `angular`:

```sh
node apps/showcase/design/shared/scripts/verify-browser.mjs react
```

It starts that application's built-file server, verifies exact build bytes and deep links, and uses a fresh Puppeteer context, profile, and cache. The same assertions cover templates, real drawing, undo/redo, geometry input, saved reloads, file navigation, commands, SVG downloads, and presentation in every framework. Build and browser failures fail the command. Set `PUPPETEER_EXECUTABLE_PATH` for an installed Chromium browser and `PICTOR_VERIFY_ARTIFACTS` to retain a framework-named failure screenshot. These checks require a browser-capable environment; Node model tests do not validate layout or browser rendering.
