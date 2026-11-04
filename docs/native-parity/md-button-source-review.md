# Button source review

Gate 1 for `md-button` (2026-10-28, fork fx). Source: `packages/core/src/components/md-button/`
(`md-button.tsx`, `md-button.css`) and its dependency `md-ripple`. Reviewed against the generated
contract in `readme.md`, the Custom Elements Manifest and the M3 button spec; every property, event,
slot, part and CSS hook below was exercised in Chrome 153 on macOS.

## Public contract

* **Properties (24):** `variant` (filled · outlined · text · elevated · tonal, default filled), `size`
  (xs · sm · md · lg · xl, default sm), `shape` (round · square), `shapeMorph` (default true), `type`
  (button · submit · reset), `href`, `target`, `icon`, `trailingIcon`, `mirrorIcon`,
  `suppressExpandIconFlip`, `toggle`, `selected`, `disabled`, `softDisabled`, `loading`, `fullWidth`,
  `ripple` (default true), `roleOverride`, `density` (0, −1…−4), `value`, and the internal group
  properties `connectedLeft`, `connectedRight`, `groupTabindex` (set by md-button-group /
  md-split-button) — 24 in total (20 public in the generated table).
* **Events (2):** `mdClick` (cancelable; detail `{ value, toggle, selected, href, target,
  originalEvent }`) on every activation, then `mdChange` (`{ selected, value }`) when toggle mode
  flips `selected`. Both bubble and are composed.
* **Slots (4):** default (label), `leading-icon`, `trailing-icon`, `loader`. A named icon slot
  replaces the matching property.
* **Parts:** `state-layer`, `icon`, `label`, `trailing-icon`, `loading`, `anchor` (link mode).
* **CSS hooks (28):** container/label/icon/trailing-icon/loading/state-layer/outline/focus-ring
  colours, the three state-layer opacities, icon/trailing-icon/loading sizes, font size/weight/line
  height/letter spacing, padding inline/block, gap, container shape, outline width, and
  width/min/max/height/min-height.

## Interaction reference (Chrome)

* Pointer: `:hover` state layer 0.08 (100 ms standard), `:active` 0.12 (50 ms emphasized
  decelerate), shape morph to the pressed radius (200 ms) and back (400 ms); `md-ripple` wave from
  the press point to the farthest corner, 450 ms grow, release fade 150 ms. The fade is chained on
  the grow animation's `finished` promise, so it starts on the first frame at or after the grow end.
* The wave colour is the host's `currentColor` (the label colour, not the state-layer colour) and the
  wave plays under `prefers-reduced-motion` too (the CSS transitions do not).
* Paint order: `<md-ripple>` precedes the state-layer span, so the state layer paints over the wave.
* Keyboard: Enter/Space activate on keydown with a 150 ms press pulse and a centred wave.
* Soft-disabled and loading buttons keep `tabindex="0"`: a press focuses them, activation is blocked.
* Elevation: `box-shadow: var(--md-sys-elevation-N)` (elevated 1, hover 2; filled/tonal hover 1;
  `:active` back to the resting level), drawn outside the border box.

## Source defects fixed (test-first)

Both were red in `link.e2e.ts` before the fix and green after; mirrored in `packages/core/src`.

* **(a) A keyboard-focused link button showed no focus ring and no focus state layer.** In link mode
  the inner `<a>` holds focus inside the shadow root; neither `:host(:focus-visible)` nor
  `:host(:has(.md-button__anchor:focus-visible))` can see it (`:has()` from `:host` does not match
  shadow content). Fix: the host mirrors the anchor's `:focus-visible` as the class
  `md-button--anchor-focus-visible` (`handleAnchorFocus`/`handleAnchorBlur`), which drives the ring,
  the focus state-layer opacity and the variant focus elevations.
* **(b) A link button's anchor covered only the content box.** The anchor is `md-ripple`'s measuring
  parent, the hit area and the focus target, so the link button's wave was sized and centred on the
  label box, and the anchor's `block-size: 100%` resolved to auto inside the host's flex row (20 px
  in a 40 px button). Fix: link mode moves the host padding onto the anchor (outlined subtracts the
  outline width) and the anchor stretches to the flex line (`align-self: stretch; block-size: auto`).
  A link button now lays out, ripples and paints exactly like the plain button.

Results (private tree, then canonical): md-button, md-button-group and md-split-button spec + e2e
280/280.

## Behaviour kept as-is (native renderers must match)

* `::part(state-layer) { opacity }` outranks the per-state opacity rules (a fixed opacity in every
  state); modelled as `stateLayerOpacity` in the native appearance.
* `--md-button-width` fixes the border box; overflowing content clips.
* Density tapers padding, gap, icon, font and line height (`max(floor, base + rung × slope)`).

## Decisions (autonomous, 2026-10-28, reversible)

* Link-mode focus is mirrored with a host class rather than restructuring the shadow DOM (the anchor
  must stay the focus target for native link activation). Revert: remove `anchorFocusVisible` and the
  class rules; the two link e2e tests then fail again.

## Evidence

`outputs/native-parity/md-button/`: `source-tests/after-fix2.log` (280/280), `web-reference/`
(oracle pages and server), `web-oracle/` (Chrome 153: paint 317 button + 37 FAB cases, states 35
runs, reduced motion 5 runs, with `shotStart`/`shotEnd` capture windows).
