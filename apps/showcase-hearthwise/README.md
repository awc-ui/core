# Hearthwise — Smart Home Control

Hearthwise is a fictional smart-home control panel built as a single plain-HTML page with no
build step: the token sheet loads straight from `node_modules/@awc-ui/tokens/src/tokens.css`
and every component registers via a module-script import of `@awc-ui/core/loader`, exactly as
in the repo README quick start. A footer navigation bar switches between four in-page screens
covering device control, per-zone lighting, a live interface re-tint driven by a colour
picker (the chosen colour is mapped onto `--md-sys-color-*` roles on `:root` in plain JS),
and an energy dashboard.

## Screens

- **Rooms** — grid of device cards, each with a power `md-switch`, an `md-status-dot`
  reflecting device health, and a settings trigger.
- **Lighting** — brightness and colour-temperature `md-slider`s for three zones with live
  readouts.
- **Ambience** — an inline `md-color-picker` whose value re-tints the page's MD3 colour
  roles in real time, with a live-preview card.
- **Energy** — circular and linear `md-meter`s plus three `md-sparkline`s of 14-day usage.
- **Device settings** (overlay) — `md-bottom-sheet` opened from any device card, with
  sliders, switches and save/cancel actions.

## AWC components exercised

`md-card`, `md-switch`, `md-status-dot`, `md-slider`, `md-color-picker`, `md-meter`,
`md-sparkline`, `md-bottom-sheet`, `md-navigation-bar`, `md-navigation-tab`,
`md-icon-button`, `md-button`.

## Run

```bash
pnpm --filter @awc-ui/showcase-hearthwise dev
# then open http://localhost:4180/
```

## Build

```bash
pnpm --filter @awc-ui/core build          # build.mjs reads packages/core/dist/md3
pnpm --filter @awc-ui/showcase-hearthwise build
```

`build.mjs` emits `dist/` — a self-contained static tree that can be dropped at **any**
mount path. It does two things the dev page cannot:

- **Relative everything.** The dev page loads its token sheet and the Stencil loader out of
  `node_modules/`, which only resolves when the app dir is the web root. The build copies
  those into `dist/` and rewrites each reference to `./`-relative, so there is not a single
  leading-slash URL in the output and there is no base path to configure. Stencil's lazy
  loader already resolves its chunks against `import.meta.url`, so it follows along.
- **Declarative Shadow DOM.** The HTML is run through `@awc-ui/core/hydrate` with
  `serializeShadowRoot: 'declarative-shadow-dom'` — the same primitive as the Astro
  middleware and the SvelteKit/Nuxt server hooks — so the file on disk already carries every
  component's shadow tree and the page renders fully styled before the runtime boots.

One caveat that comes with relative URLs: the page must be served **with** its trailing
slash. `…/hearthwise/index.html` and `…/hearthwise/` are fine; `…/hearthwise` (no slash)
resolves `./app.css` one directory too high. Netlify and `python3 -m http.server` both 301
to the trailing slash, so this only bites a host configured not to.
