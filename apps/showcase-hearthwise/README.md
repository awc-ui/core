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
