# Accordion Compose renderer checkpoint

Status: the **dedicated Jetpack Compose renderer is the production dispatch** for
`md-accordion` and `md-accordion-item`: `AWCComponent` (and the generated typed
wrappers that call it) always render them with `NativeAccordionGroup` /
`NativeAccordionItem`. The earlier adapter (`Accordion`, a `SelectionContainer` +
`OutlinedCard`/`ListItem` stand-in) and the temporary opt-in
`AWCAccordionRendererScope` were removed once nothing depended on them. It is
exercised on the Android emulator (AwcNative AVD, API 36, arm64). Floating mode
and the drop-placeholder paint are implemented and verified against Chrome
captures. The Laboratory integration (support policy, Styles panel, retained
updates, item methods, `LivePreviewAccordion` host, compiled examples) is in place —
see [Laboratory host](#laboratory-host-2026-10-23); the separate final audit is pending.
This does not accept Accordion/Accordion Item as completely migrated.

## Implemented

**Group and ownership.** `NativeAccordionGroup` binds the existing shared state
model (`NativeAccordionState`) to Compose. Only direct item children are owned,
as in the source: children register during composition and the owner connects in
its effect, keeping only registrations whose attached layout node is a direct child
of the group's layout node (modifier-node markers compare the item's parent layout
coordinates with the group's inner coordinates), so an item wrapped in a `Column`
or another layout is never owned, not even provisionally at connection. Afterwards
the parent data of the real layout children (`layoutId`) is authoritative: authored
membership/order changes are detected in the measure pass and synchronised.
Non-item children are laid out in place between the items.
Display order follows the retained state order (reorder never recomposes or
remounts an item). Events go through the real native action scopes: the owner is
an `AWCActionDispatcher` whose bubble listener performs source coordination, so
capture/target/nested-bubble order, `stopPropagation`/`stopImmediatePropagation`
and `preventDefault` behave like the source. Legacy `onEvent` observers are target
listeners. `AWCAccordionItemController` exposes `toggle()`, `focusHeader()` and the
current expanded/collapsible/disabled/index values.

**Layout and paint.** Filled tiles with the density-sensitive gap (local −3/−4
rebinds the small gap, an inherited raw scale does not), outlined chassis with
1 dp border, `max(8,12+density)` radius and 1 dp item separators, header
min-height/padding/gap/typography for densities 0…−4, Roboto source line boxes,
supporting text, the bundled variable Material Symbols leading glyph (FILL 0→1,
wght 400→500 on the effects clock), the source SVG chevron, drag grip with its
−4 inline-end margin, and the expanded tile corners/colours/elevation. Source
box-shadows are painted from the generated elevation tokens or hooks: outer layers
clipped out of the border box (Gaussian σ = blur/2), inset layers above the
surface and below children, CSS list interpolation (padding with transparent
layers, discrete switch on inset mismatch).

**Disclosure.** Content is composed once and retained. The panel height follows
the motion model's height fraction and the content clip its square; collapsed
content is cleared from semantics, excluded from focus traversal (`onEnter`
cancel), has its pointer input consumed, and loses focus if it held it. All five
presets, duration hooks, the bounded effects clock, interruption from the
presented values, reduced motion (no running frames, no leading scale) and
`transition="none"` are implemented. `contentMaxHeight` is a content-box cap
(px, em, rem, ch, %, `calc()`, `min()`, `max()`, `clamp()`; invalid/negative/
`none`/`auto` mean no cap but keep the focusable scroll container), with the
source percentage behaviour (natural grid contribution, smaller viewport), a
native scroll container that is a focus stop, keyboard scrolling (Arrow 40 dp,
Page, Space, Home/End) that continues to an enclosing container at a boundary,
scroll semantics, and a retained offset across collapse and cap edits.

**Interaction.** Pointer activation, Enter/Space, ArrowUp/Down (wrapping, skipping
disabled), Home/End, Alt+ArrowUp/Down keyboard reorder, keep-one locked headers
(focusable, announced disabled, no toggle), disabled headers (not focusable or
activatable), visible focus only for keyboard focus, pointer reorder from the grip
(lift on pointer-down, dashed drop placeholder in the padding box, commit on
release, abandon on `ACTION_CANCEL`; the grip consumes its gesture so the header
never toggles), and the lifted tile's dragging fill/radius/elevation-4 with
clipped children.

**Reorder motion.** Sibling shifts and the drop-placeholder glide are CSS
transitions on the composition frame clock (`NativeAccordionReorderMotion`, one
`AWCCSSTransitionTrack` per sibling and one for the placeholder): siblings use
`--md-sys-motion-duration-short3` with the state easing (emphasized for
expressive/standard, standard for fade, `cubic-bezier(0.4,0,0.2,1)` for collapse),
the placeholder `--md-sys-motion-duration-short4` with the standard easing;
`transition="none"` and reduced motion change values without a transition. Each
style change follows CSS Transitions Level 1: an unchanged end value keeps the
running transition, a current value equal to the new value or a zero duration
cancels without a transition, a return to the reversing-adjusted start value
starts a reversal shortened by `|outputProgress·oldFactor + 1 − oldFactor|`, and
any other change retargets from the current value with the full duration. The
pointer handler registers a frame awaiter synchronously, so a move's style change
is applied at the frame time of the frame that first renders it (progress 0 in
that frame); placement reads the track values at the frame time without
recomposition, and the frame loop runs only while a transition runs. The
placeholder appears at the lifted slot without a transition. Drop and cancellation
clear every track in the same tick (everything snaps), and the lifted tile follows
the pointer without a transition. `AWCAccordionReorderInspectionScope` exposes a
read-only view of the tracks for inspection and tests.

**Drop placeholder paint.** The fill (primary-container at 0.45, or the colour hook)
under the dashed `border` (primary at 0.55, or the outline hooks) in the placeholder
shape, with the opacity hook on the whole layer. The dashes follow Blink's rounded
dashed border: one stroke along the closed centerline (radii reduced by half the
width) starting where the top-left corner meets the top side and running clockwise
(physical, also in RTL), dash/gap 3w/2w below 3 px and 2w/w from 3 px, the gap
adjusted by `StrokeData::SelectBestDashGap` so whole dashes fit the closed
perimeter (quarter-ellipse arcs by Ramanujan's formula), phase 0, solid when the
perimeter holds at most two dashes; width 0 paints no border. In an outlined
chassis the placeholder sits 1 px below the content top, as Chrome lays it out,
and is clipped by the chassis' rounded corners.

**Floating panel.** `floating` places the group `position: fixed`: a layout modifier
reports 0 × 0 to the parent (no in-flow footprint) and places the panel at
`initial-x`/`initial-y` (then the drag position) in physical coordinates of the
viewport — `AWCAccordionViewport` when one encloses it, else the window root — with
width `min(floating-width ?? 360, viewport width − 16)`. The panel paints its own
surface (`floating-bg` ?? surface-container-low), radius (`floating-radius` ??
corner-large 16) with clipped children, and its box-shadow from elevation-3 (or
`floating-elevation`) to elevation-5 (or `floating-elevation-active`) while dragging,
as a CSS list interpolation on the spring-effects transition (200 ms
`cubic-bezier(0.34,0.8,0.34,1)`; instant for `transition="none"` and reduced
motion). Filled items are flush (no tile radius, fill or shadow unless their hooks
set one) and the outlined chassis drops its border. The first item carries the
chassis grip: a 52 × 16 hit area 4 dp below its top, above the header in hit
testing (pointing at it never hovers the header), with the 32 × 4 pill. The grip
follows the source cascade on the frame clock — rest 32 / 0.45 in on-surface-variant
(on-secondary-container when expanded), `:hover` 38 / 0.9 with a 10 % state-layer
tint behind it, `:active` or a dragging owner 40 / 1 (primary while dragging, the
expanded colour kept) with a 16 % tint; width on the item's preset spring
(expressive 500 ms `cubic-bezier(0.38,1.21,0.22,1)`), opacity and colours on the
effects transition; `chassis-handle-color` and `chassis-handle-bg-hover` replace the
defaults in every state. A primary press starts the drag at once (`mdDragStart`),
every pointer move of the captured pointer — including the Enter/Exit Compose
reports while the pointer outruns the panel — moves it (`mdDragMove`), and release
or cancellation ends it (`mdDragEnd`); payloads carry the physical viewport client
point, the panel origin and the delta. Bring-to-front uses one process-wide counter
starting at 1000, incremented on load and at drag start when `bringToFront` is on
(panels loaded together increase in composition order); without it the panel keeps
the stylesheet z-index 1000. The z-index is applied with `Modifier.zIndex` on the
component. Leaving floating mode clears the z-index and the drag; entering it again
re-seeds `initial-x`/`initial-y` without a raise.

**Appearance and parts.** Public `AWCAccordionAppearance` (14 parent hooks, all
rendered: gap, outline colour, chassis shape, elevation, the five floating-panel
hooks and the five drop-placeholder hooks) and `AWCAccordionItemAppearance` (24 item
hooks, all rendered, including the two chassis-grip hooks), scoped with `AWCAccordion(Item)AppearanceScope`. Part styling
uses `AWCAccordionItemPartAppearanceScope(part, AWCAccordionPartAppearance)` for
heading, header, state-layer, drag-handle, leading/trailing icons, headline,
supporting-text, panel, content and content-inner: colour, background, border
width/colour, corner shape, physical padding and (negative) margins, width/height/
min-height, opacity, gap and typography, with source margin collapsing through an
unpadded/unbordered heading and between heading and panel, header `width:100%`
overflow with the direction-dependent over-constrained margin, and content-box
height/max/min precedence for content-inner. Wrapping one item targets it; nested
scopes merge sparsely and reset to inherited values.

**Interaction states.** The header's state layer, the grip and the ripple follow the
source under real input, as CSS transitions on the composition frame clock
(`NativeAccordionInteraction.kt`; the same CSS Transitions Level 1 starting rules as
the reorder motion, for numbers and premultiplied colours). A pointer observer on the
header (initial pass, never consuming) supplies `:hover` of the header and of the grip,
`:active` and the press point, and registers the frame awaiter in the input handler,
so a change starts at the frame that first renders it.
- State layer: the source cascade `:hover` 0.08 < `:focus-visible` 0.12 < `:active`
  0.12 (later rule wins; the `--md-sys-state-*` tokens), on-surface or, expanded,
  on-secondary-container; opacity on the effects transition
  (`min(motion duration, 200 ms)`, `cubic-bezier(0.34,0.8,0.34,1)`), instant for
  `transition="none"` and reduced motion. Disabled: computed but not displayed
  (no transitions, nothing painted); forced colours hide it.
- Grip: 0.55 in the icon colour (also when the item is expanded); `:hover` gives
  opacity 1 and headline-color-expanded on the effects transition and scale 1.08 on the
  preset spring (`--_spring-*`: expressive 500 ms `cubic-bezier(0.38,1.21,0.22,1)`,
  standard medium2 emphasized, fade short3 standard, collapse medium2
  `cubic-bezier(0,0,0.2,1)`), and hovering the grip hovers the header. While dragging
  the header has `pointer-events:none`: header and grip lose `:hover` (the scale
  returns), `:active` (0.12) persists until release, and the grip shows opacity 1 in
  icon-color-expanded.
- Ripple (md-ripple): a press on the header or the grip starts a wave at the press
  point growing to the farthest corner (450 ms standard easing, 0.12 of the header
  ink) that fades over 150 ms once growth and press have both ended; a new press
  finishes the previous wave; like the source it ignores `transition="none"` and
  reduced motion; never for keyboard activation or a disabled item.
- Focus: Tab focus-visible draws the 3 dp secondary outline inside the header
  (`outline-offset:-3px`) with 0.12; pointer focus does not show it.
- Android input mapping: a mouse (`SOURCE_MOUSE`) hover is `:hover`; a primary mouse
  button, touch or stylus press is `:active` and starts the ripple; touch has no hover
  (Chrome's sticky hover after a tap is not emulated, so the layer clears after a
  touch release); after a drop the last hover position is hit-tested again against the
  new layout, as the browser does.

**Accessibility.** The header is a focusable heading node with the Button role
(Compose puts the role on a synthesized child of a merging node), label = headline
then supporting text, `stateDescription` Expanded/Collapsed and the Expand/Collapse
accessibility actions; disabled and locked-open headers are reported disabled;
decorative glyphs are hidden; collapsed panels are absent from the platform tree.

## Verification (actual emulator runs)

Device: emulator-5554, API 36, arm64; fixtures render at `Density(2f, 1f)` and
compare in dp. Oracles are the actual Chrome captures already used by the Swift
checkpoint; all JSON assets are copied unchanged except the compacted geometry
assets, whose generator and source hashes are kept with the evidence. The shift
oracle is also generated as Kotlin data for the JVM replay
(`android-motion/generators/make-shift-oracle.py`, source hash in the file).

| Suite | Oracle | Result |
|---|---|---|
| `NativeAccordionParityTest` geometry | web-light/dark, 62 non-floating × 2 themes (LTR/RTL inside) | 124 configurations, 9,880 checks (root, items, every rendered part; ±0.51 dp) |
| `NativeAccordionParityTest` paint | same | 124 configurations, 744 pixel checks (host, header, headline ink) |
| `NativeAccordionMotionRenderTest` | web-motion.json, 100 samples | 1,340 checks: rendered heights/clip/chevron/leading-scale bounds at fraction × duration and header colour at fraction × 200 ms (interpolated between the two real bracketing frames), start/end timing |
| reduced motion / interruption | source rules | 5 presets snap with no running frames; reversal continues from the presented height |
| `NativeAccordionInitializationTest` | accordion-web-initialization.json | 20 traces, 80 checks (capture/target/nested bubble order, in-listener state, final state, root height, no replay) |
| `NativeAccordionInteractionTest` | source behaviour | 9 tests: pointer/keyboard/controller/semantics activation, exclusive nested order and payloads, keep-one, disabled, Alt reorder payloads, inert retained content, ownership restore, stopped events, nested groups |
| `NativeAccordionScrollingTest` | accordion-web-scrolling.json | 38 caps, 186 checks; retained-offset lifecycle (6 stages) and keyboard scrolling |
| `NativeAccordionAccessibilityTest` | platform `AccessibilityNodeInfo` via UiAutomation | 23 checks incl. real ACTION_EXPAND / ACTION_CLICK |
| `NativeAccordionAppearanceTest` | accordion-web-appearance.json | 76 cases, 4,086 checks: geometry, surfaces, ink, FILL glyph, zero-blur and blurred shadow profiles (analytic CSS Gaussian from the Web's computed box-shadow) |
| `NativeAccordionPartsTest` | accordion-web-parts.json | 192 cases, 9,676 checks (boxes of every part, background/border/ink) + live shared/targeted overrides (7) |
| `NativeAccordionReorderTest` | accordion-web-reorder.json; dragged-tile header paint from the trusted accordion-web-lift capture | 8 cases, 560 checks with real touch input: before/lifted/moved/dropped geometry, placeholder geometry and fill (including the lifted tile's elevation-4 shadow over it), the pressed tile's header paint equal to the trusted Chrome pixel (±0.03), payloads; cancellation/retention test (8 checks) |
| `NativeAccordionLiftTest` | accordion-web-lift (32 Chrome PNGs, trusted CDP mouse input) | 32 cases, 256 checks with the same real mouse sequence (hover, press, 40 px move, 600 ms), compared directly: corner ears/inner pixels (Swift thresholds; worst ear mean 0.69, inner mean 2.11), tint clipping, pressed header paint (state layer + grown ripple, worst channel difference 2), headline ink |
| `NativeAccordionPlaceholderTest` | accordion-web-placeholder (24 Chrome PNGs: default / custom (five hooks) / solid × light/dark × LTR/RTL × filled/outlined, trusted mouse input) | 24 cases, 624 checks: placeholder and item geometry (±0.6), interior fill (mean ≤ 2.5, max ≤ 6; worst 1.0/1.0), corner ears (mean ≤ 4), per side the dash count on the straight part (±1), dash length (±0.6), period (±0.15), top-side phase (±0.75), every full Chrome dash centre within 1.25 px of a native one (worst 1.20) and the dash ink; borderless edge equals the fill; every flat pixel of the clip (mean ≤ 1, >6 at most 0.5 %; worst mean 0.27, none over 6) |
| `NativeAccordionFloatingTest` | accordion-web-floating (Chrome floating.html, 112 PNGs, trusted CDP input) | 1 test, 16,466 checks. Paint (32 cases: default/custom hooks × light/dark × LTR/RTL × filled/outlined × closed/open): panel/item/handle/bar geometry at the viewport position, grip opacity/colour/tint, load raise step, zero footprint, rounded clip at the corners, every flat pixel of the clip (worst mean 0.35, none over 6) and the shadow σ fitted from the coverage profile below the panel on the light page (48 profiles incl. the drag phases; Chrome 0.97–1.02 × blur/2, native 0.975–1.008 in the final run, worst coverage difference 0.014). Drags (16: default/custom × expressive/none × LTR/RTL × filled/outlined) with real mouse input at Chrome's input times, frame by frame: grip width/opacity/colour, handle tint, panel elevation and position at each rendered frame inside Chrome's samples over ±2 frames (monotone envelope across Chrome gaps), 2,340 frames, none outside; per phase (hover/press/move/release/leave) geometry, dragging state and flat-pixel paint; header not hovered while the grip is; drag-start raise; `mdDrag*` names and payloads (±0.01); grip spring and spring-effects timings; transition none instant. Stacking (load order, bring-to-front on drag, no raise without it, painted order), narrow viewports 300/200, leaving and re-entering floating mode, reduced motion |
| `NativeAccordionRendererContractTest` (JVM) | source values | 9 tests: token/shadow parsing and interpolation, colour mixing, content-cap grammar, hook/part validation and merging, margin collapsing, interruption maths |
| `NativeAccordionReorderMotionTest` (JVM) | accordion-web-shift.json (Chrome CSSTransition records + per-frame samples, 5 presets × cross/reverse/extend/up, normal and reduced motion) | 3 tests; model replay of Chrome's own start times: 40 cases, 1,880 checks (transition count, duration incl. reversal shortening ±0.01 ms, from-value ±0.01, easing, every sample ±0.05 px, settled-only values when the source snaps, timing rules); CSS Transitions Level 1 starting rules; lift/clear |
| `NativeAccordionShiftTest` | same | 40 cases, 9,172 checks with real touch input, frame by frame on the composition clock: every rendered sibling offset and placeholder top equals its native track (±0.26 dp), transitions start at the frame that renders the input, count/end values/durations versus the source (reversal factor exact to 1e-9 from the previous output progress; shortened durations within 25 ms of Chrome, max measured 21.7 ms), settle values, snap-only rendering for none/reduced, snap clear on drop; drop and cancel during running transitions snap in the next frame |
| `NativeAccordionStatesModelTest` (JVM) | accordion-web-states.json (Chrome trusted CDP mouse/keyboard: light/dark × expressive/none × hover-closed/hover-expanded/press/grip-hover/grip-drag/focus/disabled, normal and reduced motion) | 2 tests; model replay of each step at Chrome's own style-change time: 56 cases, 41,720 checks (state-layer opacity 26, grip opacity 8, colour 8 and transform 8 transitions: start, duration, easing, from/to; ripple grow/fade records and the fade rule; every sample: state opacity/colour, header background, grip opacity/colour/scale, ripple opacity/scale/width, dragging/pointer-events, focus outline, expanded); cascade, timing and ripple rules |
| `NativeAccordionStatesTest` | same | 3 tests with real Android input. 56 cases, 6,647 checks frame by frame (mouse MotionEvents with hover, button press/move/release; Tab key events): 1,661 pixel checks (state layer and ripple composited over the tile, focus ring), grip bounds carry the transitioning scale, the native transitions match the Chrome records (count, duration, easing, end values) and start at the frame that renders the input, ripple diameter equals Chrome's farthest-corner wave, settled state at the end of every step, no painting when disabled; touch press (`:active` + ripple, no hover); a mouse hover injected through UiAutomation reaches the header |
| `NativeAccordionDispatchTest` | production dispatch | 2 tests: the Playground sample through plain `AWCComponent` (owned items, parts, gap, keep-one, exclusive payloads); items wrapped in a `Column` are never owned (frames 0–4 and later: no default selection, no coordination, no lock, no group event) while direct siblings connect without an opening transition. A negative control with the directness filter disabled fails this test (`android-dispatch/mutation-no-direct-filter*`) |

Latest final run, with the floating panel, the placeholder paint and the trusted lift
fixture (`android-floating/full*`, runner job A063): the entire `androidTest` suite, no
class filter — 235 tests in 57 classes, 230 passed; all 33 accordion tests (16
classes, including `NativeAccordionFloatingTest` and `NativeAccordionPlaceholderTest`)
pass and the 5 failures are the same pre-existing ones as in the 228/233 baseline
(same tests, same messages). `:native-ui:testDebugUnitTest --rerun`: 190/190.
`android-floating/checkpoint.json` and `android-placeholder/checkpoint.json` record the
per-class results, the evidence summaries, the oracle hashes (identical to the
read-only native-ios fixtures) and SHA-256 hashes of the changed sources.

Previous final run, with the interaction states (`android-states/full*`, runner job
A050): the entire `androidTest` suite, no class filter — 233 tests in 55 classes, 228
passed; all 31 accordion tests (14 classes) pass and the 5 failures are the same
pre-existing ones listed below (same tests, same messages).
`:native-ui:testDebugUnitTest --rerun`: 190/190 (adds the states model 2).
`android-states/checkpoint.json` records the per-class results, the evidence counts,
the input mapping and SHA-256 hashes of the changed sources and the copied oracle.

Final run with production dispatch (`android-dispatch/full*`, runner job A039): the
**entire** `androidTest` suite in one instrumentation run, no class filter — 230
tests in 54 classes, 225 passed. All 28 accordion tests (13 classes, including the
first-frame probe) pass; the 5 failures are pre-existing and identical, test by test
and message by message, to a baseline run of the same suite before any change in
this step (`android-dispatch/baseline-all*`, 226 tests, the same 5 failures):
`NativeInteractionTest.everySourceTagComposesNatively` and
`NativePreviewPresentationTest.allWindowBasedFamiliesComposeInsidePreviewAndCanDismiss`
(md-fab-menu requires `AWCFabMenuScope`; md-accordion and md-accordion-item are
composed before that point), `NativeInteractionTest.genericProgressUsesSourceDefaultMaximum`,
`NativeInteractionTest.segmentedSetCoordinatesSelectionAndContainerEvent` and
`NativePreviewPresentationTest.everyAllowedTextSlotRendersTheEditedContentWithoutMaskingFixtureProperties`
(md-badge icon slot; the md-accordion-item text slot is checked before it).
`:native-ui:testDebugUnitTest` re-executed with `--rerun`: 188/188 (accordion state
15, motion 2, browser state 7, renderer contract 9, reorder motion 3).
`android-dispatch/checkpoint.json` and `android-motion/checkpoint.json` record the
per-class results, the evidence counts, the baseline, and SHA-256 hashes of every
changed source (checked against snapshots of the worktree). The earlier checkpoint
(`android-parts/checkpoint.json`) covers the opt-in renderer.

## Findings while verifying

- The lift reference is now captured with trusted CDP mouse input (`lift.html`; the
  grip press is a header `:active` with a fully grown md-ripple wave). The lift test
  replays the same mouse sequence and compares the pixels directly, and the reorder
  test takes the dragged tile's header paint from that capture; the earlier
  compositing of the native press feedback onto synthetic-event references
  (`AccordionWebFixtures.pressFeedback`) is removed.
- Floating verification found three defects, all fixed: the floating group's root
  reported a 0 × 0 inspection node that the collector drops, which orphaned every
  part of the panel (`AWCComponent` now records a zero-size root for a floating
  group); the grip treated the first move of a drag as a hover exit, because Compose
  reports a captured pointer that leaves the not-yet-moved handle as `Exit` (Enter/
  Exit of the captured pointer are now moves; relayout re-sends without screen
  movement are not); payloads are computed through the handle's live layout
  coordinates.
- Chrome's trusted harness moves the mouse to the release point before releasing;
  Chrome delivers that zero-distance `mouseMoved` as a `pointermove` (a fifth
  `mdDragMove`). Android input drops zero-distance moves, so the floating test
  injects that move 0.0005 CSS px away (payload tolerance unchanged).
- The floating oracle confirms Chrome's box-shadow blur σ = blur/2 (profile fits
  0.97–1.02). The native profiles fit 0.975–1.008 in the final full run; in the
  isolated floating runs the elevation-5 lift profile fitted 0.935 (coverage within
  0.009 of Chrome) instead of 0.994 (within 0.003) — the device's blurred-shadow
  raster differs between runs, both inside the checked bounds.
- Chrome dates a style change by the frame before the input and starts pending
  ripple animations a frame later; its ripple fade begins up to two frames after
  `max(growth end, release)`. The native model starts each change at the frame that
  renders the input; the JVM replay applies Chrome's own times.
- The grip of an expanded item used icon-color-expanded; the source keeps
  `--_icon-color` (fixed).

- The original `web-dark.json` captured the four animated presets
  (`preset-expressive/standard/fade/collapse`) mid colour-transition, because the
  theme was toggled on already rendered fixtures and measured two frames later.
  A settled re-capture (`web-reference/android-settled.html`; theme applied before
  creation, animations finished) differs from the original **only** in those
  fixtures' colours (light: no differences; geometry identical). The Android
  assets use the settled capture; the diff is preserved.
- Production dispatch exposed two ownership defects, both fixed: before the first
  measure the owner treated every registration as a member, so items wrapped in
  another layout were owned provisionally at connection (they took the default
  selection and its events, and direct items lost it); and a non-item child of the
  group crashed the measure pass (an unchecked cast while ordering slots). The
  Playground sample wrapped its items in a `Column` and now authors them directly.
- Real bugs caught and fixed: SideEffect ordering (children's effects can run after
  the parent's) broke default selection and dispatch at connection — registration
  and wiring now happen during composition; a cancelled disclosure coroutine
  cleared the running transition before the interrupting one read it (a jump on
  reversal); Compose reports `ACTION_CANCEL` as a synthesized release (a cancel
  committed a reorder); `ch` used a hinted, integer-rounded advance; semantics
  read the elapsed time lazily (one frame ahead of the composed frame).

## Laboratory host (2026-10-23)

- `support.json`: every property/event/slot, the item methods, eleven typed item
  parts and 14/24 appearance fields (`AWCAccordionAppearanceScope` /
  `AWCAccordionItemAppearanceScope`); notes state the measured differences
  (local `Modifier.zIndex`, the `AWCAccordionViewport` stand-in, dash drift ≤ 1.20 px).
- `LivePreviewAccordion.kt` parses both typed appearances and retained updates;
  `LivePreviewActivity` hosts the group in `AWCAccordionViewport` (min 320 dp when
  floating), applies both appearance scopes and routes item `toggle`/`focusHeader`
  through `AWCAccordionItemControllerScope`. The native sample matches the recipe
  (two items, the first expanded; an authored-open item emits no connection toggle).
- `LivePreviewAccordionHostTest` 2/2 on the emulator: group gap hook, pointer toggle
  (`mdItemToggle` + `mdToggle` with `expandedIndices`), retained `exclusive` collapse,
  floating placement and a chassis drag (`mdDragStart/Move/End`, panel moved by the
  drag delta), invalid updates rejected; standalone item header-height and padding
  hooks, controller toggle (index −1), `focusHeader`, a semantics-only update and the
  disabled gate.
- Defect fixed in the shared live host: a layout-only traversal (a View layout
  that invalidated nothing, seen once after the standalone item's first draw)
  counted as a submitted frame that never commits, so every capture timed out
  ("Native frame did not commit for capture"). Such a traversal now reuses the
  previous submission's committed surface; a retained update draws its frame so a
  semantics-only change also acknowledges.
- 81 generated Compose examples (both tags) compile as instrumentation source.
- Full device suite: 237 tests, 6 failed: the 5 known `NativeInteractionTest`/`NativePreviewPresentationTest` failures plus `NativeAccordionStatesTest#fiftySixChromeStateCasesRenderTheNativeStyleTracks` (3 of 6,647 expressive grip-drag frame-timing checks) while the Swift suite loaded the same Mac; re-run alone it passed twice. Unit 190/190.

## Remaining / pending

- The final independent audit.
- Floating stacking: Compose has no root stacking context. The panel is placed in
  viewport coordinates and its z-index (`Modifier.zIndex`) orders it only among the
  siblings of its component; panels in different parents, and later content of an
  ancestor, are ordered by the tree (CSS `position: fixed` with z-index 1000+ paints
  above them), and an ancestor that clips (a scroll container, `clip`) clips the
  panel's paint and input. The viewport is `AWCAccordionViewport` or the window root (window
  insets are not subtracted). On the 540 dp emulator window the third stacking
  panel (Chrome x = 520) is placed and compared translated by (−480, +220).
- Dashed placeholder border: the dash centres drift along the closed path; the
  worst native dash centre is 1.20 px from Chrome's (left side, the end of the
  path; the tested bound is 1.25 px). The floating oracle covers expressive and
  none; reduced motion is checked as instant without Chrome samples.
- Interaction states are verified for the default appearance and the expressive and
  none presets (the source oracle); the standard/fade/collapse grip springs follow the
  CSS rules but have no Chrome samples. Chrome's sticky hover after a touch tap is not
  emulated (documented mapping).
- Rendered reversal durations are compared with Chrome within 25 ms only: the device
  test issues the second move on a 16 ms frame boundary and Chrome starts its
  placeholder transition one frame after the siblings (Stencil renders it on the
  next frame), so the reversal points differ; the exact rule is verified against
  each native start, and the JVM replay of Chrome's own start times matches to
  ±0.01 ms.
- Android accessibility has no heading level, region/landmark role or
  labelled-by relation. These are exposed as Compose semantics metadata
  (`AWCAccordionHeadingLevel`, `AWCAccordionRegionRole`, `AWCAccordionRegionLabel`)
  and proposed as platform exceptions (not accepted).
- The owner connects in its effect after the first composition. On the test clock
  the initial composition (frame 0) still shows unowned items, and from frame 1 the
  connected selection is presented without an opening transition (first-frame
  probe panel heights `[-1, 60, 60, 60]`; `-1`: no panel inspection node before
  ownership; the dispatch test records the same for wrapped/direct items). In
  production the connection's recomposition is expected in the first Choreographer
  frame before its traversal; that is not verified, and the first *drawn* frame is
  not captured.
- Forced colours are opt-in on Android (no system forced-palette mode); blurred-shadow rasterisation beyond the sampled
  right-edge profile, and arbitrary authored CSS lengths beyond the cap grammar are
  not exhaustively verified.

Evidence: `outputs/native-parity/md-accordion/android-floating` (floating panel:
focused device runs including the failed intermediate ones, final full run, source
snapshot and diffs, `checkpoint.json`, `make-checkpoint.py`),
`outputs/native-parity/md-accordion/android-placeholder` (placeholder paint and the
trusted lift/reorder switch: focused runs, source snapshot and diffs,
`checkpoint.json`, `make-checkpoint.py`),
`outputs/native-parity/md-accordion/android-states` (interaction states:
unit and device runs including the failed intermediate ones, final full run, source
snapshot and diffs, `checkpoint.json`, `make-checkpoint.py`),
`outputs/native-parity/md-accordion/android-dispatch` (production dispatch:
baseline and final full-suite runs, negative control, source snapshot and diffs,
`checkpoint.json`), `outputs/native-parity/md-accordion/android-motion` (reorder
motion: oracle generator, first device run, source snapshot, `checkpoint.json`,
`make-checkpoint.py`), `outputs/native-parity/md-accordion/android-env` (emulator and baseline),
`outputs/native-parity/md-accordion/android-core` (checkpoint 1: logs, JUnit XML,
settled Web capture, generators, source snapshot, `checkpoint-1.json`; failed
intermediate runs are kept) and `outputs/native-parity/md-accordion/android-parts`
(parts runs, checkpoint 2, final run, `source-snapshot-final`, `checkpoint.json`).
See the [source review](md-accordion-source-review.md), the
[state/motion checkpoint](md-accordion-native-state.md) and the
[Swift renderer checkpoint](md-accordion-swift-renderer.md).
