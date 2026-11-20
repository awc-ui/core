# Accordion Swift renderer checkpoint

Status: the dedicated SwiftUI renderer is the **production dispatch** of
`AWCNativeView` for `md-accordion` and `md-accordion-item` (the earlier adapter is
removed), exercised in a real macOS hosting window, and the Laboratory integration
(support policy, Styles panel, retained updates, methods, live host, compiled
examples) is in place — see [Laboratory integration](#laboratory-integration-2026-10-23).
This does not certify iOS or accept Accordion/Accordion Item as fully migrated.

## Implemented and exercised

The retained group runtime bridges the already verified state model to native
views. It preserves item identity and locally toggled state across unrelated
authored property edits. Direct `expanded` edits still reach the retained item.
The owning event dispatcher coordinates selection during its bubble phase;
target `stopPropagation()` can suppress that listener, while `preventDefault()`
does not reverse the local mutation. Nested parent events reach outer scopes
before the original item event continues bubbling.

Initialization now dispatches through those same live scopes synchronously.
First-layout preparation computes presentation without mutating selection or
emitting notifications; real connection commits it after listeners are bound.
It does not replay an event list after parent coordination has already run.
Twenty actual Web scenarios compare capture, target, nested bubble, cancellation,
state inside every listener, final selection, repeated appearance and reconnect.
The first rendered selected panel also has no transient closed-height frame.

The renderer implements the default filled and outlined geometry, density,
headline/supporting text, leading/trailing content, retained body, native header
focus and activation, exclusive/keep-one behavior, native keyboard navigation
and keyboard reordering. Per-item controllers expose `toggle()` and
`focusHeader()`; targeted SwiftUI slot builders allow authored native content.
Source chevron geometry and source line boxes replace system-icon and text
layout approximations.

Closing a panel changes its layout track and clip rather than conditionally
removing its content. An inert environment disables hit testing, accessibility
and native responder eligibility together. A real native button inside an
authored body retains its local counter and native view instance through
close/reopen. SwiftUI may defer allocating its initial native responder while
the first layout has zero height; that absence is also correctly non-focusable.

The retained body now uses one native SwiftUI ScrollView. Changing the cap never
replaces its authored subtree. `contentMaxHeight` is a content-box maximum with
padding added outside it. The sizing path supports px, em, rem, ch, percentages,
affine `calc()` and bounded min/max/clamp expressions. Percentage caps preserve
the natural grid contribution, then resolve the smaller scrolling viewport;
this distinction is measured from Web, not inferred from a CSS approximation.
The current source-backed matrix covers px/zero/em/rem/ch/calc/percentage/min,
empty/invalid values, short/long content and all five densities. Additional
valid CSS grammars and the unexercised comparison combinations remain pending.

The body has a keyboard tab stop exactly when the source property is nonempty.
Its focus ring is inset into the viewport; Arrow, Home/End, Page and Space keys
scroll the actual native container. Boundary keys continue into an enclosing
native scroll container. Collapse removes focus and descendant interaction.
Removing the cap temporarily exposes all content; reapplying it restores the
previous offset, matching Web's retained scroll state. The bridge uses the
existing ScrollView and keeps authored content in the original SwiftUI tree.

The five motion presets use independent disclosure/spatial and effects clocks.
The running transition starts from the current interpolated values when
interrupted. Real rendered height samples are checked for each opening and
closing preset, including instant and reduced-motion endpoints. This is not yet
full acceptance of every animated color, clip, icon-axis or shadow property.

## Core appearance checkpoint

Four parent hooks now reach the actual renderer: gap, outline color, container
shape and elevation. Twenty item hooks are connected: eleven colors, two corner
shapes, physical header/content padding, minimum header height, two durations
and resting/expanded elevation. The typed appearance modifiers support inherited
values and targeted item/group overrides. Clearing a local override restores its
inherited value without replacing the native header or resetting open state.

Outlined item separators now belong to the item box, matching Web's slotted-child
border. Outer shadow layers are painted outside the rounded surface, with the
first source layer on top; inset layers are painted above the container background
and below child content. Transparent backgrounds do not receive their own outer
shadow. Interpolation pads missing layers with zero-size transparent shadows and
switches the whole list discretely when a corresponding inset mode differs,
following the actual browser's computed interpolation samples.

The built-in leading glyph uses the bundled Material Symbols variable font:
FILL 0→1 and weight 400→500 follow the effects clock. Authored icon slots retain
their own rendering. Reduced motion removes the leading scale, as in the source.
Inspection anchors are placed inside the visual transform so their bounds include
that scale.

The scrolling regression suite also forces a delayed native viewport update.
Restoration remains pending while the old viewport still fills the document;
its later bounds notification completes the restoration without requiring the
child subtree to lay out again. The UIKit branch includes corresponding bounds
and content-size observation but remains uncompiled in this environment.

## Actual evidence

- Forty Web captures: filled/outlined, five densities, open/closed, light/dark.
  Native root width/height and both actual header responder bounds match them.
- Eight default-density configurations also compare captured header, headline
  and expanded-body pixel colors against Web computed styles. Eight PNGs are
  retained and were inspected visually.
- Real native pointer, keyboard, programmatic controller and accessibility
  activation, disabled versus locked-open headers, focus wrapping/skipping,
  keyboard reordering, event cancellation/propagation and body retention checks.
- Actual opening/closing height samples for all five presets. Sampling count
  varies with the host's frame cadence; the complete pass total is recorded in
  `renderer-checkpoint.log`.
- Seventy-six core appearance configurations: source-resolved colors, geometry,
  padding, corners, elevation levels 0–5, transparent surfaces, disabled colors,
  inset/stacked outer shadows and actual outline/filled glyph pixels. Live
  inherited/targeted/reset edits retain identity and open state. Custom long,
  zero and reduced-motion durations run on actual native views.
- Twenty-five actual-browser shadow interpolation samples cover missing layers,
  transparent colors, different list lengths and discrete inset mismatches.
  Together with live overrides and icon bounds, the appearance fixture passes
  1,478 checks. This does not certify blurred shadow rasterization or every
  arbitrary authored style combination.
- Twenty actual-Web initialization cases: 100 exact trace/state/lifecycle checks.
- Thirty-eight actual-Web scrolling configurations, plus real native keyboard,
  nested keyboard boundary propagation, retained counter/instance/offset and
  native inspection agreement: 278 checks, including four deterministic delayed
  viewport restoration checks. Two original scrolling screenshots were inspected.
- Regression runs: 65 state checks, 58 actual-Web sequence snapshots, 716 motion
  model checks, and the 68-check real native focus/keyboard/accessibility suite.

The source reference is checked in as
`packages/native-ios/Tests/Fixtures/accordion-renderer-web-baseline.json`, including
the two source capture hashes. The reproducible extractor, PNGs, successful and
failed logs, and the original checkpoint hashes are under
`outputs/native-parity/md-accordion/native-renderer` in the outer workspace.
The subsequent dispatch/scroll checkpoint, current source hashes, raw Web and
native captures, screenshots, failed/corrected logs and complete focused run are
under `outputs/native-parity/md-accordion/native-dispatch-scroll`. Older manifests
record their earlier source versions; they are not current-source certifications.
The current core appearance checkpoint, complete focused regression log, 76-case
Web capture, 25 shadow samples, native screenshots, failed/corrected runs and
source hashes are under `outputs/native-parity/md-accordion/native-appearance`.
The raw source harness uses the same theme surface behind transparent tiles;
its JSON region is bounded to keep browser screenshots reliable.

The checks caught a genuine density distinction: the small gap condenses at
−3/−4, while the medium inset already condenses at −2. These inherited tokens
are now represented independently. The first paint comparison also exposed an
extra color conversion in the test's `NSColor` sampling path; the encoded PNG
pixels already matched Web. The fixture now samples an explicit sRGB buffer,
consistent with the existing native rendering tests. The scroll fixture also
caught a late inspection callback from a previous remounted test case. Callback
results are now associated with their fixture generation, and inspection bounds
are checked against a separate actual native root view in all 38 cases.
The core appearance checks found an outlined item that was one pixel short
because its separator had been placed outside the item. They also exposed inset
shadows hidden behind the surface and missing-layer shadows that only faded,
without changing their geometry. Both now follow source layering/interpolation.
The glyph fixture checks actual CoreText axes (including their font defaults)
and visible outline/filled pixels; its inspector follows the scaled anchor.
Motion sampling now observes the first 180ms (previously 90ms), which includes
intermediate frames despite offscreen display-link coalescing; every sample is
still constrained by the original source timing envelope.

## Internal item-part checkpoint

The public `awcAccordionItemPartAppearance` modifier now styles eleven rendered
item surfaces: heading, header, state-layer, drag-handle, leading/trailing icons,
headline, supporting-text, panel, content and content-inner. Sparse shared values
and item-ID overrides merge without replacing the native header or losing the
open state; clearing the target restores inherited values and clearing both
restores defaults. The two chassis-handle surfaces remain unimplemented, as does
the parent's drop-placeholder part. An enum entry alone is not implementation.

The typed surface supports colors, border width/color, corners, physical padding
and margins, dimensions, minimum height, opacity, gap and typography where these
affect the source surface. Tests compare **176 actual-Web configurations**:
22 styles × light/dark × LTR/RTL × closed/open. The native suite passes **7,600
checks**, including real inspected boxes, background/border pixels, idle
state-layer opacity replacement and live shared/targeted override reset. The
fixtures include zero font size, negative margins, explicit header width,
collapsed and contained block margins, and body height/minimum/cap precedence.
Captured PNGs and the raw reference are in
`outputs/native-parity/md-accordion/native-parts`.

The comparison exposed three layout errors that are now corrected. A header
with source `width:100%` keeps that width when horizontal margins overflow;
direction determines the over-constrained edge. Header margins collapse through
an unpadded/unbordered heading, and adjacent heading/panel margins collapse rather
than add. A collapsed grid still includes the content wrapper's padding, border
and margins. Its retained scroll subtree remains at natural height behind that
wrapper. The item paints a rounded background without clipping overflowing
children; the source header and grid wrapper keep their own clips.

The scroll regression then exposed an ordering race: SwiftUI can publish the
new viewport bounds before writing its final zero offset. Restoring inside that
notification was overwritten by the remaining resize work. Restoration now runs
after the current main-queue layout transaction, keeping the saved offset
protected until then. A deterministic native test applies the final framework
offset write after the bounds notification; ordinary user scrolling still
updates the retained offset after restoration. Both bridge branches use that
ordering, but only the macOS branch is compiled/executed here.

This is a focused styling checkpoint, not acceptance of arbitrary CSS layout,
all part/state combinations, native accessibility or production integration.
The follow-up reorder checkpoint adds mixed-sign three-way collapse (heading,
child header and following panel margins). All three original margins now share
one collapse operation, preserving the positive and negative extrema. The
expanded 192-case Web matrix passes 8,272 native checks.
The original failed 152-case run and its corrected rerun are preserved alongside
the extended matrix. Historical appearance/scroll checkpoint manifests retain
their original hashes; the new part checkpoint records the updated sources.

## Internal pointer reorder checkpoint

The retained Swift renderer now connects native grip input to the existing source
state model. Native item bounds are sampled once on pointer-down, siblings shift
against those targets, and release commits one `mdReorder` payload. Cancellation,
inert content, disabling/removing the dragged item and disabling reordering clear
the ghost without committing. A one-item grip consumes the click without toggling
its header. Lifting, cancelling and dropping retain the original native headers
and authored body state; a conditional clipping wrapper initially remounted that
subtree, and was removed after the retention regression exposed it.

Eight actual-Web references (light/dark, LTR/RTL, filled/outlined) cover before,
lifted, moved and dropped positions. **628 native checks** compare full item/root
and placeholder bounds, event timing/payload, commit order and cancellation. The
outlined ghost follows the source padding-box origin, including its extra border
offset. Source captures, native drag PNGs and logs are preserved in
`outputs/native-parity/md-accordion/native-reorder`. The Web harness dispatches
component-level PointerEvents; the native fixture dispatches NSEvents through the
host window. This is not a real iOS touch test.

Five parent drop-placeholder appearance hooks and two item dragging fill/shape
hooks are connected. Their full custom-style pixel matrix is still pending.
The new pointer path is **internal**, with important visual work remaining:
grip hover/press and header pointer suppression need verification;
sibling timing still needs the token-driven short3 duration and each preset's
curve (the default generated token is 150 ms, not the CSS fallback 200 ms).
Placeholder timing, custom themes, interrupted shifts and drop-part declarations
also require focused acceptance. Current drag geometry tests use `transition=none`.

## Lifted-item clipping

While lifted, the source item applies `overflow: hidden` with the dragging
radius (`--md-accordion-item-container-shape-dragging`, default 12px) and the
dragging fill. The native item now installs a permanent clip whose geometry
switches between an unbounded rectangle and the item's rounded padding box
(outer radius minus the outlined separator border), so lifting never replaces
the item subtree. The outlined separator is drawn as the source
`border-block-end`: square at rest, curved and tapering into the dragging radius
while lifted.

Evidence (`outputs/native-parity/md-accordion/native-lift/`): 32 Chrome DPR-1
captures (`lift.html`; default and custom dragging radius/fill/header tint ×
light/dark × LTR/RTL × filled/outlined × open/closed, drop placeholder hidden to
isolate the item clip) and **280/280** native checks. Each case compares the
lifted item's size, every corner "ear" (inside the border box, outside the
rounded padding box) and inner corner pixels with the source, verifies that the
custom header tint never paints outside the radius and fills the same inner
pixels, and that the lifted headline ink is present. Retained authored content
keeps its native view, state and interactivity through lift and drop without
remounting. A/B captures showed that a non-rectangular clip alone made
right-to-left header labels disappear on macOS; the subtree is flattened with
`compositingGroup()` before clipping. The full native view suite (all 30
fixtures) passes after the change. Floating chassis-handle clipping is not
exercised (floating renderer pending).

## Reorder motion (sibling shift and drop placeholder)

While an item is lifted its siblings carry `.md-accordion-item--shifting`
(`transform var(--md-sys-motion-duration-short3) var(--_state-easing)`: the
emphasized token for expressive/standard, the standard token for fade,
`cubic-bezier(0.4,0,0.2,1)` for collapse) and the placeholder glides with
`transform var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard)`.
`transition="none"` and reduced motion remove both; drop and cancellation snap.
The previous fixed 200 ms SwiftUI animation (additive on interruption) is
replaced by `AWCAccordionReorderMotion`, a CSS Transitions Level 1 track per
sibling and for the placeholder: retargets start from the current value and a
return to the reversing-adjusted start is shortened by
`|outputProgress·oldFactor + 1 − oldFactor|`.

Evidence (`outputs/native-parity/md-accordion/native-shift/`): Chrome
CSSTransition records and per-frame transform samples (`shift.html`, 5 presets ×
cross/reverse/extend/up, normal and `prefers-reduced-motion`), **15,240** checks
in the latest passing run. Replaying Chrome's own style-change times through the
native tracks reproduces every transition (count, from-value, duration including
shortened reversals ±0.01 ms, easing) and every sample (±0.05 px); snap cases
have no intermediate values. The real view, driven by NSEvents on the same
schedule, renders offsets inside its own track model on every sampled frame,
with matching end values, transition counts and internally consistent reversal
factors. Chrome starts the placeholder transition one frame after the siblings
(Stencil re-renders the placeholder on the next frame); this framework
scheduling artifact is not emulated and each transition is compared against its
own start time. Rendered reversal durations differ from Chrome only by the
frame at which the second pointer move lands (logged in `native-results.json`).

## Header and grip interaction states

Trusted-input Chrome reference (`states.html`, CDP mouse/keyboard; light/dark ×
expressive/none × hover-closed, hover-expanded, press, grip-hover, grip-drag,
focus, disabled; normal and reduced motion; fixture
`Tests/Fixtures/accordion-web-states.json`) measured: state layer hover .08,
focus-visible .12, active .12 on the effects transition (200 ms,
`cubic-bezier(0.34,0.8,0.34,1)`); the header md-ripple wave (450 ms grow,
150 ms release fade, animated even under reduced motion); grip hover opacity
.55→1 and colour → headline-color-expanded (effects) with scale 1.08 on the
preset spring; a grip press is a header `:active` (state layer .12 plus a ripple
from the press point) and, once lifted, `pointer-events: none` drops `:hover`
(grip scale returns to 1) while `:active` persists until release. Disabled
headers paint neither layer.

The native header now renders the shared md-ripple wave (`AWCNativeButtonRipple`,
with reduced motion not suppressing the accordion wave) under a CSS-transition
state layer, honours an embedding host's `AWCNativePointerState`, and the grip
(`AWCAccordionGrip`) reports presses to its header. The lifted-clipping oracle
was re-captured with trusted input so its corner/ink comparisons include that
press feedback (280/280).

Verification (`outputs/native-parity/md-accordion/native-states/`): **40,486/40,486**
checks over the 56 Chrome cases in the final full-suite run (`full-suite-final-5.log`).
Source timings (duration/easing per preset) equal the native timings; rendered
state-layer opacity and grip opacity/scale/colour are compared, at the time the
renderer produced them, with Chrome's rAF samples within two 60 Hz frames of
scheduling difference (before Chrome's first sample its own transition record
defines the value); disabled headers paint no layer. Hover is driven through the
embedding `AWCNativePointerState` path; offscreen AppKit tracking-area hover is
not exercised. Implementation findings: replacing views under a held grip cancels
its AppKit pointer capture, so these views keep a structure that depends only on
preset/reduced-motion timing; a paused TimelineView keeps its last frame when a
target changes without a transition, so instant timing renders targets directly;
SwiftUI may drop a second onChange in one frame, so a `task(id:)` reconciles the
settled target.

## Drop-placeholder paint

Chrome reference `placeholder.html` (24 cases: default, all five custom hooks
and a borderless solid style × light/dark × LTR/RTL × filled/outlined; the last
item is lifted far above so the top-slot placeholder is unobstructed). Native
now uses Blink's dashed intervals (3w/2w below 3px, 2w/w from 3px; it previously
used a fixed [6,4]), keeps the dash pattern physical under RTL, and applies the
placeholder opacity to the composited box. **320/320** checks: geometry, interior
fill, corner backdrop, dash count/length/period on every side and the top-side
dash phase (`outputs/native-parity/md-accordion/native-placeholder/`).
Open difference: after a rounded corner Chrome's per-side painting with corner
clip polygons places dashes at a different phase than native's single closed
centerline path (up to about one period); not accepted, listed for review.

## Floating panel (viewport placement, chassis grip, drag, stacking)

Chrome reference `floating.html` (1200×900 viewport, DPR 1, trusted CDP input):
32 paint cases (default and custom — all five parent floating hooks and both
item chassis-grip hooks — × light/dark × LTR/RTL × filled/outlined ×
closed/open); 16 chassis drags (default/custom × `expressive`/`none` × LTR/RTL ×
filled/outlined: hover, press, three moves, release, leave) with per-frame grip
width/opacity/colour, grip tint, panel shadow and position samples, a screenshot
per phase and the `mdDragStart/Move/End` payloads; bring-to-front stacking of
three panels (one with `bring-to-front` off); 300/200 px viewports.

Native (`AccordionFloating.swift`): `position: fixed` becomes a zero-footprint
placement at physical viewport coordinates — the nearest `awcAccordionViewport()`
or the window — with width `min(--md-accordion-floating-width ?? 360,
viewport − 16)`; panel surface, radius and overflow clip; resting→lifted
elevation on the spring-effects transition (instant for `none` and reduced
motion); flush filled items and a borderless outlined chassis; the chassis grip
(52×16 hit area 4 pt below the first item's top, 32×4 pill; hover 38/0.9 with a
10 % tint, press and panel drag 40/1 with a 16 % tint, primary while dragging,
on-secondary-container on an expanded item) on the spring/effects transitions; an
AppKit/UIKit capture emitting the drag events in viewport client coordinates.

**44,234/44,234** checks (`outputs/native-parity/md-accordion/native-floating/`):
panel, item, grip hit-area and pill geometry in every paint case and drag phase;
112 rendered paint comparisons over every flat pixel of the source clip (mean
difference ≤ 0.20/255, maximum 3/255; antialiased glyph edges excluded in either
image), rounded-corner ears inside/outside the radius (≤ 6.5/255 outside, pure
blurred shadow); about 400 rendered frames per drag for six properties, each at
its render time within Chrome's samples (±2 frames of scheduling; where Chrome
recorded no frame for more than two frames only the monotone envelope of its
neighbouring samples is used — screenshots between phases and one 383 ms gap in
`default-expressive-ltr-filled`); payloads to 0.01 px; source grip timings;
stacking order and paint order of overlapping panels; narrow viewports; leaving
and re-entering floating mode (flow slot, z-index reset, re-seeded position
without a raise).

Defects found and fixed:

- Pointing at the grip also hovered the header beneath it (8 % state layer);
  Chrome hovers only the grip, which sits above the header. The header's hover
  now excludes the grip's hit area (pointer-state and real-pointer paths).
- Load-time bring-to-front followed SwiftUI's sibling `onAppear` order (observed
  reversed). Panels connected in one pass now take their load values in render
  order, matching source `componentDidLoad` order; drag raises are untouched.
- Box shadows were too narrow: a `GraphicsContext` blur of radius r renders a
  Gaussian of standard deviation r/√2, while CSS blur b means b/2, so the radius
  is now b/√2 (was b/2: 0.71 of the source width, measured on blur 6 and 24).
  This affects every accordion shadow; all accordion fixtures re-pass.

Document stacking (gate-7 r3-19). `position: fixed` with `z-index` stacks against
the whole document, whereas SwiftUI `zIndex` (Compose `Modifier.zIndex`) orders the
children of one container. The panel therefore lifts the hosts above it (lift
chain, `StackingLift.swift` / `AWCStacking.kt`): it publishes its z-index, and every
AWC host on the way to the root takes the largest lifted z-index of its subtree as
its own order among its siblings. The panel paints, and is hit, above the later
siblings of each ancestor; no view moves, so component state, Tab order and the
accessibility tree are those of the document. Chrome oracle
`d3-lab/web2/stacking.mjs` (a panel declared in an earlier container over the
container that follows it, Tab order before / header / after), replayed by
`NativeStackingIntegration` and `NativeStackingTest`.
- Application containers between AWC components join with `awcStackingLift()`
  (SwiftUI) or `AWCStackingLift { }` (Compose). In SwiftUI a root-level AWC view
  leaves its `zIndex` to the application (stacked `zIndex` modifiers resolve
  innermost-first): root views that share a stack take `awcStackingLift(zIndex:)`.
- Mechanism 2 (story 9-4, 2026-11-16): the floating panel is published as an entry of the `AWCModalScope` overlay layer (SwiftUI: `AccordionFloating.swift`; Compose: `NativeAccordionFloating.kt` with `movableContentOf`), with a zero-size placeholder in the flow. An ancestor that clips no longer clips the panel (residual 1 closed), and the panel orders against open sheets and dialogs as in Chrome: above a bottom sheet's scrim, below a dialog (residual 2 closed). Chrome oracle `stacking2-web.json` (clip scene, bottom sheet, dialog), replayed by `NativeStackingOverlayIntegration` (macOS, iOS 26.3, iOS 18.6) and `NativeStackingOverlayTest` (Android); each failed on the previous sources (macOS 28/35, Android 0/1) and passes after the change (35/35, 35/35, 35/35, 1/1). Mechanism 1 (`NativeStackingIntegration`, `NativeStackingTest`) still passes.
- Open, listed for review: the document-order Tab tokens and the macOS accessibility re-parenting of the placeholder are not separately probed (tools/ax md-accordion: 0 open findings on macOS); residuals 3 (an ancestor rises as a whole) and 4 (`awcStackingLift(zIndex:)` on a root-level view) stay as the 3-1 record states and are re-tested by `NativeAccordionLiftIntegration` 280/280 and `NativeStackingIntegration` 12/12; the exception record above remains rejected for residuals 1 and 2 and is not re-proposed.

**Exception record proposal, r3-19 residuals (3-1, 2026-11-15; to be accepted or rejected by the gate-7 reviewer of story 7-8; not accepted yet).**
Decision of the coordinator (2026-11-15): mechanism 2 (viewport layer) is not built in story 3-1. Scope: the floating `md-accordion` panel only; the dragged `md-card` has no residual (it stays in its slot and is clipped by its scroll containers in Chrome too). The three paint criteria of r3-19 (panel above a later sibling container, card dragged over a later container, Tab / accessibility order unchanged) are met by mechanism 1 and are not part of this proposal.
- *Exact source behavior.* `md-accordion[floating]` panel: `position: fixed; z-index: 1000` (raised by bring-to-front). It leaves the flow, is not clipped by any ancestor (no ancestor has a transform/filter in the supported layouts), and stacks against the whole document: above page content, below the modal layer's sheets (z-index 1000/1001) and dialogs (top layer) when it was declared first, in z-index then document order otherwise.
- *Platform and API.* SwiftUI (macOS, iOS, iPadOS): `zIndex` and `clipped()`/scroll views order and clip within one container. Compose: `Modifier.zIndex` and `clip`/scroll containers do the same. Implementation: `StackingLift.swift`, `AWCStacking.kt` (lift chain, mechanism 1).
- *What differs (four residuals).* (1) An application container that clips (scroll view, `clipShape`, Compose `clip`) between the accordion and the root still clips the panel; Chrome does not. (2) The panel is ordered inside the modal layer's content, not by z-index against sheets and dialogs, so where a panel overlaps an open sheet or dialog the order can differ from Chrome. (3) Every AWC ancestor of the panel rises as a whole; its other content paints above later siblings too, visible only where in-flow content of that ancestor overlaps content that follows it. (4) SwiftUI only: a root-level AWC view leaves its `zIndex` to the application, so root views that share an application stack must take `awcStackingLift(zIndex:)` (Compose root hosts lift themselves).
- *Technical reason.* SwiftUI and Compose order and clip children of one container; neither has a viewport-level layer a live subtree can join without being re-created. SwiftUI re-creates a view that changes position (all `@State`, slotted text input, in-flight gestures and the original environment are lost); Compose `movableContentOf` keeps remembered state but re-attaches layout nodes and cancels a pointer gesture in progress. A card cannot be re-parented during its own drag at all. Design and rationale: `work/d3-lab/PROGRESS.md` "r3-19 design".
- *User-visible effect.* Only for a floating accordion panel whose app places the accordion inside a clipping container (1), opens a sheet or dialog over a visible panel (2), overlaps in-flow content of a lifted ancestor (3), or shares a root stack without the lift modifier (4). In the Laboratory and in the documented layouts (panel over a later sibling container, nested app containers without clipping) the panel paints and is hit as in Chrome. Tab order, accessibility order and state are unchanged in every case.
- *Tested native equivalent.* Mechanism 1: `NativeStackingIntegration` (Chrome oracle `d3-lab/web2/stacking.mjs`: panel in an earlier container over a later one, card dragged over a later container, Tab order before / header / after, `floating` toggled with an expanded item) macOS 12/12 and iOS 26.3 11/11; `NativeStackingTest` on Android (3-1-A003, 3-1-A006 ok); accordion floating 47648/47648, card lifecycle, modal stack 149/149, container AX 22/22 on macOS (install `3-1-007-install-batch3`). The four residuals are the behavior that is not tested against Chrome; the reviewer may ask for pinned probes.
- *Alternative considered and its cost.* Mechanism 2: publish the panel as an entry of the `AWCModalScope` overlay with a zero-size placeholder that re-publishes the document-order tokens, macOS accessibility re-parenting, and on Compose `movableContentOf` with a focus-group placeholder. It removes residuals 1 and 2. Cost: rewires the modal scope, preferences, focus and macOS AX on both platforms; touches shared files (`ModalScope.swift`, `ContainerAccessibility`, `AWCComponent.kt`); needs failing-first tests on three platforms and a regression pass over modal, dialog, sheet, accordion and container-AX suites (estimated one dedicated story). Alternative rejected: re-parenting without a placeholder (loses state and Tab order). Residual 3 is not removed by mechanism 2 for the card chain; residual 4 stays an application-facing API.
- *Reviewer and acceptance.* Reviewer: gate-7 story 7-8. Acceptance: pending. If rejected, mechanism 2 becomes its own story (design above).

Not executed: UIKit touch capture (no iOS SDK) and pointer cancellation in a
rendered host.

## Laboratory integration (2026-10-23)

Production dispatch is on: `AWCNativeView` renders `md-accordion` with
`AWCNativeAccordionGroup` and a standalone `md-accordion-item` with
`AWCNativeAccordionStandaloneItem` (unowned: `index` −1, its own retained state).
The earlier adapter (`Containers.swift` `accordion`/`accordionExpanded`) was removed.
The native sample now matches the Laboratory recipe (two items, the first expanded).

- Support policy (`NativeSupport.json`, mirrored in Android `support.json`): all 15/10
  properties, 5/3 events, the item methods `toggle`/`focusHeader`, the default and
  three named slots, eleven typed item parts and 14/24 appearance fields
  (`.awcAccordionAppearance` / `.awcAccordionItemAppearance`). The chassis grip
  parts and the group's drop placeholder are styled through appearance hooks. Notes
  state only the measured differences: SwiftUI-local z-index, the
  `awcAccordionViewport()` stand-in for the CSS fixed-position viewport and the open
  placeholder's side-dash phase.
- Laboratory studio: `accordion-appearance.js` covers exactly the source custom
  properties (asserted against the component CSS, IR and both policies), Styles
  panels on Web/iOS/Android, retained property updates for every property, item
  method commands, pointer drags, and copyable HTML/React/Angular/Vue/Svelte/SwiftUI/Compose
  usage. A floating accordion copies with its viewport.
- Live hosts: LiveRenderer and SnapshotRenderer decode and apply both appearances and
  the item controller; floating mode is hosted in `awcAccordionViewport()`.
  `test-live-accordion.mjs`: 24/24 checks (appearance, pointer toggle, retained
  updates incl. exclusive collapse, floating drag events and placement, item methods).
- Examples: 81 generated public SwiftUI examples (both tags: usage, theme, all
  properties and hooks, every event/method/slot/part) typecheck against AWCUI
  (`swiftc -typecheck`, macOS arm64); the same 81 Compose examples compile.
- Full native view suite after the dispatch change: unfiltered `test-native-views.sh` exit 0 in 957 s, 34 fixtures, 126,926 checks, no failures (the known FAB Menu flake did not occur); live hosts: Accordion 24/24, Tooltip 42/42, Snackbar 51/51. `test-live-preview.mjs` fails at a toggle button's keyboard Enter; the session-start LiveRenderer fails identically, so it predates this work.

Evidence: `outputs/native-parity/md-accordion/laboratory` (`checkpoint.json`,
`results.json`, `examples/`, studio/live/full-suite logs).

## Remaining before acceptance

Required work includes:

- The parent drop-placeholder part and the two item chassis-handle parts as
  native part-appearance surfaces. Fourteen parent and twenty-four item hooks are
  connected (the floating and chassis-grip hooks checked against Chrome), but the
  complete appearance contract is not accepted. Exact blurred-shadow raster profiles, small-radius/spread edge
  cases, variable-font animation/slot combinations and complete custom-theme
  matrices remain pending.
- Remaining valid CSS length forms (for example viewport/container units),
  comparison-function edge cases, percentage caps during animated/interrupted
  disclosure, dynamic authored size/font contexts, pointer-wheel boundary
  propagation and platform assistive scrolling. The default cap, retention and
  keyboard path are implemented and checked on macOS.
- Pointer reorder, lifted clipping, reorder motion, interaction states,
  drop-placeholder paint and the floating panel are verified on macOS (now through
  the production dispatch); UIKit touch paths are not executed.
- Full native heading/region/label relationships and assistive-technology
  execution. Inspection metadata is not a substitute for native accessibility.
- Additional slot composition, ownership-transfer, native lifecycle, interrupted
  motion, forced-color and custom-theme acceptance, followed by the full source
  geometry/paint matrix rather than only default-style cases.
- Real iOS compilation/execution and the separate final per-component audit. (The
  Compose renderer, both Laboratory integration paths, matching controls and the
  compiled examples are done.)

The available Swift toolchain executes macOS/AppKit. UIKit branches have been
authored but cannot be counted as verified iOS behavior without an iOS SDK and
runtime. See [native state/motion](md-accordion-native-state.md) and the
[source review](md-accordion-source-review.md) for the unchanged complete contract.
