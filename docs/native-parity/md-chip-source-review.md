# Chip source review

Status: the Web contract is inventoried, eight source defects are fixed
test-first and mirrored into `packages/core/src`, and the browser reference
(paint, interaction and reduced-motion oracles) is captured on macOS (Chrome
153, `web-oracle/`). An earlier provisional Linux capture (`web-oracle-cloud/`)
matches it apart from values that do not affect rendering: `outline-width`
serialised under `outline-style: none`, and the frame timing of ripple and
transition samples (`web-oracle/cloud-vs-mac.txt`). Native results are in
[md-chip.md](md-chip.md).

## Public contract

Fourteen properties: variant (assist/filter/input/suggestion, default
assist), icon, trailingIcon, label, selected (mutable, reflected),
selectable and removable (tri-state: unset means the variant default),
appearance (outlined/filled/elevated, default outlined), color (a role name
only), elevated (deprecated; wins over appearance), disabled, softDisabled,
contentAlign (start/center/end) and density (0 through −4, reflected). There
are no public methods.

Three events, all bubbling, composed and cancelable. `mdSelect {selected}`
fires before `mdClick` (no detail). `mdRemove` (no detail) removes the
element as its default action, and calling `preventDefault()` keeps it.

Slots: the default slot (label text), `leading-icon` (an avatar or icon) and
`trailing-icon`. On a removable chip, `trailing-icon` content replaces the ✕
glyph inside the remove button. Parts: state-layer, outline (not rendered for
the deprecated `elevated` boolean), primary, checkmark, icon, label, remove
and trailing-icon. The CSS header's parts list leaves out `primary`, which is
a documentation gap only.

Roles follow from two derived values. The host is interactive unless
`selectable === false` and the chip is removable (a display token). An
interactive, non-removable chip is itself `role=button`, with tabindex and
(when selectable) `aria-pressed`. A removable chip is a `role=group` labelled
by its label: the body action is an inner `primary` button (unless it is a
display token) and the remove button is labelled "Remove {label}". Every
chip carries `aria-roledescription="chip"`. A disabled chip gets
`aria-disabled=true` and tabindex −1 on its focus target. A soft-disabled
chip keeps tabindex 0.

On the body, Enter and Space ripple, then click. Delete and Backspace remove
a removable chip. On the remove button, Enter and Space each dispatch exactly
one `mdRemove` (the oracle saw no duplicate click). A click on a disabled or
soft-disabled chip is cancelled with `preventDefault` and emits nothing.

## Layout reference

The host is an inline flex row with overflow hidden and isolation. Height is
max(24, 32 + 4·density): 32, 28, 24, 24, 24. Typography is Roboto 500,
max(11, 14 + .5·density) over max(16, 20 + density), with 0.1px tracking.
Icon and checkmark size are max(14, 18 + density). The radius is
corner-small (8).

Inline padding is 16 at the label side and 8 (`inset-sm`) on a side that has
a leading or trailing item. md3.css density rules replace the spacing tokens
through the reflected `density` attribute:

| density | label side | item side | gap |
| --- | --- | --- | --- |
| 0, −1 | 16 | 8 | 8 |
| −2 | 12 | 8 | 8 |
| −3 | 12 | 4 | 4 |
| −4 | 8 | 4 | 4 |

An inherited `data-density` on an ancestor applies too. At density 0 the
reference chips measure 77.31 (filter "Unread"), 95.31 (selected, with the
checkmark), 150.06 (assist with icon), 135.08 (input with remove) and 77.19
(suggestion) by 32. With a definite width the label truncates with an
ellipsis (160px chip: label 128 wide against 411 of content). contentAlign
positions the content row physically inside wider chips.

## Paint reference

Outlined chips are transparent, with a 1px outline: `outline` for neutral
chips and `outline-variant` for input chips. Filled chips use the
surface-container-high container with no outline. Elevated chips use the same
container plus elevation 1. Selected chips (filter, input) use
secondary-container with on-secondary-container content and no outline.
Colour roles tint the label, icon, outline and state layer of an outlined
chip, and the container (`{role}-container` / `on-{role}-container`) of
filled, elevated and selected chips.

Disabled content is on-surface at 38%. A disabled outlined chip keeps a
12% on-surface outline. Disabled filled, elevated and selected chips use a
12% on-surface container with no elevation. Soft-disabled chips paint
exactly like disabled ones, but stay focusable and keep hover/press
inert: the state layer is `display:none`.

## Interaction reference

The state layer uses the current ink at .08 for hover and .12 for
focus-visible and press, with a 50ms transition (short1). Host background,
colour and shadow transition over 100ms (short2). Both use the standard
easing. The ripple is md-ripple: press-in 450ms, release fade 150ms, wave
opacity .12, centred for keyboard activation.

Focus rings: a button-role host shows a 3px secondary ring at offset 2.
The primary button's ring is 3px at offset −3, and the remove button's is
2px at offset 1. For group-role chips the host itself never matches
`:focus-visible`: the ring moves between primary and remove.

Under reduced motion, the host and state-layer transitions are removed, but
the ripple still plays (450/150).

## Source defects fixed (test-first)

Each of (a)–(g) failed `md-chip.cascade.e2e.ts` on the unchanged source with the
exact computed values below, and passes after `apply-fixes.py`. The test
uses distinct sentinel token colours.

* (a) A disabled filled chip drew a 12% outline that its enabled state
  never has. The outline rule now also excludes `appearance-filled`.
* (b) A non-role colour such as `#ff0000` tinted the chip primary, because
  the rules keyed on the `[color]` attribute. `colorVars` rejects such a
  value, and the readme says the chip renders neutral. The rules now key
  on a `md-chip--colored` class that is set only when `colorVars` accepts
  the value.
* (c) A selected chip ignored `--md-chip-state-layer-color` (it took
  on-secondary-container instead).
* (d) A selected colour-role chip ignored `--md-chip-container-color-selected`,
  `--md-chip-label-color-selected` and the state-layer hook (the role
  container and on-container applied). The CSS header says per-instance
  properties win over everything.
* (e) A selected filled or elevated chip lost the selected container and
  icon colour (surface-container-high and on-surface-variant came back). The
  neutral tonal rule has the same specificity and comes later.
* (f) Disabled colour-role chips kept the role icon colour, and the label too
  when selected, instead of the disabled content colour. The disabled
  colour and icon declarations are now `!important`, like the existing
  elevation override.
* (g) A disabled or soft-disabled filled chip kept its full tonal container,
  while an elevated one dimmed to 12%. The source says filled and elevated
  share one tonal container and differ only in elevation, so filled now
  follows the elevated rule.
* (h) Leading or trailing icons slotted before the first render were never
  detected. Their `slotchange` fired before the listeners in
  `componentDidLoad` existed, so an avatar chip kept the 16 px label-side
  padding, and a selected filter chip drew the checkmark next to its slotted
  icon. `componentWillLoad` now reads the initial assignment from the light
  DOM (`md-chip.slots.e2e.ts`: 1 of 2 failing before the fix, 2/2 after).

## Behaviour kept as-is (native renderers must match)

* Pressing ✕ ripples the whole chip and raises the chip's state layer
  to .12, because the host owns the only md-ripple.
* A soft-disabled removable chip's remove button carries `disabled`, so it is
  not focusable; Tab moves past it.
* A display-token chip (removable, `selectable=false`) is a group with no
  primary button, but a body click still ripples and emits `mdClick`.
* The CSS fallbacks are 100/200ms, but the tokens resolve to 50/100ms, and
  the tokens are what render.

## Evidence

* On the Mac (stencil 4.44.0, Chrome 153), after (a)–(h):
  * md-chip spec, e2e, cascade and slots: 106/106.
  * Chip consumers: 262/262 (`source-tests/mac/`).
* Source tests (Linux Chromium 141, stencil 4.44.0 plus the repo patch):
  * Baseline: 98/98.
  * Cascade before the fix: 6/6 fail. Five failed in the first run; (g)
    failed alone, test-first, later.
  * After the fix: 104/104 (spec, e2e and cascade).
  * Chip consumers (autocomplete, multi-select, tab, hidden-attribute,
    toolbar, card, table-row): 491/496 under eight-way load. The failures
    are load timeouts and "App did not load", and different tests fail on
    each run, before and after the fix. The failing files pass serially
    (16/16, 46/46, 45/45 twice and 47/47).
  * Logs and the diff are in `outputs/native-parity/md-chip/source-tests/`.
* Oracle: `outputs/native-parity/md-chip/web-oracle-cloud/`.
  * Paint: 452 cases with 451 clipped shots.
  * States: 45 runs with per-frame samples. Reduced motion: 5 runs.
  * A second capture matched with 0 mismatched leaves under
    `compare-oracles.mjs`.
  * Fix (g) changed exactly the 44 filled disabled and soft-disabled
    backgrounds.
