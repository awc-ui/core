# Pictor for Angular

The full creative studio, rendered with native Angular standalone components and AWC custom elements. The app includes projects, curated document previews, an editable canvas, an asset library, profiles, command search, a component inspector, SVG/PNG/JSON exports, and interactive presentation mode.

## Run

From the repository root, after installing workspace dependencies and building the core runtime and showcase kit:

```sh
pnpm --filter @awc-ui/showcase-design-angular dev
pnpm --filter @awc-ui/showcase-design-angular lint
pnpm --filter @awc-ui/showcase-design-angular build
pnpm --filter @awc-ui/showcase-design-angular serve
pnpm --filter @awc-ui/showcase-design-angular verify:browser
```

Development runs at `http://localhost:4382/showcase/design/angular/`. The production server defaults to port 4471. Production output is `dist/browser`; each known route receives an empty Angular shell for static hosting.

## Architecture

`StudioService` subscribes to the framework-free `@awc-ui/pictor-model` store and exposes its snapshots as an Angular signal. Store notifications enter Angular's zone so native component events and storage changes update templates. All previews use `layersForFile`, which preserves saved edits and matches the document opened in the canvas.

`CanvasComponent` owns pointer capture, transient drag previews, marquee selection, pan, and resize gestures. A completed gesture commits once to the shared document history. The layer tree, inspector, and insertion panels call the same document API. Angular templates render every screen, SVG layer, and live AWC component directly.

Custom elements use native property bindings and `md*` custom events under `CUSTOM_ELEMENTS_SCHEMA`. Dialogs mount only while open and filter close events to their own host, so closing a nested select does not close an export dialog. The component runtime is served intact from `public/awc-runtime`, preserving Stencil's lazy chunk loading.

The dock preserves framework, theme, density, and locale options. The application uses the same browser-local document storage as the other Pictor ports.

## Verification

`lint` runs the Angular template compiler, checking TypeScript and templates. `verify:browser` starts an isolated production server and browser profile, then exercises template replacement, drawing and undo/redo, geometry edits, persisted reloads, command navigation, SVG download, presentation, and browser errors. It requires a current production build and a Puppeteer-compatible browser; `PUPPETEER_EXECUTABLE_PATH` can select an installed browser.
