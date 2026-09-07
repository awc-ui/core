# Pictor · HTML

A native DOM design workspace built with TypeScript and AWC web components. It has Projects, Assets, Profile, and individual project, file, and asset routes, plus the editable Pictor studio.

The `.tsx` files use JSX as a compile-time notation for DOM construction. The TypeScript `jsxFactory` is the local `dom` function in `src/dom.ts`; `Fragment` handles sibling nodes. This produces real HTML/SVG elements and native event listeners. The app does not import React or a virtual-DOM runtime. `src/main.tsx` owns navigation and shell surfaces, while `src/editor.tsx` and `src/canvas.tsx` keep editor and gesture lifecycles explicit.

Document state comes from `@awc-ui/pictor-model`, shared with the four native framework ports. Start from a template, draw and arrange layers, edit text and appearance, and insert live AWC controls. Present mode makes those controls interactive. The command palette (⌘/Ctrl K) searches actions, files, projects, and assets; Components exposes markup and documentation for the controls on screen.

Canvases and undo/redo history autosave to local storage. ⌘/Ctrl S saves immediately and the header reports the result. Ports on the same origin share local documents; a different browser or origin has its own copy. There is no cloud account or collaboration backend.

SVG and PNG export use the current visible document. Live controls become labeled vector placeholders, and exported files do not reproduce every blend, mask, or image adjustment. JSON downloads contain layer data; JSON import is not offered. Export work before clearing browser storage.

## Run and verify

Use the repository's Node and pnpm versions. From the repository root:

```sh
pnpm install
pnpm --filter @awc-ui/core build
pnpm --filter @awc-ui/showcase-kit build
pnpm --filter @awc-ui/showcase-design-html dev
```

Open the printed URL at `/showcase/design/html/`. The showcase dock controls framework, theme, locale, and density.

```sh
pnpm --filter @awc-ui/showcase-design-html lint
pnpm --filter @awc-ui/showcase-design-html test
pnpm --filter @awc-ui/pictor-model verify
pnpm --filter @awc-ui/showcase-design-html build
pnpm --filter @awc-ui/showcase-design-html verify
```

`test` checks native DOM integration. `verify` uses the shared five-framework Puppeteer runner against the built app with isolated storage and caches. It checks real template selection, drawing, undo/redo, geometry input, reload persistence, command/file navigation, SVG download, and presentation. See the shared package README for browser configuration and failure artifacts.

For a manual check, draw a rectangle and undo/redo it, set X to `120`, save and reload, switch files and return, then insert a live control and try it in Present. Check Export and Components, and use the dock and a narrow viewport to review themes and compact navigation.
