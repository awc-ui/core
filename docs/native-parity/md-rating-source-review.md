# Rating source review (md-rating)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried,
two source defects are fixed test-first and mirrored into `packages/core/src`,
and a browser reference (paint, per-frame hover/press/keyboard and
reduced-motion oracles) is captured. The oracle is **provisional**: it was
captured in headless Chromium 141 on Linux while the Mac runner was blocked,
and must be recaptured on the Mac (Chrome 153) and diffed before it gates
native work. No native code has changed. This is not a native completion
record.

md-rating is a library component, not an M3 component (the readme says
"m3-guidelines: none"). It is derived from the M3 slider and icon buttons,
with MUI Rating as its reference.

## Public contract

**Props.**

* Value: `value` (0, mutable, reflected, clamped into [0, `max`]);
  `default-value` (0: the value a re-click resets to, and the reset baseline);
  `max` (5); `precision` (`1` | `0.5`).
* Look: `size` (`md` default; xs/sm/md/lg/xl); `icon` (`star`); `empty-icon`
  (`star`); `outline-empty` (true); `show-value-label`; `density` (0 … −4).
* State: `readonly`, `disabled`, `soft-disabled`.
* Interaction: `hover` (`preview` | `off`).
* Naming: `getLabel(v)`, `rating-label` ("Rating"), `name`.

**Anatomy.** A `.md-rating__items` container (part `items`) holds the
keyboard and the ARIA. Each item (parts `item` plus `item-full`, `item-half`
or `item-empty`, `aria-hidden`) stacks four copies of the glyph:

* `icon-empty`: the empty glyph;
* `icon-filled`: the filled glyph, clipped to the filled fraction from the
  inline-start side;
* `state-layer`: a filled glyph used as the hover/press tint;
* `ripple`: a filled glyph revealed by a WAAPI clip circle.

There are no slots (the component's JSDoc header still says "slotted
SVG/HTML"; see the drift section).

**Events.**

| Event | Detail | When |
|---|---|---|
| `mdHover` | `number \| null` | The preview value changes under the pointer; `null` on pointer leave or blur |
| `mdChange` | `number` | A user change that alters the value (click, re-click reset, key). Programmatic writes do not emit. |

There is also a method, `focusRating()`.

**Pointer** (oracle `hover-*`, `click-*`):

* **Preview.** At precision 1 the preview is the item index + 1. At 0.5 the
  inline-start half of an item gives `.5` (the left half in LTR, the right
  half in RTL).
* **Event order.** A move emits `mdHover` before the click sets the value
  (`Hover 2.5 → Change 2.5`).
* **Re-click.** Clicking the current value resets to `default-value`
  (`Change 2`, or 0 without a default).

**Keyboard** (on the container):

* Right/Left ±precision, mirrored in RTL; Up/Down ±precision.
* Home → 0; End → `max`; digits 0–9 set that value when ≤ `max` (9 is
  ignored at max 5).
* Every other key bubbles (Escape reaches a dialog).
* Values are clamped, and `mdChange` fires only on a change.

**Accessibility.**

* **Interactive.** `role="slider"`, `aria-valuemin=0`, `aria-valuemax=max`,
  `aria-valuenow`, `aria-valuetext` (`getLabel(v)`, else "Empty", "1 Star",
  "N Stars"), `aria-orientation="horizontal"`, `aria-readonly="false"`.
* **Name.** Resolved in order: `aria-labelledby` text → host `aria-label` →
  associated `<label>` (via ElementInternals) → `rating-label`. Verified in
  the oracle: "Hotel quality", "Food" and "Service".
* **Readonly.** `role="img"` (exposed as `image`) named "Rating: 3 Stars".
  It is not focusable.
* **Disabled.** `tabindex=-1`, `aria-disabled`.
* **Soft-disabled.** Focusable (`tabindex=0`), `aria-disabled`, and no
  interaction.

**Form** (`formAssociated`):

* Submits `String(value)` under `name`; a value of 0 submits nothing.
* `formResetCallback` restores the initial value.

**Motion** (oracle `anims`):

* Hover pop: `scale(1.12)` (`--md-rating-pop-scale`), 150ms
  `cubic-bezier(0.2, 0, 0, 1)`.
* State-layer glyph opacity: 0.08 on hover, 0.12 while pressed, 150ms `ease`.
* Press ripple: a WAAPI clip `circle(0% → 85%)` from the pointer, opacity
  0.22 → 0, 420ms `cubic-bezier(0.2, 0, 0, 1)`.
* With `prefers-reduced-motion: reduce`, the pop and the fades are removed;
  **the ripple still runs** (R3).

**Density.** The item size drops 2 per step; the gap stays 4.

**RTL.** Items run from the inline start, the partial fill grows from the
inline start, and the keyboard and pointer half mapping mirror (fixed R1).

## Layout reference (DPR 1, light theme)

* **Items:** xs 16, sm 20, md 28, lg 36, xl 48 (each max(12, size + 2·d)).
* **Gap:** 4 (`--md-rating-item-gap`). The row width is `max·size + (max−1)·4`
  (md: 156).
* **Density** (md): 28/26/24/22/20 at 0 to −4.
* **Value label:** 12 after the row, Roboto 14/16, weight 500, on-surface.
  Hidden sizers reserve the widest label, so hover never reflows the row.
* **Focus ring:** a 3px solid secondary outline on the item row, offset 2,
  fully rounded.

## Paint reference

| Element | Light | Dark |
|---|---|---|
| Filled glyph (FILL 1, wght 500) | secondary `rgb(98,91,113)` | `rgb(204,194,220)` |
| Empty glyph | on-surface-variant at 30% (`rgba(73,69,79,.3)`) | `rgba(202,196,208,.3)` |
| Empty glyph shape | `outline-empty` (default): the `icon` glyph at FILL 0, wght 500. With `outline-empty` off: `empty-icon` at FILL 1, wght 400 | — |
| Partial fill | `clip-path: inset(0 X% 0 0)` LTR, `inset(0 0 0 X%)` RTL, X = (1 − fraction)·100 | — |
| Disabled, soft-disabled | Host opacity 0.38 | — |
| Readonly | Full opacity; no state layer, ripple or pop | — |

All `--md-rating-*` colour, size, gap, label and focus hooks are captured,
together and one at a time.

## Source defects fixed (test-first)

Each new test failed on the unchanged source and passes after the fix (7 new
tests: 5 failed before their fix, 2 are guards).

* **R1. RTL was reversed twice, so items were not mirrored**
  (`md-rating.css`, `md-rating.tsx`).
  * Cause: the item row is a plain flex row, which already follows the
    direction, and an extra `row-reverse` under `[dir=rtl]` un-mirrored it.
  * Effect: the half fill showed the far (left) half and disagreed with the
    RTL keyboard and pointer mapping.
  * Fix: drop the `row-reverse`. The fill clip moves to CSS through a
    `--_fill-clip` variable and mirrors under `:host(:dir(rtl))`.
  * Tests: `md-rating.rtl.e2e.ts` (5): inherited `dir` and host `dir`
    mirroring, ArrowLeft filling toward the left, an inline-start pointer
    half painting the right half, and an LTR guard.
* **R5. `outline-empty="false"` was ignored** (`md-rating.css`,
  `md-rating.tsx`).
  * The prop defaults to true, so the readme's `outline-empty="false"` is the
    only way markup can turn it off.
  * Stencil parses the string to `false` but keeps the attribute, so
    `:host([outline-empty])` still drew outlined empties.
  * Fix: the rule keys on a host class, `md-rating--outline-empty`.
  * Tests: `md-rating.contract.e2e.ts` (2): authored `"false"` matches the
    property, and switching back on outlines again (guard).

## Observed, not changed (decisions needed)

* **R3. The press ripple ignores reduced motion.**
  * The 420ms WAAPI ripple runs under `prefers-reduced-motion`, while the
    pop and the fades are removed.
  * This matches md-ripple's documented policy ("no reduced-motion branch of
    its own") but contradicts main-llm.md ("Components honour
    `prefers-reduced-motion: reduce` internally").
  * It is a library-wide call.
* **R4. The precision grid is not applied to programmatic values.**
  `value="2.3"` paints 30% of the third star and announces "2.3 Stars".
* **R2 (clarified, not a defect).** A disabled rating cannot be focused by
  click (the host has `pointer-events: none`) or by Tab (`tabindex=-1`).
  Soft-disabled stays focusable.
* **Touch was not captured.** With a mouse, every click is preceded by
  `mdHover`. Whether a touch tap emits `mdHover` (and then
  `mdHover(null)`) is unverified, and it matters for the native mapping,
  which has no hover on phones.
* **English defaults.** "Rating", "Empty", "1 Star" and "N Stars" are
  hard-coded unless `getLabel` or `rating-label` is set.

## CEM / source drift

* The JSDoc header in `md-rating.tsx` (and so the generated readme section)
  says "custom icons (Material Symbols glyphs OR slotted SVG/HTML)". The
  component renders no `<slot>`, and the hand-written readme says so.
* The iOS adapter honours a `required` property (with "This field is
  required."), but md-rating has no `required` prop.

## Evidence

* **Source tests:** `outputs/native-parity/md-rating/source-tests/` (shared
  logs with md-slider, plus `fixes.diff`).
* **Oracle:** `outputs/native-parity/md-rating/web-oracle-cloud/` (see its
  README):
  * `paint.json`: 113 cases;
  * `states.json`: 16 runs, 121 phases, 2,029 per-frame samples;
  * `states-reduced.json`: the same runs, where only the ripple animates.
