# Habitat — Maple House smart home

An interactive smart home showcase built with AWC UI Material Design 3 components. Habitat manages the fictional Maple House through five views: Home, Rooms, Scenes, Energy, and Routines.

- [Showcase guide](https://awc-ui.dev/showcase/smart-home/)
- [Open Maple House](https://awc-ui.dev/showcase/smart-home/html/)

## Try it

- Toggle lights, plugs, the purifier, speaker, and door lock. Adjust brightness, volume, fan speed, and blinds position.
- Apply a scene and see the same device state update across views. Adjust climate temperature and mode.
- Browse all five rooms, open device details, and change favorites.
- Compare daily and weekly simulated energy readings. Current power responds to devices and climate.
- Create routines, toggle schedule previews, and use Run now to apply their scenes.
- Open Make it yours beside the avatar for primary color, density, light/dark appearance, English/Arabic, and RTL.

Device state and routines are simulated in memory and reset on reload. Schedule times are previews and do not run background automation. Only device-local appearance preferences use localStorage. No physical devices, identity service, or backend are connected. Optional WebMCP tools operate on the same simulated state when the browser exposes a compatible registry.

## Development in the core repository

Requires Node 22.13+ and pnpm. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @awc-ui/core build
pnpm --filter @awc-ui/smart-home dev
```

The local server is [http://127.0.0.1:4497](http://127.0.0.1:4497). Run `pnpm --filter @awc-ui/smart-home build` after source edits to refresh the static output. The build finds the core runtime in the enclosing monorepo. For a separate app checkout, set `AWC_CORE_ROOT` to the core repository path after building the library.

The docs build stages this app at `/showcase/smart-home/html/`. All runtime, stylesheet, font, and image references are relative so the same build works at this nested route.

## Verification and components

`pnpm --filter @awc-ui/smart-home lint` checks module syntax. `pnpm --filter @awc-ui/smart-home test` verifies coordinated scenes, device state, power calculations, routine validation and identities, and the optional WebMCP tool contracts with an in-process registry. These checks do not verify browser rendering or a browser's actual WebMCP registry.

AWC owns navigation, the app bar, cards, switches, sliders, meters, charts, status dots, segmented controls, chips, forms, sheets, dialogs, skeletons, action progress, tooltips, avatars, and snackbars. Application CSS handles responsive composition and uses public component tokens.

The generated living room image is under `public/images`. Fonts and the AWC runtime are served locally; font licenses are included in `public/licenses`. The bundled AWC theme helper retains its license in `src/vendor`.
