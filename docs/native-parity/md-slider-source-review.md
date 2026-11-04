# Slider source review (md-slider)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried,
six source defects are fixed test-first and mirrored into `packages/core/src`,
and a browser reference (paint, per-frame interaction and reduced-motion
oracles) is captured. The oracle is **provisional**: it was captured in
headless Chromium 141 on Linux while the Mac runner was blocked, and must be
recaptured on the Mac (Chrome 153) and diffed before it gates native work. No
native code has changed. This is not a native completion record.

## Public contract

**Props.**

* Value model: `min` (0), `max` (100), `step` (1), `value` (50, mutable),
  `range`, `valueStart` (0) / `valueEnd` (100) (mutable), `controlled`.
* Layout: `variant` (`standard` | `centered`), `stops`, `size`
  (`xs` default, `sm`, `md`, `lg`, `xl`), `orientation` (`horizontal` |
  `vertical`), `full-height` (vertical only), `density` (0 … −4).
* Value indicator: `value-indicator` (deprecated alias: `labeled`).
* Inset icon: `inset-icon` + `icon` (or the `inset-icon` slot). It renders
  only on a single-thumb slider at `md`, `lg` or `xl`.
* Accessibility: `aria-label`, `label-start` / `label-end`, `value-text`,
  `value-start-text` / `value-end-text` (each becomes the matching thumb
  input's `aria-valuetext`).
* Form: `name`, `name-start` / `name-end`, `disabled`.

**Anatomy.** Each thumb is a real `<input type="range">` (opacity 0) in the
shadow root. It provides the keyboard, the focus and the ARIA slider. A
painted thumb div is positioned by host CSS variables (`--_value-pct`,
`--_start-pct`, `--_end-pct`, `--_active-start-pct`, `--_active-width-pct`).

* Horizontal single sliders take the pointer on the native input.
* Range and vertical sliders take it on the rail (the inputs are
  `pointer-events: none`).
* Parts: `surface`, `track`, `track-inactive`, `track-active`, `inset`,
  `thumb-knob`, `state-layer` (always `display: none`), `value-indicator`.

**Steps and snapping.**

* Pointer values snap to `min + k·step`.
* Keyboard steps are the native ones: arrows ±step; PageUp/PageDown
  ±max(step, span/10); Home/End go to the bounds.
* An authored off-step value is not snapped (see S6).

**Range.**

* Thumbs push rather than block: moving one past the other moves both.
* A pointer drag hands over to the other thumb, so the values never cross.
* A track press picks the nearer thumb (ties go to the end thumb when the
  press is at or past it).

**Controlled mode.**

* User input never writes `value` / `valueStart` / `valueEnd`; the events
  report the requested value.
* During a pointer drag the thumb follows the pointer (live state). When the
  gesture or key step commits, it returns to the prop (fixed S2 and S8).

**Events** (all bubble and are composed):

| Event | Detail |
|---|---|
| `mdInput` | `{value}`; range `{value, valueStart, valueEnd}` with `value` = the moved thumb (fixed S1) |
| `mdChange` | Same shape as `mdInput` |
| `mdFocus` / `mdBlur` | `{thumb: 'single' \| 'start' \| 'end'}` |
| `mdDragStart` / `mdDragEnd` | `{thumb, value}` plus `valueStart` / `valueEnd` for range |

**Event order** (from the oracle):

* **Horizontal single, pointer** (native input):
  `DragStart → Focus → Input… → DragEnd → Change`.
  A track click is `DragStart → Input → Focus → DragEnd → Change`.
* **Range or vertical, pointer** (rail):
  `DragStart → Input (at press) → Input… → Change → DragEnd`.
* **Keyboard, per key:** `DragStart` on keydown → `Input` → `Change` →
  `DragEnd` on keyup. `mdChange` therefore fires on every key press, not "on
  key release" as the readme says.
* A disabled slider emits nothing (fixed S9).

**Accessibility.**

* Each thumb input carries its own ARIA: `aria-valuenow` and `aria-valuetext`
  (only when a `*-text` prop is set); `aria-orientation`; `aria-label`, which
  falls back to the literal "slider", "range start" or "range end".
* The vertical inputs use a vertical writing mode, so Chromium exposes
  `orientation: vertical` (fixed S7).
* The host also mirrors `aria-label` and `aria-orientation`; the host has no
  role.

**Keyboard and RTL.**

* Horizontal: the native mapping. In RTL, ArrowRight decreases.
* Vertical: Up/Right increase and Down/Left decrease in both directions
  (fixed S7). PageUp/PageDown and Home/End are unchanged.

**Form association** (`formAssociated`):

* A single slider submits `String(value)` under `name`.
* A range slider submits one entry per thumb, under `name-start` /
  `name-end`, falling back to `name` for both.
* No name means no entry.
* `formResetCallback` restores the authored values.
* `formStateRestoreCallback` re-applies a string or the two FormData
  entries.
* Changing `min` or `max` re-clamps all values.

**Motion** (tokens resolved in the oracle):

* Knob press morph: width 4 → 2 and height ×1.05, 100ms
  `cubic-bezier(0.2, 0, 0, 1)`.
* Stops "spring": the active-track width, 350ms
  `cubic-bezier(0.42, 1.67, 0.21, 0.9)`.
* Tick fades: opacity and colour, 200ms `cubic-bezier(0.34, 0.8, 0.34, 1)`.
* With `prefers-reduced-motion: reduce`, all of these are removed (0
  animation records; fixed S4).

**Density.** The host block size, the track and the knob taper by 4 per step;
the track has an 8px floor. The value bubble now tapers to 44/40/36/32/28 and
stays inside its reserved head room (fixed S10).

## Layout reference (DPR 1, 480px wide, light theme)

| Size | Track height | Outer radius | Handle (w × h) | Host block size |
|---|---|---|---|---|
| xs | 16 | 8 | 4 × 44 | 44 |
| sm | 24 | 8 | 4 × 44 | 44 |
| md | 40 | 12 | 4 × 52 | 52 |
| lg | 56 | 16 | 4 × 68 | 68 |
| xl | 96 | 28 | 4 × 108 | 108 |

* **Track segments:** inner corners have radius 2. There is a 4px gap on each
  side of the handle: at value 30 the active track is 24–162, the knob
  166–170, and the inactive track starts at 174.
* **Pressed knob:** 2 wide and ×1.05 tall (46.19 at xs).
* **Centered:** the active segment runs from the midpoint to the value.
* **Range:** an inactive segment on each side; the far one is the track's
  `::after`.
* **RTL** mirrors every segment and both thumbs.
* **Stops:** 4×4 dots at each step.
* **Value indicator:** a 48 × 44 pill (min sizes), 4px above the handle. It
  uses label-medium (12/16, weight 500). Horizontal sliders reserve
  `bubble + 4` of block padding (92 tall at xs). The text is `value` to the
  step's decimals (0.35 at step 0.05).
* **Inset icon:** 24px at md/lg and 32px at xl, 8px from the inline-start
  edge, centred on the track. It does not move (see S11).
* **Vertical:** the track length defaults to 200 (`--md-slider-track-length`).
  The track is centred in the host's inline size; at xs the thumb is 44 × 4.
  `full-height` fills a definite-height parent (160 / 320 tested) and keeps a
  44-wide host.
* **Density** (xs host / track / knob): 44/16/44, 40/12/40, 36/8/36,
  32/8/32, 28/8/28.

## Paint reference

| Element | Light | Dark |
|---|---|---|
| Active track, handle | primary `rgb(103,80,164)` | `rgb(208,188,255)` |
| Inactive track | secondary-container `rgb(232,222,248)` | `rgb(74,68,88)` |
| Tick on the active track | on-primary `rgb(255,255,255)` | `rgb(56,30,114)` |
| Tick on the inactive track | `rgb(30,25,43)` | `rgb(232,222,248)` |
| Value bubble | inverse-surface `rgb(49,48,51)`, text `rgb(244,239,244)` | inverse pair |
| Inset icon on the active track | on-primary (`--md-slider-inset-icon-active-color`) | — |
| Focus | 3px solid secondary outline on the knob, offset 2 | — |
| Disabled | host opacity 0.38 **and** on-surface at 38% / 12% (S5) | — |

All 20 `--md-slider-*` hooks are captured, together and one at a time
(`hook-*` cases).

## Interaction and motion reference

The runs are listed in the oracle README. Each phase has per-frame samples of
the value props, the position variables, the thumb and knob rects, the active
track, ticks, bubble, inset-icon class, and the inputs' value, `aria-valuenow`
and focus.

## Source defects fixed (test-first)

Each new test failed on the unchanged source and passes after the fix. The
tests are in `md-slider.contract.e2e.ts` (17 tests; 11 failed before their
fixes, 6 are guards that passed before and after).

* **S1. Range keyboard events reported the wrong thumb** (`md-slider.tsx`).
  `mdInput` and `mdChange` from a keyboard step on the start thumb carried
  `value` = the end thumb. `rangeDetail()` now takes the moved thumb.
  * Test: range keyboard detail, plus a pointer-drag guard.
* **S2. Controlled mode left the native input stale** (`md-slider.tsx`).
  After a rejected or clamped step, the input kept 53 while the prop and
  `aria-valuenow` were 50. Later steps drifted, and a clamping handler could
  not be stepped back off its cap in one press.
  * Fix: `componentDidRender` writes the shown value back to each input.
  * Tests: 3 (single rejected, clamping handler, range).
* **S4. Reduced motion was ignored** (`md-slider.css`). The knob press morph,
  the stops spring and the tick fades all animated.
  * Fix: a `prefers-reduced-motion` block.
  * Tests: a guard without the media feature, and the reduced case.
* **S7. Vertical sliders were exposed as horizontal and mis-mapped arrows in
  RTL** (`md-slider.css`). Chromium ignores `aria-orientation` on a native
  range and takes the orientation, and the arrow mapping, from the input's
  writing mode. The vertical input was a rotated horizontal input.
  * Fix: `writing-mode: vertical-lr; direction: rtl` (bottom = min) replaces
    the rotation. The input box also now matches the 200px track (16 × 200,
    not 16 × 129).
  * Tests: AX orientation for single, range, full-height and a horizontal
    control; arrows in LTR and RTL; a horizontal RTL guard.
* **S8. Controlled mode left the thumb painted at the rejected value**
  (`md-slider.tsx`). `handleChange` committed (cleared the live value)
  without repainting.
  * Before: after a rejected key step the thumb sat at 51% while the value
    was 50. After a capped drag (cap 60) it stayed at 91%.
  * Fix: `syncCssVars()` after `commit()`.
  * Tests: single and range, keyboard and drag.
* **S9. A disabled slider emitted `mdDragStart` / `mdDragEnd` on press**
  (`md-slider.tsx`). The stylesheet re-enables `pointer-events` on the input
  under the disabled host, and browsers dispatch pointer events to disabled
  controls.
  * Fix: the input pointer handlers return when `disabled`.
  * Tests: single (failed before), range and vertical (guards).
* **S10. The value bubble did not taper with density** (`md-slider.css`). The
  12px block padding kept it 40 tall at −2…−4, overflowing the head room
  reserved for it by 4–12px. Its own comment promises 48 × 44 → 32 × 28.
  * Fix: the default paddings taper by 2px a step (floors 4 and 8). The
    hooks still override.
  * Test: heights 44/40/36/32/28, inside the host.

## Observed, not changed (decisions needed)

* **S5. Disabled is dimmed twice.** The host opacity 0.38 sits over explicit
  on-surface 38% / 12% colours, so M3's disabled colours are never reached
  (the active track lands at about 14%). It also needs a call on how ticks,
  the bubble and the inset icon look when disabled.
* **S6. Off-step values are not snapped.** `value="33" step="10"` keeps 33 in
  `aria-valuenow`, the bubble, the thumb and the form, while the native input
  sanitises to 30. The next arrow step starts from 30.
* **S11. The inset icon does not travel, and its colour is wrong at low
  values.**
  * The readme says the icon "travels with the handle". In fact it is fixed
    8px from the start.
  * It switches to the on-active colour whenever `value > min`. At small
    values (the oracle's `drag-inset-lg-ltr`, value 5) it is drawn white over
    the handle and the light inactive track.
  * M3 moves the icon to the inactive side when the active track is too
    short. This needs a design decision and a measured threshold.
* **S12. `mdChange` / `mdDragEnd` order depends on the input path.**
  * Native-input pointer: DragEnd → Change.
  * Rail: Change → DragEnd.
  * Keyboard: Change → DragEnd.
  * The readme says `mdChange` fires "on commit (drag end, key release)". In
    fact it fires on every key press.
* **Reflected boolean attributes set to `"false"`.** `value-indicator="false"`
  or `full-height="false"` set the prop to false but leave the attribute, so
  the `:host([value-indicator])` reserve and the `[full-height]` layout still
  apply. md-rating's `outline-empty` had the same root and is fixed (R5). This
  is a library-wide pattern.
* **Smaller items:**
  * `--_state-layer-size` is undefined (harmless: the block size falls back to
    auto).
  * The `state-layer` part is always hidden, so there is no hover state layer.
  * The tick count is unbounded for a tiny step (`step="0.001"` renders
    100,001 ticks).
  * Range `valueStart > valueEnd` is not normalised at load.
  * The default labels are the literal English "slider", "range start" and
    "range end".

## CEM / source drift

* The readme describes the inset icon as travelling with the handle (S11) and
  `mdChange` as firing on key release (S12).
* `labeled` is deprecated but still reflected and styled.

## Evidence

* **Source tests** (Linux Chromium 141, Stencil 4.44.0 with the repo patch):
  the family plus dependents, before and after, with every before/after log
  per fix. See `outputs/native-parity/md-slider/source-tests/`; `fixes.diff`
  holds all changes.
* **Oracle:** `outputs/native-parity/md-slider/web-oracle-cloud/` (see its
  README):
  * `paint.json`: 188 cases;
  * `states.json`: 22 runs, 227 phases, 3,281 per-frame samples;
  * `states-reduced.json`: the same runs, with 0 animation records.
