# Frame — an AWC UI video app

A YouTube-inspired app with a cinematic discovery feed, a working video player, and 30 AWC UI component types. Ships working HTML, React, Vue, Angular, and Svelte integrations, following the repository’s `main-llm.md` and component manuals.

## Run in the core monorepo

Requires the built local AWC runtime at `packages/core/dist/md3`. It is already present in this checkout.

```sh
pnpm --filter @awc-ui/frame dev
```

Open **http://127.0.0.1:4390**. If this port is already in use, run with `PORT=4392`.

```sh
pnpm --filter @awc-ui/frame build
pnpm --filter @awc-ui/frame lint
pnpm --filter @awc-ui/frame test
```

`build` compiles all five integrations. React, Vue, and Svelte use Vite; Angular uses its ahead-of-time compiler. HTML uses native browser modules. Every build includes the AWC lazy runtime and self-hosted fonts. If dependencies or the library are missing, run `pnpm install` and `pnpm --filter @awc-ui/core build` first.

The preview server binds to loopback only. The root redirects to `/html/`; `/react/`, `/vue/`, `/angular/`, and `/svelte/` are sibling builds. Use the Node and pnpm versions required by the monorepo. A copy containing the compiled `dist/` can be served with `node scripts/serve.mjs` without installing the framework toolchains.

## Framework switching and documentation

Use the **Framework** select beside the logo. It uses `md-select` and `md-select-option`, keeps the hash route and URL query, and navigates within the same origin. Likes, saves, themes, comments, subscriptions, and IndexedDB video files therefore remain available across frameworks. Playback starts paused when another framework loads; the current playback time is not transferred.

The four framework hosts compile actual AWC shell elements with JSX, Vue/Svelte templates, or an Angular standalone component. Their mount and destroy hooks attach and dispose the shared controller. The feed, watch-page rendering, AWC events, media controller, and storage are shared JavaScript, rather than independently rewritten route views. No build embeds another in an iframe.

`src/shell.js` is the shell source; `scripts/generate-framework-shells.mjs` produces the checked-in framework templates. Edit the source and rebuild to update all versions. The controller owns only the designated empty content outlets and uses the library’s public APIs for shell controls.

The docs sidebar and showcase overview link to `/showcase/frame/`. Its page links to all five builds at `/showcase/frame/<framework>/`. The Astro integration compiles and stages them during docs development and production builds. Docs build caching includes Frame’s source and build inputs, and deployment checks require all five entries.

```sh
pnpm --filter @awc-ui/docs build
pnpm --filter @awc-ui/docs preview --host 127.0.0.1 --port 4325
```

## What works

- Home and Explore feeds, category filters, search suggestions, full search results, and sorting.
- Watch pages with AWC UI playback controls: play/pause/replay, ten-second skips, seek and volume sliders, mute, playback speeds, fullscreen, buffering, retry, and optional autoplay. The native video element handles decoding; native controls remain as a fallback if library controls cannot initialize.
- Creator pages and subscriptions; Watch later, likes, a combined library, and history recorded when playback starts.
- Saved-video undo and confirmed history clearing with undo.
- Comments, share-link dialog, and profile information.
- Local video import from a file picker or drag and drop, with title validation and a 100 MB limit. Files persist in IndexedDB; metadata persists in localStorage.
- Light, dark, and system themes; three generated accent palettes; compact density, expressive-motion controls, and a component inventory.
- Desktop navigation rail, tablet icon rail, and phone bottom navigation. `/` opens search. Keyboard focus returns from dialogs and the appearance sheet.

## Loading and action feedback

AWC skeletons reserve the startup feed layout, cover images, and video surface.
Cached covers appear immediately; failures remove the skeleton and show the
existing fallback. One startup region announces loading, while decorative
skeletons stay silent. A failed startup offers a reload instead of staying busy.

Import and clipboard actions use `md-button loading` with an AWC circular
progress indicator in the library’s `loader` slot. A shared linear indicator
tracks pending actions, and the import dialog explains that storage happens in
this browser. Duplicate submissions are blocked, errors restore the controls,
and closing the import dialog lets the save finish. Media loading, retry,
seeking, and pending playback use the player’s AWC progress indicator.

All states reflect actual work, with no minimum display time or simulated
percentages. The skeleton component handles the OS reduced-motion preference.

## Component composition

| Purpose | AWC UI components |
| --- | --- |
| Shell and navigation | `md-app-bar`, `md-navigation-rail`, `md-navigation-rail-tab`, `md-navigation-bar`, `md-navigation-tab`, `md-select`, `md-select-option` |
| Discovery | `md-search`, `md-list`, `md-list-item`, `md-chip`, `md-card`, `md-avatar` |
| Actions | `md-button`, `md-icon-button`, `md-tooltip`, `md-menu`, `md-menu-item` |
| Video controls | `md-toolbar`, `md-slider`, `md-progress-indicator`, plus the shared icon buttons, tooltips, and radio menu items |
| Preferences | `md-side-sheet`, `md-switch`, `md-segmented-button-set`, `md-segmented-button` |
| Forms and feedback | `md-dialog`, `md-text-field`, `md-snackbar`, `md-divider`, `md-skeleton` |

The app uses documented `md*` events, public CSS properties, and exposed parts. Theme palettes come from `@awc-ui/theme`; the neutral surface roles are overridden in `styles.css`. Creator lists, comments, and preference rows use `md-list` / `md-list-item`; the import area uses `md-card`. The search component owns its background and focus feedback inside the transparent app-bar search slot.

Custom HTML/CSS is limited to content and page composition: the video grid, editorial thumbnails, typography, responsive placement, media-event wiring, and the native file input (AWC has no file picker). Every visible playback control uses AWC. The toolbar, sliders, menus, navigation, and cards keep their own keyboard behavior; the app doesn’t add a second focus trap. With focus in the player, K/Space play or pause, J/L seek ten seconds, M mutes, and F toggles fullscreen. Arrow keys adjust focused sliders or move among toolbar buttons. Unsupported fullscreen controls are hidden.

## Structure

```text
src/app.js         Shared controller, route views, and AWC event handling
src/shell.js       Shared shell compiled into each framework template
src/frameworks.js Framework options and path-preserving links
frameworks/       Native framework hosts and lifecycle bindings
src/loading.js     Skeleton lifecycle and concurrent action feedback
src/player.js      AWC playback controls and HTMLMediaElement integration
src/model.js       State, selectors, browser storage, and IndexedDB
src/data.js        Fictional editorial fixtures and sample stream URLs
src/preboot.js     Theme and density applied before first paint
src/theme.css      Generated AWC theme palettes
src/styles.css     Responsive layout and component theming
public/fonts/     Self-hosted Roboto and Material Symbols
public/licenses/  Font licenses
scripts/          Build, localhost server, and state/media-controller tests
```

## Demo data and media

This is a complete local frontend showcase. It does not include a server, account authentication, a YouTube API integration, or public video hosting. Creators, view counts, editorial titles, and most durations are fictional. Demo playback is clearly credited on each watch page and does not necessarily match the editorial cover. Imported videos are real local files and are not sent to a server. Your saved data belongs to this browser and origin; clearing site data removes it.

Thumbnails use [Unsplash](https://unsplash.com). Sample streams use [MDN’s CC0 flower video](https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4), [Big Buck Bunny’s trailer hosted by W3C](https://media.w3.org/2010/05/bunny/trailer.mp4), [Sintel’s trailer](https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4), and [Tears of Steel](https://download.blender.org/demo/movies/ToS/tears_of_steel_720p.mov). Blender films belong to their respective Blender Foundation projects. These remote assets require an internet connection; image and player failure states keep the app usable when a resource is unavailable.

`dist/` is a static output and can be hosted beneath a path prefix. Routes use hashes, so a static host does not need SPA rewrite rules. A localhost URL is only reachable on the computer running the preview. Local-video share links cannot transfer an IndexedDB file to another browser.
