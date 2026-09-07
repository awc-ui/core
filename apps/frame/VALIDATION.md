# Frame validation

The app is installed in `core/apps/frame`. The monorepo lockfile includes its existing local `@awc-ui/core` dependency. Library source is unchanged. The docs configuration, showcase pages, build cache inputs, and deployment entry checks include Frame. Existing unrelated repository changes were preserved.

## Checks completed

- All five production builds succeed with the installed workspace toolchains: HTML modules, React/Vue/Svelte Vite builds, and ahead-of-time Angular compilation.
- `pnpm --filter @awc-ui/frame lint` passes.
- Twenty-three tests pass: eight model tests, eight media-controller tests, four loading/action lifecycle tests, one nested showcase asset test, and two framework-link tests.
- All 36 checked text/background pairs across the generated accents and light/dark palettes exceed 4.5:1; the lowest measured ratio is 6.43:1.
- Browser checks at desktop, 820 px tablet, and 390 px phone widths. No horizontal page overflow at the tested phone and tablet widths.
- Category filtering, search suggestions and submitted results, saving a video through its menu, Watch later navigation, likes, and comments.
- Actual video playback confirmed with `readyState = 4` and an advancing playback time.
- A 1.1 MB MP4 imported from the file picker, displayed on its own watch route, then reloaded successfully from IndexedDB.
- Light/dark and accent changes, compact density, radio semantics for exclusive preferences, named icon buttons, Escape focus restoration from the appearance sheet, and the skip link.
- No JavaScript warning/error logs appeared during the inspected browser flows.

The app uses demo media and browser storage. The checks above do not constitute a full accessibility audit or validation of a production video backend.

## Component and layout refinement

- Audited markup: 30 distinct AWC UI component types. No authored native buttons, text inputs, range inputs, selects, or textareas; only the hidden native file input remains.
- Replaced browser video chrome with an AWC toolbar, icon buttons/tooltips, seek and volume sliders, radio menu items for speed, and a circular buffering indicator.
- Browser-verified actual play/pause, one-second keyboard seeking, mute/unmute, 1.5× selection, fullscreen entry/exit, and the speed menu inside fullscreen. Toolbar arrow navigation moves between buttons without taking the slider’s keys.
- Verified the compact player at 390 px without horizontal page overflow.
- Replaced custom creator links, comments, preference rows, and the upload container with library lists/items and a card. Theme and compact controls still update the app.
- Removed the duplicate app-bar search hover surface and corrected clipping of the search suggestions. Verified the visible suggestions popup and two submitted results for “design”.
- Replaced the floated creator avatar with separate avatar/text columns. At 390 px, the creator eyebrow, title, and description share the same left edge (84 px) without page overflow.

## Frameworks and docs showcase

- Added the AWC `md-select` / `md-select-option` framework selector to the app bar. Its label remains readable, and phone search uses AWC’s icon trigger and full-screen layout.
- Browser-verified HTML → React → Vue → Angular → Svelte → HTML switching. Watch routes and an encoded search query retain the correct framework mount path.
- Played the same demo video in React, Vue, Angular, and Svelte. Checked seeking, mute, playback speed, and saved-video state carrying from React to the other hosts. No warning/error console entries appeared in those inspected flows.
- At 390 px, the header fits without horizontal overflow. Full-screen search opens, displays suggestions, submits “design” to two results, and preserves the query when switching frameworks.
- Confirmed the documentation page, sidebar entry, overview entry, sitemap, all component-documentation links, and five compiled app entries. Every entry resolves its scripts, styles, AWC runtime, and fonts beneath its own path.
- Followed the docs player deep link and switched to React at `/showcase/frame/react/#/watch/v9`; the actual app and player loaded without console errors.
- The documentation compiles with `pnpm exec astro build` (121 Astro pages plus the static showcase builds). The full `pnpm build` currently stops at the runtime sync guard because the shared core output contains mixed development and production entries. The successful Astro check uses the docs' already-synced runtime; it does not validate a fresh runtime sync. The changes are integrated locally and have not been published to the live site.

The framework versions share route rendering and media/storage behavior. Their shells are compiled by each framework and attach/dispose the controller through framework lifecycle hooks; these are integrations, not independent rewrites of every route view.

## Loading feedback

- All 23 tests pass, including cached/pending/failed image loading, late-event cleanup, duplicate async actions, overlapping progress, failed actions, media loading/error transitions, and duplicate play requests.
- All five framework builds include the startup skeleton markup and use the same image and action lifecycle helpers.
- `md-skeleton` brings the authored AWC component inventory to 30 types. Action buttons use the public `loading` prop and `loader` slot with `md-progress-indicator`.
- Browser-verified pending cover skeletons, inline button spinners, and the linear action indicator using controlled work with the production helpers and actual AWC components. Completing or rejecting work restores the button and clears busy/progress state; failed covers show their fallback.
- In the actual app, HTML video playback reaches readyState 4 and clears the player skeleton. Copying a link closes the dialog and clears progress. Angular imports the existing 1.1 MB test MP4, opens its watch route, and restores its controls. No warning/error console messages appeared in these app flows.
