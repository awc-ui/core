# Avatar source review

Source: `packages/core/src/components/md-avatar/md-avatar.tsx` and `md-avatar.css`, plus the
CEM entry in `packages/core/custom-elements.json`. This review covers gate 1 (contract
inventory, source tests, demonstrated defects). Evidence lives in
`outputs/native-parity/md-avatar/`.

## Public contract

**Properties (11).**
- `src`, `alt`, `name`, `initials`, `label`: strings, default `''`.
- `size`: `small | medium | large` (reflected) or any CSS length. A unitless number means px. A custom value is written to the host as an inline `--md-avatar-size`.
- `shape`: `circle | rounded | square` (reflected).
- `colorFromName`: boolean, default `true` (attribute `color-from-name`, reflected).
- `loading`: `eager | lazy` (default lazy).
- `crossorigin`: `'' | anonymous | use-credentials`.
- `density`: `0…−4` (reflected). A local negative rung overrides the inherited `--md-sys-density-scale`, and zero inherits.

**Events.** `mdLoad` and `mdError`, both with `{src}`. They are emitted from the `<img>` load and error handlers.

**Methods.** None.

**Slot.** The default slot is a custom fallback. It is rendered only when there is no usable image and no initials, and it replaces the built-in person icon.

**Parts.** `image`, `initials`, `icon`.

**CSS hooks (25).**
- `--md-avatar-size`
- `-container-color`, `-container-shape`
- `-label-color`, `-label-font-family`, `-label-font-size`, `-label-font-weight`, `-label-letter-spacing`
- `-icon-size`
- `-outline-color`, `-outline-width`
- `--md-avatar-palette-{1…7}-container` and `--md-avatar-palette-{1…7}-label`

## Behaviour reference

**Fallback chain.** image → initials → slot → person icon.
- A failed `src` stays failed until `src` changes. `@Watch('src')` clears `imageFailed`.
- While an image is shown, the host has the `--mode-image` class and a transparent container.

**Initials.**
- Explicit `initials` are trimmed, cut to 3 graphemes (`Intl.Segmenter`) and upper-cased with `toLocaleUpperCase`.
- Otherwise the first grapheme of the first and last whitespace token of `name` is used.

**Palette.**
- Bucket 1…7 = `abs(hash) % 7 + 1`, where `hash = (h<<5) − h + charCode | 0` over the UTF-16 code units of the seed.
- The seed is the first non-blank of `initials`, `name`, `label`, each trimmed.
- There is no palette when `colorFromName` is false or in image mode.
- Buckets 1–4 use the primary/secondary/tertiary/error container pairs.
- Buckets 5–7 use `color-mix(in srgb, accent 22%, surface)` and `color-mix(in srgb, accent 72%, on-surface)`, where accent is primary, tertiary or secondary.

**Accessibility.**
- With a label: `role="img"` and `aria-label`, where the label is the first non-empty of `label`, `alt`, `name`, then trimmed.
- Without one: `role="presentation"` and `aria-hidden="true"`.
- The image, initials and icon are `aria-hidden`.

**Geometry.**
- Size presets:
  - small: `max(18, 24 + 1.5s)`
  - medium: `max(28, 40 + 3s)`
  - large: `max(40, 56 + 4s)`

  where `s` is the density scale.
- The hook replaces the preset, and a custom `size` wins over the hook.
- Label font is 0.4 × size, icon is 0.6 × size.
- Letter spacing is 0.05em, line-height 1, title-medium weight (500), `tnum`.
- The icon is a Material Symbols `person` ligature in an icon-size box with `direction: ltr`.
- Radius: circle 50%, rounded corner-medium (12px), square 0. Corners are physical.
- The outline is an inset ring (`outline-offset: −width`) painted over the content.
- `overflow: hidden` clips the content and slotted badges.

**Slotted content.**
- `::slotted(*:not(md-badge))` is an icon-size inline-flex box that centres its content, with `font-size` equal to the icon size and `color: inherit`.
- A slotted `md-badge` is not resized. It positions itself against the host, at the physical top-right corner translated by its own offsets, inside the clip.

## Source tests and defects

**Baseline.** Before any change, `md-avatar.spec.ts` and `md-avatar.e2e.ts` passed 45/45 (`source-tests/baseline.log`).

**Defect: whitespace-only `initials` was not treated as unset** (fixed, test first).
- The documentation says initials apply only when non-empty. But `if (this.initials)` treated `'   '` as present, so the avatar rendered an empty initials span (mode `initials`, no text) instead of deriving `AL` from the name.
- The palette seed `(initials || name || label).trim()` likewise hashed the blank override to `''`, which gives no palette.
- The new e2e test `md-avatar.blank-initials.e2e.ts` failed 2/2 before the fix (`blank-initials-before.log`). After the fix the private tree run passes 17 suites / 314 tests (`after.log`).
- The fix trims before testing. The palette seed takes the first non-blank of the three.
- Diff and before copy: `source-changes/md-avatar.tsx.{before,diff}`. They are mirrored into `packages/core/src` (sha256 `708b1814…`); `packages/core/dist` was not rebuilt in place.

The Chrome oracles were captured from the private build that contains the fix.

## CEM drift and open source decisions

- **CEM drift (fixed by gate-7 r3-06):** the 14 palette hooks (`--md-avatar-palette-{1…7}-container/label`) were documented in the CSS header and implemented, but missing from `custom-elements.json` (11 hooks listed); the header now lists them individually and the CEM has all 25. The native APIs expose them (`paletteContainerColors` / `paletteLabelColors`).
- **Open decision (not changed):** `--md-avatar-container-color` and `--md-avatar-label-color` have no effect whenever a name palette applies, which is the default for any named avatar. The palette classes set `--_container-color`/`--_label-color` from the palette hooks. To recolour a named avatar an author must set the palette hook for its bucket or `color-from-name=false`. Native mirrors this.
- `loading` and `crossorigin` are forwarded to `<img>`. Chrome re-requests a displayed image when `crossorigin` changes (an extra `mdLoad`, recorded in the lifecycle oracle).

## Decisions (autonomous, 2026-10-27, reversible)

- **Name palette vs container/label hooks — kept (source contract).** For a named avatar with `color-from-name` (default) the
  palette bucket's `--md-avatar-palette-N-container/label` wins over `--md-avatar-container-color`/`--md-avatar-label-color`;
  native mirrors it. Alternative: let the explicit hooks win over the palette (a source change: drop the palette's
  `--_container-color`/`--_label-color` assignment when the author set the generic hooks). Revert: none needed; to adopt the
  alternative, change md-avatar.css test-first and flip both native appearance resolvers (`AWCAvatarAppearance`).
- **CEM drift — fixed.** The CSS header now lists the 14 palette hooks individually, so the generated docs/CEM list all 25 (gate-7 r3-06).
