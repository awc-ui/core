# Pictor · React

An interactive design workspace built with React and AWC UI web components. Start with an Orbit, Pulse, or Fieldnotes template, then edit the actual layers on a 960 × 640 canvas.

- Draw shapes and text; select, move, resize, duplicate, group, arrange, hide, and lock layers.
- Edit text, geometry, colors, opacity, blend modes, and image adjustments in the inspector. Geometry snaps to a 20px grid.
- Insert assets and live AWC controls. Present mode lets you interact with those controls.
- Search commands, files, projects, and assets with **⌘/Ctrl K**. The **Components** action shows the real AWC elements used on the current screen, their markup, and documentation links.
- Undo and redo edits, switch files, and return to your saved canvas and history.

Documents autosave to this browser's local storage; **⌘/Ctrl S** saves immediately. The header reports whether saving succeeded. There is no account sync or collaboration backend. Clearing site data removes local documents, and a different browser or origin has its own workspace. Export a copy before clearing storage.

SVG and PNG export capture the current visible layers. Live controls become labeled vector placeholders; exported files do not retain interactions. The export renderer uses its own text rendering and does not reproduce every canvas blend, mask, or image adjustment exactly. A JSON download contains layer data, but this demo does not offer a JSON import workflow.

## Run

Use the Node and pnpm versions declared by the repository. From the repository root, install dependencies and build the shared packages once:

```sh
pnpm install
pnpm --filter @awc-ui/core build
pnpm --filter @awc-ui/showcase-kit build
pnpm --filter @awc-ui/showcase-design-react dev
```

Open the URL printed by Vite at `/showcase/design/react/`. The showcase dock retains theme, language, density, and framework controls; the expanded editing workspace is implemented in this React app.

```sh
pnpm --filter @awc-ui/showcase-design-react lint
pnpm --filter @awc-ui/showcase-design-react build
pnpm --filter @awc-ui/showcase-design-react verify
```

`verify` starts a dedicated server for `dist/` and launches Puppeteer with an isolated context, temporary profile, and empty cache. It checks real template selection, drawing, undo/redo, geometry input, saved reloads, file switching, command search, SVG download, and presentation. Missing builds, browser launch failures, missing controls, and runtime errors fail the command. Use `PUPPETEER_EXECUTABLE_PATH` to select an installed Chromium browser. Set `PICTOR_VERIFY_ARTIFACTS` to a directory to keep a screenshot when a browser check fails.

## Manual check

1. Choose Pulse and confirm **Make it yours**. Draw a rectangle, undo once, then redo; the object should return.
2. Select it and enter `120` in the inspector's X field. Save, reload, and confirm the position and undo history survive. Open another file and return.
3. Use **⌘/Ctrl K** to find Projects, Assets, a file, and Export. Download an SVG or PNG and open the downloaded file.
4. Insert an AWC control, enter Present, and interact with it. Close Present and continue editing.
5. Open Components, copy markup, and follow a documentation link. Change the theme in the dock and narrow the viewport to check the compact layout.
