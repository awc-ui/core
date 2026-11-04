# FAB Menu source review

Status: source analysis only. Native implementation, tests and acceptance are pending.

## Public contract and dependencies

`md-fab-menu`: seven properties (`open`, `anchor`, `variant`, `placement`, `quick`, `menuLabel`, `density`), two void events (`mdOpen`, `mdClose`), three asynchronous methods (`show`, `close`, `whenClosed`), one structural default slot, three public appearance hooks (item container color, item label color, item gap), no declared CSS parts.

Required child `md-fab-menu-item`: six properties (`icon`, `label`, `disabled`, `softDisabled`, `rovingFocusVisible`, `density`), one void `mdClick`, two slots (icon and fallback label), three parts (state-layer, icon, label), five appearance hooks (container/label/icon colors, icon size and corner shape), no methods. Its icon and label fallback behavior must remain native composition.

The anchor normally is a separate `md-fab` addressed by ID. It can also be another button/control. Native support therefore needs a scoped anchor registry or explicit equivalent that provides actual bounds, focus and presentation control. Rendering the menu as an unrelated generic dropdown is insufficient.

## Lifecycle and method semantics

- Initial `open=true` installs positioning, anchor ARIA/morph, global listeners and roving state but does **not** emit `mdOpen` or autofocus.
- Later opening emits `mdOpen`, then checks for synchronous close/disconnect before continuing. Closing updates anchor state, removes global handlers, emits `mdClose`, resets roving state and returns focus to the anchor.
- `show()` cancels stale opening tasks and a pending close timer. Calling it while already open can reposition and schedule focus again.
- `close()` is idempotent while closed/closing. With `quick`, it sets `open=false` immediately. Otherwise it enters a closing state and commits `open=false` after 180 ms.
- `whenClosed()` uses the reviewed shared `OverlayLifecycle` and resolves only after the applicable opening cycle has fully closed, including finite shell motion. It excludes slotted child animations and infinite spinners. With no active cycle it resolves immediately. Reopening before completion keeps the same cycle pending until the subsequent close; disconnect resolves pending open/close waits.
- `show()` waits for the initial closed render and two paints, then commits the open action; it does not wait for entry animation to finish. Newer show/cancel/disconnect requests invalidate older opening work. `close()` itself does not await the delayed close; `whenClosed()` is the completion API.
- Native command execution must not block the input stream while `whenClosed()` is pending, since a later command or activation may be what closes the menu. Immediate transport acceptance is not promise completion.
- Cancel pending opening frames, timers, icon morph and typeahead work on teardown; detach all anchor/global listeners and restore temporary anchor state.

## Placement, appearance and motion

Items align to the anchor's inline-end edge (right in LTR, left in RTL), separated vertically from the anchor by 8. `up` reverses visual item order; `down` preserves it. `auto` chooses up only when space above is greater than space below, otherwise down. Track the anchor during an open cycle, including movement caused by layout changes that do not resize the window.

The item stack gap defaults to the spacing token (4). Variant primary/secondary/tertiary sets the corresponding container/on-container item colors. Menu shell motion uses opacity and vertical scale from 0.8, 150 ms emphasized deceleration on entry and acceleration on exit; origin follows placement. The close timer is 180 ms. CSS reduces shell motion under reduced-motion preference.

The anchor gains expanded/menu/control accessibility state. It temporarily becomes circular and uses the variant's vibrant color pair. The icon fades out for 120 ms, changes through the FAB's `setMenuIcon("close")` method and fades in. Closing clears the temporary icon and shape. Authored icon and slot content must survive.

Source caveats to verify rather than infer from comments: `quick` skips the close delay but does not currently remove all CSS entry transitions; per-item index is assigned but the declared stagger constant is unused. Anchor color cleanup removes inline overrides rather than retaining a prior authored inline value. These require explicit source/native decisions and regression evidence.

## Input, focus and events

- Anchor click is captured to avoid double toggles from Enter/Space synthesized clicks. Track actual input modality and whether the anchor was focused before pointer activation.
- Keyboard opening or clicking an already-focused anchor focuses the first item. Fresh pointer opening initializes one tab stop without moving focus into the popup.
- Up/Down move in visual direction and return to the anchor at the near edge; Home/End select first/last authored item. Anchor Up/Down enter only in the corresponding placement direction.
- Tab/Shift-Tab traverse authored item order; Shift-Tab at the first item returns to the anchor; Tab past the final item starts closing. Escape closes and restores anchor focus.
- Typeahead accumulates characters for 300 ms, searches after the current item with wrapping, uses the current label property and falls back to slot text.
- Outside activation closes; an item's bubbling `mdClick` closes and returns focus. Menu event cancellation does not automatically reverse state transitions.
- A disabled menu item suppresses pointer action; a soft-disabled item remains focusable but suppresses activation and does not close the menu. Enter/Space on an enabled item emits the same void event.
- Source keyboard traversal currently calls `getItems()`, not the unused `getEnabledItems()`. Do not claim disabled-item skipping without testing actual source behavior or fixing it consistently in the source library.

## Menu-item geometry

Height is at least `max(32, 48 + density*4)`. Icon size is `max(16, 20 + density)`. Label font size is `max(12, 14 + density*0.5)` with line height `max(16, 20 + density)`, medium weight and 0.1 letter spacing. Horizontal padding is the extra-large inset token (24), with an icon reducing the leading inset to the large token (16); gap uses the small token (8). These tokens can themselves respond to density. Shape defaults to a pill, with no elevation.

Explicit empty icon elements suppress the fallback and retain the slot box. A nonempty label overrides the default slot. State-layer, focus-ring and disabled colors follow source CSS, including custom icon-color precedence and soft-disabled suppression of the state layer.

## Laboratory requirements

Preserve the authored anchor plus menu plus item recipe on each platform. All seven menu properties and three appearance controls must update the real native component. Item composition and its own editable properties/slots must be represented in native API examples. The Methods panel must invoke the three public native lifecycle methods and show actual completion/error state. Events, selected platform examples and measurements must refer to the same live session and actual anchor/item geometry.

## Web baseline captured

The menu, item and shared overlay lifecycle source suites passed 155 tests. A real-browser fixture captured 22 configurations covering all variants/densities, up/down/auto, RTL, custom appearance and authored/disabled items. Evidence lives under workspace `outputs/native-parity/md-fab-menu`.

Item leading/trailing padding for density 0…−4 measures 16/24, 16/24, 12/20, 12/16 and 8/16. Stack gap is four until density −4, where it becomes two. Three-item stack heights are 152/140/128/116/100, with item heights 48/44/40/36/32.

An extended anchor labelled “Create” remains 113.773 × 56 while open. The menu sets a 50% radius and close glyph but does not remove the label or force the anchor to a square. This is an ellipse for an extended anchor, despite source prose calling it a circle.

In the recorded non-quick lifecycle, `close()` resolved while `open` was still true and `whenClosed()` remained pending. `mdClose` occurred approximately 181 ms later; `whenClosed()` resolved on the subsequent rendered close settlement. The timings are observations, not fixed scheduling guarantees.

The shared bridge now separates accepted method calls from completed results, allowing later close input while `whenClosed` is pending and permitting completion polling while visual streaming is paused. Native implementation and complete integration verification remain pending; protocol tests alone do not establish component support.
