# List parity checkpoint

Status (2026-10-24): dedicated SwiftUI and Compose renderers for `md-list` and `md-list-item`
replace the generic adapters in production dispatch (`AWCNativeView` and `AWCComponent`).
Public appearance, part, method and inspection APIs exist on both platforms. The macOS and
Android runtime checks below run against the trusted-input Chrome oracles in
`outputs/native-parity/md-list/web-oracle/` (job 168). This is an implementation checkpoint,
not the final all-component audit or an iOS runtime claim (the UIKit branches are written and
share the macOS code paths, but were not run). The Laboratory integration (gate 3) is in place;
see [Laboratory](#laboratory-gate-3).

The open source decisions recorded in `md-list-source-review.md` are reproduced as Chrome
measured them, not "fixed" natively: morph timing direction (200 ms standard into an active
state, 400 ms emphasized-decelerate back), `:active`/pressed outranking the dragged class
under a physical drag, the soft-disabled press morph, and unmirrored ArrowRight/ArrowLeft
disclosure keys in RTL.

## Contract and implementation

**md-list.** All eight properties: `listStyle`, `selectionMode`, `interactionMode`,
`reorderable`, `label`, `labelledby`, `roleOverride`, `density` 0…−4.
- Roles: `list` / `listbox` (selection modes; an expandable selection list degrades to `list`),
  `roleOverride` wins; interleaved dividers are hidden from accessibility unless the role
  permits separators.
- Methods: `activateNext`, `activatePrevious` (roving focus with a visible ring, wrap,
  `mdActivate` only on a change), `selectItem(index)` (silent), `getSelectedIndices` —
  `AWCListController` (Swift `.awcListController(_:for:)`, Compose `AWCListControllerScope`).
- Events: `mdSelect {index, value, selected, item[, childIndex, expanded]}`,
  `mdActivate {index, item}`, `mdReorder {from, to, order}` where `order` maps the displayed
  rows to their authored positions (the source's `originalOrder`).
- The ten list hooks are `AWCListAppearance` (generated from `hooks.py` on both platforms);
  `::part(drop-placeholder)` is `awcListPlaceholderPartAppearance` /
  `AWCListPlaceholderPartAppearanceScope`.

**md-list-item.** The 22 author-facing properties, the four slot regions plus the text slots
(`overline`, `headline`, `supporting-text`, `trailing-supporting-text`, default text,
`leading`, `trailing`, `expanded-content`) and the five methods (`setFocus({focusVisible})`,
`focusItem`, `toggle`, `expand`, `collapse`; no `mdExpand` from methods, as in the source) —
`AWCListItemController`. `mdClick {item}` and `mdExpand {expanded, index, value, item}` keep the
source order (row click on an expandable row: mdExpand then mdClick; the caret: mdExpand only;
a panel row in a selection list: list `mdSelect` with the parent index and `childIndex`).
The list-managed properties (`tabbable`, `rovingFocusVisible`, `selectionMode`,
`interactionMode`, `containerRole`, `reorderable`) are internal state natively, as the source
review recommends; `rovingFocusVisible` is still honoured as a property for fixtures.

**Hooks and parts.** The 68 item hooks are `AWCListItemAppearance` (colours, the container
shape and the four logical corners, the six state shapes, five state-layer opacities, fonts,
icon/avatar/image/video sizes and shapes, spacing, the dragged elevation shadow list,
expand/collapse durations and panel padding/background). Without an id they are inherited by
every row (CSS inheritance: the list's per-position `::slotted` corner rules win over them);
with the row's id they are inline (they win). The 29 parts are `AWCListItemPart` with the shared
sparse part vocabulary (`AWCListPartAppearance` = the accordion part appearance); part rules win
over hooks and state rules. Every visual part takes the paint declarations: `backgroundColor` (in the part's box and corner
shape), `opacity` (replacing the part's own opacity on the state layers and the drag handle), `cornerShape` (clipping the
avatar and the image-wrap, as the source's overflow does) and `color` on the text and glyph parts; the headline also takes
`letterSpacing` and the row its border. Layout declarations (padding, margin, sizes, other borders, font metrics) are the
hooks' job and are not applied. Each of the 27 parts is compared with Chrome's `::part()` rule (`NativeListPartsIntegration`,
`NativeListPartsTest`, `d3-lab/web2/list-parts-web.json`; gate-7 r3-14). The two tooltip popup parts are md-tooltip's popup
part (`awcTooltipPartAppearance(_:part: .popup)`; `NativeListTooltipIntegration` checks that it reaches the row's popup).
The avatar follows md-avatar's modes: the image, else (none or a failed one) the initials, else the person icon.

**Cascade (md-list-item.css, rule by rule).** Per logical corner: inline hook > the list's
`::slotted` position rule (first/last 16, segmented 4, panel rows square except the last row of
the last expanded parent) > the row's `:host` rules (expanded rows square their end corners) >
inherited hook > the container shape. State shapes (roving > :active > focus-visible > dragged >
pressed > selected; `--md-sys-shape-morph-enabled` off freezes all but dragged) are
`max(rest, shape)`. Layer opacity priority: active > roving > hover > focus-visible >
disabled > dragged > pressed (.08/.10/.10/.16). Selected rows use secondary-container with
on-secondary-container; disabled content is on-surface 38% and wins over selected.

**Metrics.** Row padding/gap/min-height and typography follow density (−1…−4): rows lose 4 px
(one line) or 6 px (multi-line) per step, block padding 1.5/2/2.5 px per step, headline
16/24 → 14/20; inline padding follows the spacing-token rung (16/16/12/12/8), list padding 8 →
4 at −3, image rows keep a 16 px start inset. Text uses CSS line boxes (each line exactly the
line height, glyphs centred), supporting text clamps to two lines on three-line rows,
three-line rows align to the top and stretch the trailing column (the trailing icon centres in
the remaining space).

**Motion.** Corners 200 ms standard into an active state and 400 ms emphasized-decelerate back;
state layer 100 ms; panel 350 ms emphasized-decelerate open / 200 ms emphasized-accelerate close
(height, opacity, inner translateY −8 → 0; `expand-duration`/`collapse-duration` hooks); caret
180° in 300 ms (`--md-sys-motion-duration-medium2`); drag handle 150 ms; sibling shift and placeholder glide 200 ms; dragged
elevation 100 ms. CSS transition reversal uses the shortening rule (the shared CSS track).
Reduced motion keeps only the state layer, the elevation and the ripple (450 ms grow / 150 ms
fade, which ignores the preference as md-ripple does).

**Interaction.** One roving tab stop (the first selected focusable row, else the first);
ArrowUp/Down wrap, Home/End; typeahead over headline/default-slot text with a 500 ms buffer
(one character searches from the next row, more from the current one); hidden, disabled and
text-in-`none` rows are skipped, soft-disabled rows stay reachable. In a selection list an expandable row is a roving stop too
(md-list `isItemFocusable`), and its caret is a further tab stop. Focus entering a row or its caret from outside sends
`mdRequestActivation` (entering through the caret first makes the row the active row, `mdActivate`, as md-list does on
the fixed source, gate-7 r3-25); a move between them does not. The rows of a collapsed panel are not tab stops (r3-26). The caret takes the host's keys: ArrowRight/Left expand/collapse,
ArrowUp/Down/Home/End rove (from a row that is not a stop: the first/last stop; with no stop, focus stays), Enter/Space
activate the caret and then click the host (mdExpand, mdExpand, mdClick: the panel ends where it started), as Chrome does
(gate-7 r3-24: `NativeListRovingIntegration` / `NativeListRovingTest` replay `d3-lab/web2/roving-web.json`). Enter/Space give a centred
ripple and a click. Expandable rows toggle on a row click, the caret (its own tab stop), and
ArrowRight/ArrowLeft (not mirrored in RTL). Authored trailing controls keep their own pointer
and key handling; pressing them makes the row `:active` only. Pointer reorder from the drag
handle: lift (z-index 1, pressed layer and shape, dragged elevation), follow the pointer, target
by crossed resting centres, siblings shift one row-step, the dashed primary-container ghost
glides to the target, drop re-slots the row (no transitions on the moved row) and emits
`mdReorder`; returning to the origin emits nothing. Alt+ArrowUp/Down moves the focused row and
is ignored at the edges and on disabled rows.

**Leading content.** Icons (20 px in a list, 24 px standalone — `:host-context(md-list)`),
initials/photo avatars (40 px, primary-container), images (56 px, radius 8 in a list, 0
standalone) with the selection scrim/circle/check, video (100×56, radius 8; Compose
`AWCListLeadingVideo`), slotted elements at their authored size.

**Accessibility.** Roles follow md-list-item.tsx: a selection row is an `option` with
`aria-selected` (natively a radio button in a single-select listbox, a checkbox in a
multi-select one — the closest platform roles that carry the selected state; Compose exposes the
listbox with `selectableGroup()`), a button/link row inside a `menu`/`menubar` role override is a
`menuitem` (macOS menu item; Compose has no menu-item role, so it is a button), otherwise the
primary action is a button (macOS: a link for safe `href`s). `aria-disabled` rows stay exposed but
not enabled; hard-disabled rows are not focusable. The row's index in its own set (the list, or
its parent's panel) is the set position (macOS `accessibilityRowIndexRange`, Compose
`CollectionItemInfo`; the source sets no `aria-setsize`/`aria-posinset`, the browser derives them).
The expanded panel is a `list` (rows), `group` (selection) or `region`, labelled by the headline
unless a region; interleaved dividers are hidden unless the list role permits separators.

**Truncation tooltips.** Headline and supporting text are wrapped in the shared md-tooltip
renderer, enabled only while the text is clipped (the source's scroll vs client size check: a
single line that would wrap, or clamped lines that would grow). The enabled tooltip carries the
full text as its description and opens its popup on hover, focus or its accessibility action
inside an `AWCTooltipScope` (Swift `AWCTooltipScope`, Compose `AWCTooltipScope`); without a scope
the text renders unchanged. Slotted headline/supporting content keeps its own content (no
tooltip), as authored nodes have no single text to repeat.

## Platform notes

- **Swift.** `AWCNativeListView` owns an observable `AWCListRuntime` (roving focus, selection,
  disclosure, displayed order, drag). Rows use the shared `AWCNativeButtonFocusBridge` for
  keyboard focus, `AWCCSSTransitionTrack` for CSS transitions and `AWCNativeBoxShadow` for the
  dragged elevation. The shared density environment gained `awcNativeSpacingRung`
  (`Density.swift`, `AWCNativeView.swift`, additive): −2…−4 replace the spacing insets, −1 keeps
  the inherited ones — the source's hybrid "local −1 inside global −4" measures 52 px rows with
  8 px inline padding and 4 px list padding.
- **Compose.** `AWCComponent` content is opaque, so rows register with the list and are ordered
  by their laid-out position; a reorder keeps the authored composition and translates rows to
  their displayed slots (accessibility order follows the authored order until the host applies
  `mdReorder`). The hybrid density case (local −1 inside an inherited −4) takes its spacing tokens from the
  nearest rung that defines them (`LocalAWCDensityRungs`), as SwiftUI does: paint case 120 is compared like every other
  case (gate-7 r3-15). Chrome resolves the generic `serif` family to Times; Android only has Noto Serif, so
  the `trailing-supporting-text-font` cases compare the trailing text advance (and the flexible
  content beside it) within 3 px.

## Verification

All counts are from the runner jobs named below, against the Chrome 153 oracles in
`outputs/native-parity/md-list/web-oracle/` (264 paint cases; 27 interaction runs in light/dark ×
LTR/RTL, plus the reduced-motion and extra/hooks sets). Evidence and `checkpoint.json` files are in
`outputs/native-parity/md-list/native-swift/` and `native-android/`.

| Suite | Swift (macOS) | Compose (emulator API 36) |
| --- | --- | --- |
| Paint, geometry, accessibility roles/states and tooltip enablement (264 cases) | 29418/29418 (jobs 198, 208) | 27983/27983 + 32 known-gap checks (A257 `full8`) |
| Interaction states, per-frame motion, events, focus, phase paint | 109773/109773; 61 input-latency gap samples in 3 input phases (job 431 pass 3; passes 1–3: 116383, 113116 and 109773 checks with 44, 45 and 61 samples, pass 1 under a concurrent heavy job; job 208: 112882, 68) | 175279/175279; 110 input-latency gaps (A257 `full8`, as in A242) |
| Truncation tooltips (enablement, description, popup) | 8/8 (jobs 200, 208) | 6/6 (A247 `tooltip7`; passes in `full8`) |
| Methods (both tags, controllers) | 28/28 (jobs 198, 208) | covered by the states test (controller calls) |
| Laboratory live host | 24/24 (`test-live-list.mjs`, job 206) | `LivePreviewListHostTest` passes (A253, `full8`) |
| Style cascade unit tests | — | `NativeListStyleTest` 5/5 (in the unit suite) |
| Full suite | every view fixture exits 0 (40 fixtures, plus NativeListStatesIntegration with `-O`); package scripts 8/8 (job 208) | 245 device tests: 239 pass, 6 fail = the 5 pre-existing failures and the load-sensitive accordion timing test (every list test passes); unit suite 195/195 (A257 `full8`) |

How the comparison works: each Chrome phase is replayed at its source time; native values are
sampled every rendered frame and must lie inside Chrome's per-frame envelope over a ±34/40 ms
window (two frames; Chrome has no sample before its first rAF, so a run's first 34 ms are
skipped). Phase end states compare focus, the focus ring, selection, expansion, each row's box
(with its drag/shift translation, as `getBoundingClientRect` reports it) and flat pixels inside the
list's clip.

**Phase shots are anchored to the native input (jobs 430–431).** Chrome takes each phase's shot a
fixed time after its own input (the sampling window plus the screenshot), and the per-frame values
were already mapped through each phase's actual native input time. The native shot, however, was
taken at a fixed time after the run started, 25 ms before the next phase. When the Mac was loaded
and an input was injected late, the shot therefore landed earlier after the input. That is why
job 309 (a full suite on a loaded Mac) failed one check out of 64510:
`extra-expandKeys-…-hooks-child-enter` flat pixels. That shot falls in md-ripple's keyboard wave
fade (opacity 0.12, fading over 150 ms from about 450 ms after the Enter key). Chrome's shot shows
opacity ≈ 0.017; the late native shot still had about 0.06.

- **Reproduction.** Delaying that input by 60 ms reproduces the failure exactly
  (12440/167485 pixels > 6 at (126,206), with the shot 96 ms early and the native wave still at
  0.12).
- **Fix.** The shot is now taken the same time after the native input as Chrome's (the test
  waits from the input, not from the run start), with no tolerance change.
- **Determinism.** With the fix, the wave opacity at that shot is 0.011 in every run: unloaded,
  with the injected 60 ms delay, and under a concurrent heavy job (a clean SwiftPM build loop
  plus one busy loop per core, 1-minute load average up to 517 on 16 cores).
- **Side effect.** A late phase now delays the following phases (each shot takes about 35 ms
  against the 25 ms gap). Inputs ran up to about 0.4 s behind Chrome's schedule by the end of a
  run, and every check still passed.
- **Diagnostics.** `shotTiming` in the results records each shot's input lateness, its time
  after the input and the wave opacity. `AWC_LIST_STATES_SHOT_ANCHOR=t0` and
  `AWC_LIST_STATES_INPUT_DELAY` re-create the earlier behaviour (evidence in
  `native-swift/shot-timing/`).
- **Compose** is unaffected: its test drives a virtual frame clock, so inputs and shots happen at
  exact times.

**Input-latency gaps (reported separately; never counted as passes; bounded, not grown).** The
oracle replays inputs through CDP round trips, so Chrome receives each input after the phase time.
Measured from the oracle's own events (first source event after each phase, all three sets):

| Input | Phases | Delay after the phase time |
| --- | --- | --- |
| Key press | 49 | 0.5–4.7 ms (median 1.1) |
| Single pointer press / release / move | 37 | 1.1–17.7 ms (median 7.8) |
| Composite move + down + up click | 33 | 3.9–52.1 ms (median 27.2) |

The native harness injects at the phase time. A per-frame value outside the ±34/40 ms envelope
but inside the envelope widened by exactly one more 60 Hz frame (±50/56 ms) is recorded as an
input-latency gap with its value and time; anything further is a failure. The one-frame bound
covers the largest measured delay (52 ms ≈ the two-frame base window plus one frame). Counts:
Swift 71 → 47, Compose 114 → 110 after this pass's fixes. Compose compares the same 175279 values
in every run (A242, A257) and stays at 110.

The count is per sampled frame, and the Swift harness samples by polling (`pump(0.004)`), so the
number of samples depends on the Mac's load: job 208 ran unloaded and compared 112882 values
(1.70× job 198's 66359), and recorded 68 gap samples instead of 47 (0.060 % of samples instead of
0.071 %). With input-anchored shots (job 431) the three passes recorded 44, 45 and 61 samples in the same phases. The bound did not change. By input phase: job 198's 47 samples are all in the expand
click of `expand-expand-standard-none-{light-ltr,dark-rtl}` (row 1's caret rotation, panel height
and panel opacity, 1935–2040 ms); job 208's 68 are in the same two phases plus one sample of row
0's corner morph in `select-options-standard-single-select-light-ltr` at 1502 ms (a composite
click). Retiring the class needs the harness to inject each input at the time Chrome received it
(the oracle's first event after the phase) rather than at the phase time.

**Emulator touch mode.** A254 and an unloaded recheck (A255) failed 7 suites (the list's
`custom-reorder` run, three accordion suites, card lifecycle, loading-indicator focus paint and
split-button state opacity), deterministically. The display had been left in keyboard
(non-touch) mode by an earlier key-driven run, and Android 14+ keeps that state per display across
apps, so new activities took initial focus. One real tap restores touch mode; with it the same
classes pass 22/22 (A256), and the full run A257 starts with that tap. No source changed.

**Hybrid density (Compose) — fixed (gate-7 r3-15).** Paint case 120 (local −1 inside global −4) takes the inherited
rung's insets and gaps from `LocalAWCDensityRungs`; its 32 checks are compared like every other case.

**Fixed in this pass (found by the oracles).**
- A host-pointer press reaches the style one frame after it starts (Chrome applies `:active` at
  its next frame), so a click whose down and up land within a frame never paints a press (Swift).
- The md-switch adapter takes focus on click and is a tab stop (a focus bridge with the switch's
  checkbox accessibility, as NSSwitch reports itself); an authored md-switch keeps its 52×48 host
  box in a row, so the row is 64 tall as in Chrome (the earlier "switch height" gap is gone).
- Source paint order: the row's in-flow content, then the positioned md-ripple and state layer,
  then the positioned image-wrap and caret host. The state layer now covers icons and text but not
  the leading image or the open caret's fill, on both platforms (fixes the hooks caret fill, the
  image-selection scrim and the Compose leading-icon colour under a pressed caret).
- md-ripple paints `currentColor` (the row's label colour), fixing the custom-hooks pressed blue.
- `.md-list-item__row` keeps its own state radius, so an expanded focused row's layer stays
  rounded at the bottom while the host's end corners are square (Swift).
- The caret shows md-icon-button's own hover 0.08 / pressed 0.10 / focus 0.12 layers.
- Rows sliding under a drag render their progress from the frame after the pointer move, as Chrome
  restyles them in its handler (Compose).
- Earlier in this pass: Tab order, caret and drop focus, drop re-insertion (rest, then `:hover`),
  Alt+Arrow re-insertion, the lifted row's z-order and overflow, the collapsed panel's padding
  height, the caret focus ring, reduced-motion state layer, and key-driven Compose timing.

## Laboratory (gate 3)

Follows the md-card Laboratory pattern; evidence and `checkpoint.json` are in
`outputs/native-parity/md-list/laboratory/`. Installed by `work/list-lab/lab-patch.py`
(new files plus idempotent anchored edits).

- **Appearance module** `apps/native-playground/list-appearance.js`: 10 md-list and 68
  md-list-item hooks, generated from `work/list-staging/hooks.py` (kinds color, corners, length,
  opacity, font, shadow, duration). The test asserts them equal to the custom properties in
  `md-list.css` / `md-list-item.css` (comment fragments ending in `-`, such as
  `--md-list-item-three-line-{top,bottom}-space`, are excluded), to the IR `cssProperties` (the
  source documents `--md-list-item-active-container-shape` twice) and to both released policies.
  Parts: `drop-placeholder` on the list; 29 item parts, 27 with native part appearance (the two
  tooltip popups are styled through the shared md-tooltip appearance). The shared typed-hook
  profile gains a `font` kind (a CSS font-family list: trimmed, at most 256 characters, no
  `; { } < > \`).
- **Styles panels**: `COMPONENT_APPEARANCES` entries for md-list (Container, Drop placeholder) and
  md-list-item (Container, State shapes, State layer, Text, Icons, Spacing, Avatar and video,
  Image, Expansion). A JSDOM test drives every field; invalid input keeps the last valid value.
- **Retained updates** for all 8 md-list and 28 md-list-item properties with the source types
  (`lines` is 1 | 2 | 3 on md-list-item only, checked before md-skeleton's numeric `lines`).
- **Methods**: md-list `activateNext`, `activatePrevious`, `selectItem(index)` and
  `getSelectedIndices()` (its result is returned to the Laboratory); md-list-item
  `setFocus({ focusVisible })`, `focusItem`, `toggle`, `expand`, `collapse`. **Events**:
  `mdSelect`, `mdActivate`, `mdReorder`; `mdClick`, `mdExpand`. The item's `mdItemClick`,
  `mdItemSelect`, `mdRequestActivation` and `mdItemRequestReorder` are the list's internal
  protocol: the iOS policy lists them as unsupported events, the Android policy lists only the
  supported ones. **Slots**: the list's default slot and the item's 8 slots.
- **Policies and IR**: `packages/native-ios/NativeSupport.json` and
  `packages/native-android/support.json`; IR and catalog regenerated with
  `node packages/native-compiler/src/cli.mjs build`.
- **Live hosts.** Swift `LiveRenderer/main.swift` (list and item appearance with subtree
  defaults, controllers, method results, retained updates, pointer input):
  `apps/native-ios-playground/scripts/test-live-list.mjs` 24/24 (job 206). Android
  `LivePreviewActivity.kt` + `LivePreviewList.kt`: `LivePreviewListHostTest` 1/1 (A253). Both check
  the fixture geometry and the local-over-default list padding plus inherited row spacing through
  the list height (the live inspection measures the root only), the segmented update, roving
  `activateNext` (index 1, after the initially active first row), silent `selectItem`,
  `getSelectedIndices` before and after a pointer selection of the third row (source `mdSelect`
  payload), rejected invalid updates and arguments, and on a standalone row `expand`, `toggle`,
  the disabled no-op and `setFocus`.
- **Examples**: `outputs/native-parity/md-list/laboratory/examples/generate.mjs` writes 93 Swift
  and 93 Kotlin examples from the released policies (for both tags: basic, theme, copied
  default, every hook, hook defaults, every property, variants and densities, and every event,
  method, slot and part). Swift type-checks with no errors (job 205); Kotlin compiles in the
  androidTest source set (A251). The HTML, React, Vue, Svelte and Angular snippets are asserted by
  `list-integration.test.mjs`.
- **Studio**: the focused suites pass 135/135 (job 209); the full suite runs 731 tests, 729 pass
  (job 207), including all 8 list tests. The 2
  failures also occur in md-card's full run and are not list code: local AI instructions are
  unavailable in the runner (503), and `recipes.test.mjs` does not yet expect md-split-button's
  text editor.

## Not yet done

**Remaining failures.** None in the md-list suites on either platform (see the table).
- *Playground build (fixed).* `test-native-preview` and `test-native-button-hosts` failed in job
  199 while building `apps/native-ios-playground`. The recovered log (`native-swift/script-preview.log`)
  shows `cannot find 'switchFocusConfiguration' in scope` (Actions.swift) and no member
  `awcListTruncationTooltip` (NativeListItemView.swift:360): both are defined in files added in this
  pass (`ListSwitchFocus.swift`, `ListTruncationTooltip.swift`), so the playground's SwiftPM build
  plan for the path dependency was stale and missed the new sources; it was not a type-checker
  timeout. A fresh `swift build` of the playground with the full log (job 201,
  `native-swift/playground-build.log`) succeeds with no source change.
  All 8 package scripts pass after it (job 202).
- Android: none beyond the pre-existing non-list failures listed above.

**Scope not done.**
- *iOS runtime.* The UIKit branches (focus bridge, blur after a drop, the switch focus bridge) are
  written but not run; only macOS was exercised.
- *Compose accessibility after a reorder.* The accessibility order follows the authored order until
  the host applies `mdReorder`; Compose has no menu-item or link role (menu rows and link rows are
  buttons).
- *Slotted headline/supporting content* has no truncation tooltip (authored nodes, no single text).

**Next steps.** An iOS simulator run.

## Laboratory inspection schema (2026-10-27)

The SwiftUI list reported a two-edge `padding` and a numeric `gap`, and the row a numeric `gap`. The Laboratory's inspection schema requires four edges and a `{row, column}` record, so every SwiftUI list live preview failed with `502 INVALID_LIVE_FRAME`.

The list now reports `[block, inline, block, inline]` padding and a row gap; the row reports a column gap. The old values remain as `paddingBlockInline` and `contentGap`.

Results: list paint 29,418/29,418, states 112,930/112,930, methods 28/28, tooltips 8/8. `test-live-list` passes, and the preview opens through the server. See [laboratory-sweep.md](laboratory-sweep.md).

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeListMethodsIntegration` | **28/28** | **28/28** | **28/28** |
| `NativeListPaintIntegration` | **29418/29418** | **29418/29418** | **29418/29418** |
| `NativeListStatesIntegration` | 76972/76982 | 77217/77221 | 75794/75803 |
| `NativeListTooltipIntegration` | **8/8** | **8/8** | **8/8** |
| **Total** | 106426/106436 | 106671/106675 | 105248/105257 |

Fixes from this gate: role=option is static text on UIKit, rows store their geometry without their drag/shift translation. Open: after a click the state layer / corner morph lags Chrome by one to two frames on some samples (expand, select-options: 10 / 4 / 9 checks; ios-harness.md Open items 1).

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
