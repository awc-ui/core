# md-stepper native checkpoint

Status: **gates 2–3 and accessibility verified on macOS SwiftUI, the iOS simulator and the Android emulator** against
Mac Chrome 153 oracles (2026-10-30), for `md-stepper` and its child `md-step`. Independent final audit pending.
Source contract: [md-stepper-source-review.md](md-stepper-source-review.md); plan: [md-stepper-native-plan.md](md-stepper-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Stepper / step nodes (`AWCNativeView` / `AWCComponent`) | dedicated renderers (`Stepper/NativeStepper.swift`, model + layout in `StepperModel.swift`, `StepperLayout.swift`) | dedicated renderers (`NativeStepper.kt`, `stepper/StepperModel.kt`, `StepperLayout.kt`, `StepperMeasure.kt`) |
| Hooks: 23 stepper + 22 step (`--md-stepper-*`, `--md-step-*`, including the connector / expand / collapse durations) | `AWCStepperAppearance` + `.awcStepperAppearance(_:)`; a step's own `style` hooks win for that step | `AWCStepperAppearance` + `AWCStepperAppearanceScope`; same per-step rule |
| `next()`, `prev()`, `goTo(index)`, `reset()` | `AWCStepperController` + `.awcStepperController(_:)` | `AWCStepperController` + `AWCStepperControllerScope` |
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
| Android `StepperViewsTest` (renders, semantics, navigation and focus, methods, host updates, lifecycle) | 93/93 (fa-A030) |

States runs compare every sampled frame (positions, sizes, colours, opacities, connector fill, panel rows) and each
phase's keyframe-animation starts with Chrome's `anims` in the same window.

## Laboratory (gate 3)

- **Styles panel:** the 23 stepper hooks on the stepper page, the 22 step hooks on the step page (`stepper-appearance.js`).
- **Properties:** retained updates for every stepper property (orientation, indicator, variant, mode, active, the words,
  labels, density, …) and step property.
- **Methods:** `next()`, `prev()`, `goTo(index)`, `reset()` through `AWCStepperController` on both live hosts, events
  returned.
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

## Exception proposed: part selectors

| Field | Record |
| --- | --- |
| Scope | author `::part()` rules on the component's shadow parts; the parts' own styling and their CSS custom properties are implemented |
| Exact source behaviour | Shadow-DOM nodes carry `part` attributes: md-stepper: `list`, `content`, `nav`, `mobile-nav`, `mobile-progress`; md-step: `inner`, `indicator`, `bubble`, `dot`, `state-layer`, `text`, `label`, `optional`, `description`, `connector`, `connector-leading`, `connector-trailing`, `content`, `actions` (`md-stepper.tsx`, `md-step.tsx`); page CSS can restyle any of them with `md-stepper::part(<name>)` rules. |
| Affected platforms and API | macOS SwiftUI, iOS SwiftUI, Android Compose — `AWCStepperAppearance` (`.awcStepperAppearance(_:)` / `AWCStepperAppearanceScope`), 23 stepper + 22 step typed hooks, a step's own `style` hooks, theme tokens. |
| Technical reason | `::part()` is CSS selector syntax over a shadow tree; SwiftUI and Compose have no stylesheet, shadow DOM or selector matching (AUDIT.md: CSS selector syntax is a browser-only facility). |
| User impact | Arbitrary per-part CSS cannot be applied natively; apps restyle through the typed hooks (every `--md-*` property the stylesheet reads). |
| Tested native equivalent | The stylesheet's styling of every part is reproduced (paint 142 + 6 / states 20 + 20 against Chrome); each custom property it reads is a typed hook with subtree defaults and local values (Laboratory styles panel, live hosts). |
| Alternative | A typed part surface (as md-avatar / md-list / md-card) is implementable if the reviewer rejects this record. |
| Evidence | `outputs/native-parity/md-stepper/checkpoint.json`, `web-oracle/`, this document's Evidence section |
| Reviewer | gate-7 reviewer r6 (R6-03) |
| Acceptance | **NOT ACCEPTED — proposed; needs the reviewer's explicit acceptance (AUDIT.md exception policy)** |

## Gate 7 (reviewer r6, 2026-10-31)

- R6-03 parts: exception proposed below.
- R6-05 rendered views measured against the oracles: in progress.
- R6-06 `NativeStepperIntegration` registered in `test-native-views.sh`.
- R6-07 iOS runtimes: rows above.
- R6-11 duration hooks (`--md-step-connector-duration`, `-expand-duration`, `-collapse-duration`): motion oracle cases in progress.
- R6-13 macOS navigation landmark (decision 16): an AppKit landmark container that keeps the panels' content is being implemented / probed.
- R6-14 CEM drift (`--md-stepper-step-count`, `--md-step-idx` listed as hooks): source annotation + CEM regeneration with the other owners.
- R6-15 decision 18: md-step source fix (as fa-051 for md-accordion-item) to be proposed test-first.
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
9. **The compact rule (`@media (max-width: 599px)`) uses the screen width** — iOS `UIScreen` bounds, Android
   `screenWidthDp`, macOS 1200 (a window is not a viewport). Alternative: the stepper's container width. Revert:
   `viewportWidth` in the views' layout input. On a phone the compact horizontal row hides the supporting captions, so
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
    Android missing, Android label text). Alternative: the AppKit landmark bridge of md-breadcrumbs / md-navigation-bar —
    rejected because it re-hosts only focus elements and would drop the panels' light-DOM content. Revert: delete the
    md-stepper landmark entries from tools/ax/expectations.mjs and add a bridge in `NativeStepper.swift`.
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

## Installation

Installed in the canonical tree through the main queue by fa-065 (2026-10-30): renderers and dispatch, the Swift
fixtures (`packages/native-ios/Tests/Fixtures/{slider,rating,stepper}-web-oracle/`, byte-identical copies of the
oracles) and the Android assets (`androidTest/assets/{sr,stepper}/`, gzip, verified identical after gunzip), the
Laboratory integration (lab-patch-sr.py, lab-patch-stepper.py), tools/ax cases and expectations, this document and the
AUDIT row. The install was applied to a dry copy first (aborting before canonical on any pre-image mismatch), every
changed file was compared byte for byte with that copy, and a backup allowed a rollback. Verified on canonical in the same
job: AWCUI build, macOS parity, studio suites (no new failures), compiler, playground build, live and snapshot hosts,
SwiftUI examples, Android compile, Laboratory APK on emulator-5554, the 4177 server restarted and probed, tools/ax.

## Remaining

The gate-7 items above marked in progress; then the reviewer's re-check. To report to the md-step source owner: decision 18 (the open panel's slotted text is
intermittently missing from Chrome's accessibility tree, as md-accordion-item's was).
