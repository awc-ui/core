# md-stepper native checkpoint

Status: **gates 2–3 and accessibility verified on macOS SwiftUI, the iOS simulator and the Android emulator** against
Mac Chrome 153 oracles (2026-10-30), for `md-stepper` and its child `md-step`; gate-7 fixes (typed parts, rendered views,
duration-hook runs) verified 2026-11-11. Independent final audit pending.
Source contract: [md-stepper-source-review.md](md-stepper-source-review.md); plan: [md-stepper-native-plan.md](md-stepper-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Stepper / step nodes (`AWCNativeView` / `AWCComponent`) | dedicated renderers (`Stepper/NativeStepper.swift`, model + layout in `StepperModel.swift`, `StepperLayout.swift`) | dedicated renderers (`NativeStepper.kt`, `stepper/StepperModel.kt`, `StepperLayout.kt`, `StepperMeasure.kt`) |
| Hooks: 23 stepper + 22 step (`--md-stepper-*`, `--md-step-*`, including the connector / expand / collapse durations) | `AWCStepperAppearance` + `.awcStepperAppearance(_:)`; a step's own `style` hooks win for that step | `AWCStepperAppearance` + `AWCStepperAppearanceScope`; same per-step rule |
| `next()`, `prev()`, `goTo(index)`, `reset()` | `AWCStepperController` + `.awcStepperController(_:)` | `AWCStepperController` + `AWCStepperControllerScope` |
| Parts — md-stepper: `list`, `content`, `nav`, `mobile-nav`; md-step: `bubble`, `dot`, `state-layer`, `label`, `optional`, `description`, `connector`, `connector-trailing`, `content`, `actions` | `AWCStepperPart` / `AWCStepPart` + `.awcStepperPartAppearance(_:part:)` / `.awcStepPartAppearance(_:part:)` (`Stepper/StepperParts.swift`) | `AWCStepperPart` / `AWCStepPart` + `AWCStepperPartAppearanceScope` / `AWCStepPartAppearanceScope` (`StepperParts.kt`) |
| Reduced motion / settled rendering | `.environment(\.awcStepperReducedMotion, _)`, `\.awcStepperSettled` (snapshots) | `AWCStepperReducedMotionScope`, `AWCStepperSettledScope` |

Behaviour mirrors the source: horizontal row (shared `content` slot or per-step panels), vertical rail with per-step
panels and Back / Continue / Finish, mobile bar (dots or "Step N of M"), numbered / dot indicators, completed / error /
optional / editable / disabled steps, density 0…-4, RTL, the compact horizontal row below 600 px of screen width, linear
and non-linear reachability, auto-complete, the cancelable `mdBeforeChange` then `mdStepChange` (plus `mdStepClick`,
`mdStepNext`, `mdStepBack` on the step and `mdComplete`), lazy panels, the polite / assertive announcements, and the
motion: connector fill (350 ms), panel expand / collapse (500 / 200 ms, spatial / accelerate), state layers, glyph-in
(500 ms), lazy content-enter, the staggered md-step-enter (index × 40 ms) and the error pulse; none of the keyframes under
reduced motion. The built-in Back / Continue are native md-buttons whose own mdClick stays internal.

## Evidence

Oracles (`outputs/native-parity/md-stepper/web-oracle/`, Chrome 153, DPR 1, trusted input): `web-paint.json` 142 cases,
`web-states.json` 20 runs, `web-states-reduced.json` 20 runs, and fa's `web-paint-extra.json` 6 cases (a step's own hooks
and density, horizontal and vertical; fa-059). Gate 1 recheck against the cloud Chrome 141 capture: paint 142/142 and
reduced 20/20 identical; states differ only in nested md-button / md-ripple animation records (classified
"nested-component-anims"; `gate1-mac-vs-cloud.json`). The Android assets are gzip copies verified byte-identical after
gunzip in every Android job; Swift reads the same files.

| Run | Result |
| --- | --- |
| macOS SwiftUI `NativeStepperIntegration` (paint 142 + extra 6, states 20, reduced 20, density rungs) | 189/189 (fa-063) |
| iOS simulator AWC-fa (iPhone 17 Pro, iOS 26.3.1) | 189/189 (fa-063) |
| iOS gate-6 runtimes (r6) | iPhone 17 Pro iOS 26.3 (fa-063, fa-064), iPad Pro 11-inch (M5) iOS 26.3 and iPhone 16 Pro iOS 18.6 (r6-011, `work/audit/r6/out/ios-ipad/`, `ios-ios18/`): all pass |
| Android emulator-5556 `StepperParityTest` paint + extra / states / reduced | 142/142 + 6/6 · 20/20 · 20/20 (fa-A030) |
| Android `StepperViewsTest` (renders, semantics, navigation and focus, methods, host updates, lifecycle) | 93/93 (fa-A030; fa-A044) |
| Gate 7: `web-paint-extra2.json` (9 cases: `::part()` rules on md-stepper and md-step) — macOS "paint (extra2)" / Android | 9/9 · 9/9 (fa-089, fa-A044) |
| Gate 7 (R6-11): `web-states-extra.json` / `-reduced` (4 runs each: `--md-step-connector-duration`, `-expand-duration`, `-collapse-duration`) — macOS / Android | 4/4 + 4/4 · 4/4 + 4/4 (fa-089, fa-A044) |
| Gate 7: all suites on the final sources — macOS `NativeStepperIntegration` / Android `StepperParityTest` / iOS simulator | 206/206 (paint 142 + 6 + 9, states 20 + 20 + 4 + 4, density rungs) (fa-089) · paint 142 + 6 + 9, states 20 + 20 + 4 + 4 (fa-A044) · iOS 206/206 on AWC-fa iPhone 17 Pro, iOS 26.3 (fa-092) |
| Gate 7 (R6-07): iOS gate-6 runtimes on the final sources — `NativeStepperIntegration` | iPhone 17 Pro · iOS 26.3 **206/206** (fa-092) · iPad Pro 11-inch (M5) · iOS 26.3 **206/206** (fa-094) · iPhone 16 Pro · iOS 18.6 **206/206** (fa-094) |
| Gate 7 (R6-05): rendered views against the Chrome shots — macOS `NativeFaViewsIntegration` | paint 140/140 · extra 6/6 · extra2 9/9 (fa-089; 2 focus-visible cases are runtime states) |
| Gate 7 (R6-05): rendered views — Android `FaViewsParityTest` | paint 140/140 · extra 6/6 · extra2 9/9 (fa-A044) |
| Gate 7 (R6-05): rendered views — iOS harness | paint 140/140 · extra 6/6 · extra2 9/9 on iPad Pro 11-inch (M5) · iOS 26.3 (fa-087) and iPad Pro 11-inch (M4) · iOS 18.6 (fa-095) — iPads: the view reads the screen width for the compact row, and a ≥ 600 pt device matches the 1200 px oracle viewport |

States runs compare every sampled frame (positions, sizes, colours, opacities, connector fill, panel rows) and each
phase's keyframe-animation starts with Chrome's `anims` in the same window.

## Laboratory (gate 3)

- **Styles panel:** the 23 stepper hooks on the stepper page, the 22 step hooks on the step page (`stepper-appearance.js`).
- **Properties:** retained updates for every stepper property (orientation, indicator, variant, mode, active, the words,
  labels, density, …) and step property.
- **Methods:** `next()`, `prev()`, `goTo(index)`, `reset()` through `AWCStepperController` on both live hosts, events
  returned.
- **Parts:** 4 stepper + 10 step visual parts (`visualParts`) with a copyable typed example each.
- **Examples:** the copyable examples (46 per platform with md-slider, md-rating, md-step: usage, theme, copied default,
  hooks, hook defaults, a variant, every method, event and slot) typecheck as SwiftUI (fa-063) and compile as Compose in
  the androidTest source set (fa-A029, fa-A030).

| Run | Result |
| --- | --- |
| Studio `stepper-integration.test.mjs` / all studio suites | 4/4 · 783/786, 0 new failures (the 3 failures predate fa) (fa-063) |
| SwiftUI live host `test-live-stepper.mjs` / snapshot `test-snapshot-stepper.mjs` | 38/38 · 6/6 (fa-063, fa-064) |
| Android `LivePreviewStepperHostTest` (hooks, retained updates, the four methods; standalone step) | 2/2 (fa-A029, fa-A030) |
| Live-host regression (all other live hosts) | all pass (fa-063) |

## Accessibility (tools/ax)

Cases `horizontal`, `vertical`, `dot-nonlinear`, `mobile`, `readonly` (md-stepper) and `standalone` (md-step): **0 open
findings on macOS, iOS and Android** (fa-064, fa-A030, fa-A031), from 41 + 2 at the first run (fa-059). Fixed on the way:
source reading order (header, its panel, next header), descriptions as static text (not repeated in readonly), readonly
label / captions as separate lines, hidden panels out of the accessibility tree and the key-view loop, the built-in
buttons' state on the first frame (SwiftUI), Expanded / Collapsed on every panel header and live regions described only
while they speak (Compose). Reviewed expectations: decisions 9 (phone-width captions), 16 (navigation landmark), 17
(panels as named groups), 18 (Chrome's intermittent panel text), plus iOS targets below 44 pt reported as information.

- Headers are buttons named like the source ("Step 1 of 3: Account, current"), disabled when unreachable, expanded /
  collapsed with a panel; Back / Continue follow; Tab order matches Web.
- macOS: the stepper is the AXGroup named by `label`; iOS a labelled container; Android a traversal group.

## Parts (typed native part appearance, R6-03)

`.awcStepperPartAppearance(_:part:)` / `.awcStepPartAppearance(_:part:)` (SwiftUI) and `AWCStepperPartAppearanceScope` /
`AWCStepPartAppearanceScope` (Compose) with the shared `AWCAccordionPartAppearance` fields; a step part declared on the
stepper (or any container of steps) applies to every step below it. Metric fields feed the layout (so boxes move as in
CSS), colour fields the painted result; semantics measured in Mac Chrome with the same `::part(…)` rules
(`web-paint-extra2.json`):

| Part | Fields | Source semantics |
| --- | --- | --- |
| md-stepper `list` | backgroundColor | the header row / rail box |
| md-stepper `content` | backgroundColor, padding | the slotted content's box; a top padding stops the slotted child's margin collapsing through it |
| md-stepper `nav`, `mobile-nav` | backgroundColor, padding | the Back / Continue row (flex-end at the padding edge) and the mobile bar |
| md-step `bubble`, `dot` | backgroundColor, color, cornerShape | the indicator (its halo follows the radius) |
| md-step `state-layer` | backgroundColor | the hover / focus / press layer |
| md-step `label`, `optional`, `description` | color, fontSize, fontWeight, lineHeight, letterSpacing | the text lines (their metrics move the header) |
| md-step `connector`, `connector-trailing` | backgroundColor | the connector line |
| md-step `content` | backgroundColor, padding | the panel box; padding outside the animated grid track |
| md-step `actions` | gap | the vertical Back / Continue row |

Wrapper parts (story 5-3, typed `AWCAccordionPartAppearance` boxes: backgroundColor, border, radius, padding with layout shift;
content-box sizes, physical padding swapped in RTL): md-stepper `mobile-progress`; md-step `inner`, `indicator`, `text`,
`connector-leading` (`display: none` in the source in both orientations: accepted, no visible effect, Chrome case
`box-step-connector-leading` passes). The part padding replaces the source's own; the connector and panel offsets stay as Chrome
(the connector top is independent of the inner padding). Evidence: web-paint-extra2 25/25 (16 new box and slotted-text cases) on
macOS, the iOS simulator and Android, the rendered views (R6-05), one copyable typed example per part in the Laboratory.

## Gate 7 (reviewer r6, 2026-10-31; fixes 2026-11-11)

- R6-03 parts: typed part appearance for 4 stepper and 10 step parts (section above) — FIXED, awaiting re-check.
- R6-05 rendered views measured against the oracles: every paint case is rendered by the view itself at Chrome's host box and compared with the Chrome shot: the rendered host box (the view's own inspection node / layout bounds, ±0.75 px), every flat CSS pixel of the clip (3 × 3 flat in both images, limit 6: mean ≤ 1.0 and ≤ 0.5 % over 6) and every ink pixel (off the page background; Chrome ink covered by native ink within 1 px and vice versa, ≥ 0.97) — boxes, colours, the slot, the native md-buttons and the placement of every text run and glyph.
  macOS 140/140 + 6/6 + 9/9, Android 140/140 + 6/6 + 9/9; iOS: paint 140/140 · extra 6/6 · extra2 9/9 on iPad Pro 11-inch (M5) · iOS 26.3 (fa-087) and iPad Pro 11-inch (M4) · iOS 18.6 (fa-095) — iPads: the view reads the screen width for the compact row, and a ≥ 600 pt device matches the 1200 px oracle viewport. Found and fixed by it: panels, the
  vertical Back / Continue row and the slotted content flowed left-to-right in RTL (both platforms); a vertical RTL step's
  text lines ended at the column's left edge; the optional caption's oblique. The mobile stepper's slotted content keeps its
  collapsed 24 px top margin as leading space inside the native frame (the host box starts below it).
- R6-06 `NativeStepperIntegration` registered in `test-native-views.sh`.
- R6-07 iOS runtimes: the three gate-6 runtimes on the final sources (rows above).
- R6-11 duration hooks (`--md-step-connector-duration`, `-expand-duration`, `-collapse-duration`): motion runs
  `web-states-extra.json` + reduced (the connector fill and the panel rows sampled per frame) on macOS, the iOS simulator and Android — FIXED.
- R6-13 macOS navigation landmark (decision 16): FIXED (story 5-3) with construction (B) of the probe `work/fa-lab/stepper/probe/LandmarkProbe.swift`
  (fa-085, fa-090): `AWCNestedLandmark` (NativeInspection.swift) puts the stepper content in an `NSHostingController` inside an AppKit container
  (role group, subrole `AXLandmarkNavigation`, the label); environment, layout direction, sizing and inspection pass through. tools/ax:
  landmark present, md-step 0 open, md-stepper only the four `controls` relations (coordinator patch).
- R6-14 CEM drift (`--md-stepper-step-count`, `--md-step-idx` listed as hooks): fixed with the other owners (d6).
- R6-15 decision 18: md-step source fix measured (fa-071 / fa-072: the header ripple is not the whole cause); open, Web source (shared with d6).
- R2-D10 Laboratory: a standalone md-step renders no panel (source), so its default slot is not a native previewable text slot (LivePreviewSlots.kt).

## Decisions (autonomous, 2026-10-27, reversible)

Taken by fa without a product review. The native renderers keep the Web source's behaviour as Chrome 153 records it (the
oracles stay the reference); each entry names the alternative and how to revert. Reverting a parity decision makes the
listed oracle cases fail on purpose: change the source first (test-first), recapture, then the native model.

1. **An initial `active` > 0 does not complete earlier steps** (their connectors still draw filled). Native reproduces it
   (paint `matrix-*`). Alternative: complete on first load, or draw connectors from the completed state. Revert:
   `StepperModel.sync` (first sync) / the connector fill in `StepperLayout`.
2. **Linear `next()` with `auto-complete="false"` does not require the current step to be completed.** Native = Web.
   Alternative: gate `next()` like header / `goTo()` reachability. Revert: `StepperModel.next`.
3. **Non-linear forward jumps auto-complete the skipped steps** (`nonlinear-header-clicks`). Native = Web. Alternative:
   complete only the step left. Revert: `StepperModel.setActive` (auto-complete loop).
4. **Space acts on keydown on a step header.** Native activates on keydown (AWC focus bridge / Compose key handler), as Web.
   Alternative: native buttons' keyup. Revert: the header key handlers.
5. **`aria-current` on both the listitem and the header; `aria-disabled` on the listitem.** Native exposes one element per
   step — the header button, its name ending "current" (and "… disabled" through the control state); the listitem has no
   native element. Alternative: a container per step carrying the state. Revert: the header semantics in the views.
6. **`reset()` emits mdStepChange without mdBeforeChange** (cannot be vetoed). Native = Web. Revert: `StepperModel.reset`.
7. **Changing `error-text` while `error` stays true is not announced.** Native = Web (only an `error` toggle announces).
   Revert: `StepperModel.sync` / `setStepError`.
8. **Connector origin in RTL.** The source uses `:host-context([dir=rtl])` (Chromium-only); native follows the stepper's
   direction everywhere, as Chrome. Alternative: the step's own `dir` only (Safari / Firefox). Nothing to revert.
9. **The compact rule means the layout viewport width** (story 9-12, s7-5-01). Web source: `md-step.css:608`
   `@media (max-width: 599px)` — a viewport media query, not a container query (nothing in md-stepper.tsx / md-step.tsx
   measures a width; `variant="mobile"` is a separate property). Native: the width is an input, the environment value
   `awcViewportWidth` (`EnvironmentValues`, `NativeStepper.swift`). Not set: the hosting width — on iOS the width of the
   window scene the view lives in (split view and Stage Manager included), on macOS 1200 (a window is not a viewport);
   Android reads `LocalConfiguration.screenWidthDp` (the window's width; the fixture sets `Configuration.screenWidthDp`).
   The views fixtures set the value to the oracle case's `viewport` (1200 for the 140+6+25 desktop cases, 390 / 599 / 600
   for `web-paint-compact.json`). Before 9-12 iOS read `UIScreen.main.bounds` (402 pt on an iPhone), so the phone showed
   the compact row where the 1200 px oracle shows the full one (88 cases). Alternative: the stepper's container width.
   Revert: `viewportWidth` in the views' layout input. On a phone the compact horizontal row hides the supporting captions, so
   tools/ax (Web captured at desktop width) records them as an expected text-missing on iOS / Android.
10. **A standalone md-step** renders like the source with its data-* defaults (first, horizontal, shared panel: no panel),
    named "Step 1 of 0" (data-total absent) and active from its own `active`. Alternative: hide the index. Revert:
    `standalone` in the model and views.
11. **Per-step hooks.** `--md-step-*` set in one step's `style` win over the stepper's for that step (the CSS cascade);
    verified against Chrome by fa's extra paint capture (`web-paint-extra.json`, per-step hooks and a step's density).
12. **Live regions.** The polite (role=status) and assertive (role=alert) texts become announcements (SwiftUI
    `AccessibilityNotification.Announcement`, high priority for the alert; Compose live regions Polite / Assertive), as for
    the other components (accessibility.md decision 1).
13. **The built-in Back / Continue / Finish** are native md-buttons; their own mdClick stays internal, as the source stops it.
14. **Settled rendering for snapshots.** The snapshot renderer draws steppers settled (`awcStepperSettled` /
    `AWCStepperSettledScope`): the staggered md-step-enter would otherwise leave a still frame transparent. Live views run
    every transition and keyframe animation. Revert: `.environment(\.awcStepperSettled, true)` in the snapshot hooks.
15. **English defaults** ("Progress", "Step", "of", "completed", "current", "error", "Optional", "Continue", "Back",
    "Finish") unless the word properties are set. Native = Web.
16. **The navigation landmark.** Web wraps the stepper in `<nav aria-label=label>`. macOS: SwiftUI cannot set the
    `AXLandmarkNavigation` subrole on a container, so the stepper is the AXGroup named by `label` holding headers, panels and
    Back / Continue in source order; iOS: a labelled `.contain` container (UIKit has landmarks only as container types);
    Android: a traversal group with the label as contentDescription. Recorded as tools/ax expectations (macOS role, iOS /
    Android missing, Android label text). R6-13 (built, story 5-3): the stepper's content in its own
    `NSHostingView` inside an AppKit container whose element is the landmark (role group, subrole `AXLandmarkNavigation`,
    the label) — probe fa-085, fa-090, `work/fa-lab/stepper/probe/LandmarkProbe.swift`: Chrome's tree without duplicates, and
    the content's preferences still reach the outer view; SwiftUI's own container node takes no subrole and a landmark
    element behind the SwiftUI container duplicates every element. Built: environment pass-through, the nested host's
    sizing, the inspection coordinate space, an explicit layout direction (the nested host's own environment reports LTR on
    updates), no fade on the nested panel (a faded panel is dropped from the nested AX tree). The four md-stepper macOS landmark
    entries are removed from tools/ax/expectations.mjs. Revert: `AWCNativeStepper` back to the old container (backup
    `work/fa-lab/s53/NativeStepper.before-landmark.swift`) and restore the expectations.
17. **Panels are named groups.** A step panel (Web `role=region`, named by the step label) is a named AXGroup on macOS, a
    labelled container on iOS and in-place content on Android. tools/ax reads a named macOS group with no controls as its
    words, so a text-only panel is reported "missing region", its name becomes a word on macOS (readonly "Account"), and in
    the readonly case (no header buttons) the Web region pairs with the stepper group; all recorded as expectations.
    Revert: the md-stepper region / readonly entries in expectations.mjs.
18. **Open panel text on Web.** Chrome 153 intermittently leaves an open panel's slotted content out of its accessibility
    tree (an ignored slot without children) although it paints it and exposes the region and its buttons — the
    md-accordion-item behaviour fa-051 fixed in the source (ripple created after the first render); the same case includes
    the text on other runs (fa-063 vs fa-064). Natives always expose the visible content (tools/ax expectation on that
    text-extra; to report to the md-step source owner). Alternative: hide panel content from assistive technology to
    match — rejected. Revert: the md-stepper text-extra entry in expectations.mjs.
19. **tools/ax word match.** A Web region / status that a platform does not expose is satisfied by a word of a native
    name; the comparison now ignores a trailing `,;:.` on that word ("Step 1 of 3: Account, current" carries the region
    "Account"). Only reduces false text-missing findings; no other comparison changes. Revert: the `bare` helper in
    `tools/ax/compare.mjs` (lab-patch-stepper.py `replace`).

20. **Slotted text direction (shared `#text` node).** Under `dir=rtl` Chrome resolves a slotted text's trailing punctuation at the
    element's base direction ("text." shows ".text"); SwiftUI's `Text` takes the paragraph direction from the first strong
    character. `awcBidiParagraph` (AWCNativeView.swift) prefixes the layout direction's invisible mark (RLM / LRM) and the node
    keeps the plain text as its accessibility label. Test-first: the rendered-views stepper cases `slotted-text-rtl` and
    `-rtl-vertical` (ink within 1 px, limit 0.99, through the production `#text` node) fail 492/494 without it, 494/494 with it
    (jobs 5-3-...-047-rtltest). Android has no shared text node (slotted text is the host's Compose Text). Revert: the `#text`
    case in AWCNativeView.swift back to `Text(s("text"))`.

## Installation

Gate-7 fixes installed by fa-098 (2026-11-11; see md-slider). First installed in the canonical tree through the main queue by fa-065 (2026-10-30): renderers and dispatch, the Swift
fixtures (`packages/native-ios/Tests/Fixtures/{slider,rating,stepper}-web-oracle/`, byte-identical copies of the
oracles) and the Android assets (`androidTest/assets/{sr,stepper}/`, gzip, verified identical after gunzip), the
Laboratory integration (lab-patch-sr.py, lab-patch-stepper.py), tools/ax cases and expectations, this document and the
AUDIT row. The install was applied to a dry copy first (aborting before canonical on any pre-image mismatch), every
changed file was compared byte for byte with that copy, and a backup allowed a rollback. Verified on canonical in the same
job: AWCUI build, macOS parity, studio suites (no new failures), compiler, playground build, live and snapshot hosts,
SwiftUI examples, Android compile, Laboratory APK on emulator-5554, the 4177 server restarted and probed, tools/ax.

## Remaining

The reviewer's re-check of the gate-7 fixes; R6-13 (landmark) and R6-15 (Web source). To report to the md-step source owner: decision 18 (the open panel's slotted text is
intermittently missing from Chrome's accessibility tree, as md-accordion-item's was).
