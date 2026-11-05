# List source review

Status: gate 1. The Web source contract and the Chrome reference are verified for
`md-list` and `md-list-item`. Six source defects were reproduced with failing
tests, fixed and regression-tested. Dedicated native implementation, Laboratory
integration and acceptance are still pending. This is not a native completion record.

## Public contract

**md-list.** Eight properties:
- `listStyle` (standard/segmented)
- `selectionMode` (none/single-select/multi-select)
- `interactionMode` (single-action/multi-action)
- `reorderable`, `label`, `labelledby`, `roleOverride`
- `density` (0 through −4)

Four methods: `activateNext`, `activatePrevious`, `selectItem(index)` (silent; no
`mdSelect`) and `getSelectedIndices`.

Three events:
- `mdSelect {index, value, selected, item[, childIndex, expanded]}`
- `mdActivate {index, item}`
- `mdReorder {from, to, order}`, where `order[new] = original`

It has one default slot, the `drop-placeholder` part and 10 hooks.

**md-list-item.** The 22 author-facing properties are:
- `type` (text/button/link)
- headline, overline, supportingText, trailingSupportingText
- leadingIcon, trailingIcon
- leadingAvatar, leadingAvatarAlt, leadingAvatarName, leadingAvatarLabel
- leadingImage, leadingImageAlt
- lines (1–3), href, target
- disabled, softDisabled, selected, expandable, expanded, density

Six more properties are public only because the list writes them: tabbable,
rovingFocusVisible, selectionMode, interactionMode, containerRole and reorderable.

Methods: `setFocus(options)`, `focusItem`, `toggle`, `expand`, `collapse`.

Events:
- Author-facing: `mdClick {item}` and `mdExpand {expanded, index, value, item}`.
- List plumbing that bubbles out, composed: mdItemClick, mdItemSelect,
  mdRequestActivation, mdItemRequestReorder.

Eight slots: default, leading, overline, headline, supporting-text, trailing,
trailing-supporting-text, expanded-content.

29 parts (CEM), including `primary`, `row`, `state-layer`, the expanded panel,
the image-selection indicator, and forwarded avatar/expand-button parts.

68 unique item hooks.

**Roles**
- **Container**
  - `list` for selection none.
  - `listbox` for single/multi-select, plus `aria-multiselectable` for multi.
  - A selection list with expandable rows degrades to `list`.
  - `roleOverride` wins.
  - Interleaved `md-divider`s are `aria-hidden` unless the role permits separators.
- **Rows**
  - In `none` mode every row is a `listitem`. Button and link rows put their widget role on the inner `primary` element.
  - In selection modes rows are `option` with `aria-selected`.
  - Selection modes make text rows focusable.

## Layout reference

**Spacing and size**
- The list pads 8px on the block axis (standard) and 0 (segmented).
- Segmented rows sit 2px apart.
- Row padding is 8/16 with a 12px gap.
- Minimum heights are 56/72/88 for one, two and three lines.
- Three-line rows use 12px block padding and align to the top.

**Corners**
- Standard rows are square except the first (top 16) and last (bottom 16), forming one connected shape.
- Segmented rows are 16 at the ends and 4 in the middle.
- Selected and focus/press states morph to 16 (the corner-large token). Middle rows morph from 0 or 4.

**Color**
- Surface: rgb(255,251,254) light, rgb(28,27,31) dark.
- Selected rows use secondary-container with on-secondary-container text, and get the selected-shape morph even in `none` mode.
- Disabled content is on-surface at 38%. No state layer is rendered when disabled.

**Typography**
- Headline: body-large, 16/24, .5 tracking.
- Supporting text: body-medium, 14/20, .25.
- Overline and trailing supporting text: label-small, 11/16, weight 500.

**Leading and trailing elements**
- In-list (expressive) icons are 20px; standalone rows use 24px. The expressive rules use `:host-context`, which is Chromium-only.
- Avatars are 40px, images 56px, video 100×56.
- The expand button is 32px; the drag handle is 24px.

**Density**
- Single-line rows lose 4px per step (56→40); multi-line rows lose 6px per step (72→48, 88→64).
- Block padding tightens 1.5px per step (8→2), or 2.5px per step for three-line rows (12→2).
- Headline drops .5px of size and 1px of line height per step (down to 14/20).
- Inline padding follows the spacing tokens (16/16/12/12/8).
- List padding goes 8→4 at −3.
- Image rows keep a 16px start inset at compact density.

**Density inheritance.** A local `density` shallower than an inherited `data-density` is a hybrid: local −1 inside global −4 measures 52px rows with 6.5px block padding but 8px inline padding and 4px list padding. This is because the `[density="-1"]` token rung sets only the scale and row height and inherits the −4 spacing insets. It contradicts the prop documentation ("a local value simply overrides the inherited one"). The cause is in the shared tokens, which are cross-component and outside md-list's source, so it is recorded here rather than changed.

**Hooks.** Every item hook and list hook has a measured effect, alone and all together, across:
- the 68 + 10 single-hook cases (paint)
- the custom state run (hover/press/focus/drag)
- the extra run (expand/collapse durations and collapsed caret color)

`--md-list-item-hover-container-shape` additionally needs an authored `:hover` rule (documented). Two hooks are masked under a physical drag (see below).

## Interaction and state

**Roving focus (the list owns one tab stop)**
- Tab enters at the active row. ArrowUp/Down wrap; Home/End jump to the ends.
- Printable characters run typeahead over headline/text with a 500ms buffer: "b", then "l", reaches Blueberry.
- Hidden, disabled and text-in-`none` rows are skipped. Soft-disabled rows stay reachable and expose `aria-disabled`.
- `mdActivate` fires only when focus lands on a *different* row, including a pointer press that focuses a row.
- An `md-search` ancestor owns the arrow keys.

**Activation**
- Enter/Space give a centred ripple and a click; link rows click their inner anchor.
- Expandable rows toggle on a row click or the caret.
- ArrowRight expands and ArrowLeft collapses. This is *not* mirrored in RTL; measured in the extra run.

**Selection**
- Single-select re-clicking the selected row keeps it selected and re-emits `mdSelect` with `selected: true`.
- Multi-select toggles.
- `selectItem` is silent.

**Reorder**
- Pressing the handle lifts the row:
  - z-index 1
  - translateY follows the pointer
  - the dragged elevation (`0 6px 10px 4px` / `0 2px 3px` shadow by default)
  - a dashed primary-container placeholder tracks the drop slot, and siblings shift 200ms
- Release reorders the light DOM and emits `mdReorder`. Returning to the origin emits nothing.
- Alt+ArrowUp/Down moves the focused row and is ignored at the edges.
- Disabled rows cannot be picked up.

**Multi-action rows.** Authored trailing controls keep their own clicks and keys.

**Disabled states**
- Hard-disabled rows ignore the pointer and drop out of the tab order.
- Soft-disabled rows are focusable, show no layer or ripple, and cancel their click. They do, however, get the 16px press morph from `:active` (`disabled` run, `r2-press`). This is an open source decision; native should follow whichever behavior the source settles on.

**State layer and focus ring**

| State | Layer opacity |
| --- | --- |
| hover | .08 |
| focus | .10 |
| pressed | .10 |

The focus ring is an inset 3px secondary box-shadow plus the 16px focus morph.

**Dragged state under a physical drag**
- While the pointer is held, `:active`/pressed rules outrank `.md-list-item--dragged`.
- So a real drag paints the pressed layer (.10) and pressed shape. The dragged hooks (`dragged-container-shape`, `dragged-state-layer-opacity`) never show, while `dragged-container-elevation` does. This is the same pattern as md-card.

## Motion

**Shape morph timing (measured)**
- Entering an active state (focus, press, select) takes 200ms with the standard curve.
- Returning to rest takes 400ms with emphasized-decelerate, cubic-bezier(.05,.7,.1,1).
- The source comment claims the opposite ("CSS uses the pre-change transition"). CSS actually applies the after-change transition, so the comment is wrong about which way round the timings run. This is recorded as intent drift, not changed.
- Quick clicks reverse an in-flight morph with Chrome's shortening rule (about 40ms reversals in the expand runs). Native must reproduce CSS transition reversal.

**Other transitions**
- State-layer opacity and host box-shadow: 100ms standard.
- Panel open: 350ms emphasized-decelerate on grid rows, opacity, and the inner translateY −8→0.
- Panel close: 200ms emphasized-accelerate, cubic-bezier(.3,0,.8,.15). The `expand-duration`/`collapse-duration` hooks measured 600/90.
- Caret: 180° turn in 300ms standard. It turns into a filled selected button while expanded.
- Drag handle (opacity, color, transform): 150ms.
- Sibling shift and placeholder: 200ms.
- Image-selection indicator: 150ms. Its circle runs 300ms keyframes.
- Leading icon: a declared 150ms `font-variation-settings` transition. It runs `normal`→`normal` in every capture, so nothing visibly changes; selection does not fill the icon.
- Ripple: 450ms grow and 150ms fade.

**Reduced motion**
- Removed: the morph, panel, caret, drag-handle, shift and image-selection motion.
- Kept: state-layer opacity, host box-shadow (by design), the no-op icon variation record, and md-ripple, which ignores the preference as it does for card and accordion.

## Source fixes (gate 1)

Each fix has a test that failed first. All logs are under `outputs/native-parity/md-list/source-tests/`, and the before copies and diffs are under `source-changes/`.

| # | Defect | Test file | Before log | After log |
| --- | --- | --- | --- | --- |
| 1 | Authored controls lost their keys. Enter/Space on a trailing icon button activated the row. Typing in an expanded-content field toggled the row, ran typeahead and moved focus. Slider arrows moved roving focus. Keys on child rows collapsed or reordered the parent. | `md-list.authored-keys.e2e.ts` | `authored-keys-before*.log` | `-after.log` |
| 2 | Leading-avatar color hooks had no effect. md-avatar's name palette overrode them. The internal avatar now uses `colorFromName={false}`. **Default change:** initials avatars render primary-container/on-primary-container, matching the CSS intent and M3. | `md-list-item.avatar-hooks.e2e.ts` | `avatar-hooks-before.log` | — |
| 3 | Reduced motion was ignored by the active-state morph, the open panel, the drag handle and the sibling shift, because of specificity. | `md-list-item.reduced-motion.e2e.ts` | `reduced-motion-before*.log` | — |
| 4 | Button and link rows had no keyboard focus indicator (WCAG 2.4.7). The `:host(:has(...:focus-visible))` selectors were dead. A mirrored `--primary-focus-visible` class fixes it. | `md-list-item.focus-visible.e2e.ts` | `focus-visible-before.log` | — |
| 5 | `mdActivate` re-fired for the same row on Home/End and when wrapping a one-row list. | `md-list.activate.e2e.ts` | `activate-before.log` | `-after.log` |
| 6 | Hidden rows stayed in roving navigation: with a hidden first row, Tab went to the body. Show/hide is now observed. | `md-list.hidden-rows.e2e.ts` | `hidden-rows-before.log` | `-after.log` |

Fixes 2–4 share `fixes-after-2.log`, which passed 11/11.

**Verification**
- The baseline passed 8 suites and 195 tests.
- The final dependent run passed 108 suites and 1,836 tests (`final-dependent.log`, job 167). It covered list, list-item, search, tooltip, tabs and tables, accordion, card, icon-button, slider, avatar, ripple, menus and transfer-list.
- The work was built and tested in the private copy `work/list-tree`. Only the verified files were mirrored into `packages/core/src`; the hashes are identical and are recorded in `oracle-manifest.json`.
- The shared `packages/core/dist` was deliberately not rebuilt, so it is behind `src` for md-list.

## Drift and open findings

**Stale metadata**
- **Compiler IR.** `md-list.json` records `4061c53f…` and `md-list-item.json` records `ecfb218a…`. Neither matches the pre-fix sources (`6d8f29…`, `20677d…`) or the current ones (`8447bb29…`, `6010a69c…`), so the IR must be regenerated.
- **iOS `NativeSupport.json` and Android `support.json`** predate these fixes. They list properties as supported by adapters that render them only approximately (Material/SF defaults, no density, no soft-disabled semantics). Both must be regenerated from the contract after the dedicated renderers land.

**CEM and CSS header**
- The CEM lists `--md-list-item-active-container-shape` twice (69 entries, 68 unique).
- The CSS header comment omits `--md-list-item-expand-button-size`, `--md-list-item-expand-chevron-size` and the `primary` part. All three are in the CEM.
- The bottom-space comment says "M3: 10px", but the resolved default is 8px.

**Dead CSS and browser support**
- `[data-rtl-mirror]` rules are dead: nothing sets that attribute.
- The expressive in-list sizing uses `:host-context(md-list)`, which only Chromium supports.

**Contract and documentation questions**
- **Internal API is public.** The six list-managed item properties and four plumbing events are public API by accident. Native should model them as internal, not as editable properties.
- **Typeahead** reads `textContent`, so slotted headline markup takes part in matching.
- **Morph timing** contradicts its source comment (see Motion).
- **RTL disclosure keys** are not mirrored.
- **Soft-disabled rows** still press-morph.
- **Local density** shallower than an inherited density is a hybrid (see Layout).

These are source decisions for the owner. None was changed at gate 1, because each one either has no failing contract statement or lives outside md-list (tokens).

**Standalone rows.** An `md-list-item` outside a list still exposes `listitem` without a list owner. It uses 24px icons and no roving focus.

## Evidence and open gates

The final Chrome 153 reference uses trusted CDP input at 1200×900 and DPR 1, served from the private build with real Roboto and Material Symbols fonts. The first captures (jobs 155/156) were discarded because the font route returned 404.

| Capture | Job | Cases and samples | PNGs |
| --- | --- | --- | --- |
| `web-paint.json` | 168 | 264 cases | 264 |
| `web-states.json` | 168 | 27 runs, 174 phases, 5,158 frame samples, 1,048 transition/animation records, 162 events | 172 |
| `web-states-reduced.json` | 168 | 6 runs, 37 phases, 1,120 samples, 81 records | 37 |
| `web-states-extra.json` | 169 | 3 runs, 22 phases, 732 samples, 146 records | 22 |

`oracle-manifest.json` holds the page, dist and source hashes and the exact commands.

Still pending:
- dedicated SwiftUI and Compose renderers
- right-panel edits, builder slots, metadata, inspector and examples
- native accessibility (list/listbox/option, roving focus, typeahead)
- reorder on physical touch
- iOS runtime and the final audit

Not covered by this reference:
- forced-colors (source-reviewed only)
- touch and pen input
- non-Chromium browsers
