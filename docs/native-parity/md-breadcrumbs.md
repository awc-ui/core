# md-breadcrumbs native checkpoint

Status: **gates 2–3 and accessibility verified on macOS SwiftUI, the iOS simulator and the Android emulator** against
Mac Chrome 153 oracles (2026-10-29), for `md-breadcrumbs` and its child `md-breadcrumb-item`. Independent final audit
pending. Source contract: [md-breadcrumbs-source-review.md](md-breadcrumbs-source-review.md); plan:
[md-breadcrumbs-native-plan.md](md-breadcrumbs-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Trail / crumb nodes (`AWCNativeView` / `AWCComponent`) | dedicated renderers (`NativeBreadcrumbs.swift`) | dedicated renderers (`AWCBreadcrumbs.kt`) |
| Twelve hooks (4 trail + 8 crumb, passed down to every crumb) | `AWCBreadcrumbsAppearance` + `.awcBreadcrumbsAppearance(_:)` | `AWCBreadcrumbsAppearance` + `AWCBreadcrumbsAppearanceScope` |
| `expand()`, `collapse()` | `AWCBreadcrumbsController` + `.awcBreadcrumbsController(_:)` | `AWCBreadcrumbsController` + `AWCBreadcrumbsControllerScope` |
| Link activation | `mdSelect` (cancelable), then the host URL router (`target` honoured) | same |

Behaviour mirrors the source: the wrapping list with separators (text, `›`, `>>`, any string; RTL separators are shaped
bidi-mirrored as Chrome does), the collapse window (`maxItems`, `itemsBeforeCollapse`, `itemsAfterCollapse`; the toggle
stays when before + after ≥ count, as Web), current-page promotion (the last crumb unless one is authored `current`), the
staggered entrance (opacity and slide on `cubic-bezier(.38,1.21,.22,1)` 500 ms, `--md-breadcrumbs-stagger` apart; none under
reduced motion), the overflow toggle (press scale, focus moves to the first revealed link), crumb hover/press/focus (8/12 %
state layer, hover nudge, 3-point secondary focus ring) with the md-ripple wave, 32 ch label truncation with the full
accessible name and no tooltip (as the Web source, R6-12), density 0…-4 with the rung-only spacing tokens, `mdExpand { expanded, itemCount }`
(cancelable, state independent of it, also for `maxItems` 0) and `mdSelect { href, label, current, itemIndex, itemTotal }`.

## Evidence

Oracles (`outputs/native-parity/md-breadcrumbs/web-oracle-mac/`, Chrome 153, DPR 1, trusted input; job n1-020) are shared
byte-identically by `packages/native-ios/Tests/Fixtures/breadcrumbs-web-*` and the Android assets `BreadcrumbsWeb*`:
99 paint cases + 12 single-hook cases with PNGs, 24 interaction/motion runs and 3 reduced-motion runs.

| Run | Result |
| --- | --- |
| macOS SwiftUI `NativeBreadcrumbsPaintIntegration` | 5,610/5,610 (n1-059) |
| macOS SwiftUI `NativeBreadcrumbsStatesIntegration` | 76,426/76,426 (n1-061) |
| iOS simulator (AWC-n1, iPhone 17 Pro, iOS 26.3.1) paint / states | 5,610/5,610 (n1-059) · 76,333/76,333 (n1-061) |
| Android emulator `NativeBreadcrumbsParityTest` paint / states | 5,335/5,335 · 22,306/22,306 (n1-A110; again on a fresh canonical copy, n1-A112) |
| Android `LivePreviewBreadcrumbsHostTest` | 2/2 |

Motion samples are compared within Chrome's frame envelope (±50 ms window, the native value or the value interpolated
between the nearest native frames); entrance samples are aligned to each trail's recovered start.

A late first host frame after an insert (machine load) is bounded by the entrance's known origin (opacity 0, slide =
slide / (1 − opacity)), so a sample before the first native frame still compares against the motion.

## Laboratory (gate 3)

- **Recipe:** Home (icon, link), Projects (link), AWC Native (current page); SwiftUI and Compose fixtures render the same trail.
- **Styles panel:** the 12 hooks (`breadcrumbs-appearance.js`) on the trail page, the 8 crumb hooks on the crumb page.
- **Properties:** retained updates for the trail (label, expandLabel, separator, the collapse window, density) and the
  crumb (href, target, rel, current, icon, disabled, density); the trail manages `collapsed`, `itemIndex`, `itemTotal`.
- **Methods:** `expand()` / `collapse()` through `AWCBreadcrumbsController` on both hosts (mdExpand events returned).
- **Examples:** 16 SwiftUI examples typecheck and 16 Compose examples compile (usage, theme, appearance, defaults,
  collapse window, current page, both methods, both events).

| Run | Result |
| --- | --- |
| Studio `breadcrumbs-integration.test.mjs` / all studio suites | 3/3 · 763/763 (n1-A112) |
| SwiftUI live host `test-live-breadcrumbs.mjs` | 23/23 |
| Android `LivePreviewBreadcrumbsHostTest` | 2/2 |

## Accessibility (tools/ax)

Cases `trail`, `collapsed` (md-breadcrumbs) and `link`, `current`, `disabled` (md-breadcrumb-item): **0 open findings**
on macOS, iOS and Android (n1-059, `outputs/native-parity/_ax-n1/`).

- macOS: the trail is an `AXGroup`/`AXLandmarkNavigation` named by its label ("Breadcrumb"), containing the links, the
  overflow button and the current page as static text, in reading order; Tab order matches Web.
- iOS: links and the toggle are buttons with the link trait; the trail is a labelled container (UIKit has no landmark
  element: documented expectation). Targets below 44 pt are reported as information.
- Android: crumbs are clickable nodes named once; the trail is a traversal group labelled by its `aria-label` (no
  landmark role in Compose: documented expectation).
- The current page is plain text everywhere (Chrome's tree has no "current page" text; `aria-current` has no native API).

## Installation

Installed in the canonical tree through the main queue: n1-062 and n1-063 (renderers, Laboratory integration, docs; native compiler, Swift package and playground builds, Android compile, Laboratory APK); every install was applied to a copy of the tree first. Verified on the canonical tree on 2026-10-30 (n1-069): the Laboratory playground rebuilt with SwiftPM's build-manifest cache disabled (n1-067's playground build had reused a manifest from before the install), SwiftUI live host 23/23, studio suite 775/778 (the 3 failures are md-text-field's), Laboratory server restarted, macOS tools/ax on the canonical build 5 cases with 0 open findings (`outputs/native-parity/_ax-n1-canonical/`).

## Gate-7 fixes (d6, 2026-10-31 … 2026-11-05)

Evidence: `work/d6-lab/out/` (jobs d6-002…d6-031, d6-A001…d6-A007, d6b-001…005); canonical installs `d6-install-1` (d6-009),
`d6-install-2` (d6-019) and `d6-install-3` (d6-032), each re-applying the anchored, pre-image-checked patch scripts in
`work/d6-lab/` (r601, r608, r610, r614, r603/*, r611, r609*) with automatic rollback.

### iOS simulator (gate 6, R6-07)

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
| --- | --- | --- | --- |
| `NativeBreadcrumbsPaintIntegration` | 6134/6134 | 6134/6134 | 6134/6134 |
| `NativeBreadcrumbsStatesIntegration` | 76473/76473 | 76473/76473 | 76473/76473 |

Xcode 26.3, `apps/native-ios-parity` harness (`work/d6-lab/harness.sh`), d6's own simulators (AWC-d6, AWC-d6-ipad, AWC-d6-18), on the
installed code (job d6-030, logs `work/d6-lab/out/ios-final/console-<simulator>-<suite>.log`).

Breadcrumbs states rows: after d6-install-4 (d6b-006, 2 of 2 runs per runtime pass). Before it, iOS lost 1–2 of 76473 samples on every runtime (di-027a/028/029; d6-030/034 on 18.6 in 3 of 3 runs): `select-cancel` click t+48, `overflowKeyboard` / `keyboard` Tab t+32, `overflowPointer` press t+44 — the native transitions started in the input frame and led Chrome, which computes style once per frame after the input, by that latency; it showed on iOS, where the first frames after a touch or key arrive late. A state change now starts its transition in the next frame, as the source does (changes within that frame coalesce, a set-and-reset starts none; `d6-lab/bc_nextframe.py`); macOS 76426/76426 ×2 (d6-035).

### Findings

- **R6-02 (Laboratory SwiftUI preview).** The collapsed trail's `overflow` node reports `gap` as `{row: 0, column}` (kept as
  `toggleGap`); `test-live-breadcrumbs.mjs` validates every frame with the server schema, including the collapsed trail and
  `expand()`/`collapse()`.
- **R6-10 (`rel`) — exception record (proposed; reviewer acceptance pending).**
  - *Source behaviour:* `rel` (default `noopener noreferrer` with a `target`) sets the opener and referrer policy of the
    browsing context the link opens.
  - *Platform/API:* SwiftUI (`AWCURLRouter`) and Compose (`AWCNavigationRequest` router).
  - *Technical reason:* native apps have no browsing contexts: a URL is handed to the host router (`openURL` / the app's
    router), which never shares a window opener or a Referer header with the page.
  - *User impact:* none observable — the security property `noopener noreferrer` protects is always met natively.
  - *Tested native equivalent:* `test-live-breadcrumbs.mjs` clicks the same link with no `rel`, `opener`,
    `noopener noreferrer` and `nofollow external`: identical `mdSelect` detail and identical navigation (16 checks).
  - *Evidence:* `work/d6-lab/out/d6-003/live-breadcrumbs.log`, install `d6-install-1`.
- **R6-12 (tooltip).** The renderers draw no tooltip on a truncated (32 ch) label, as the Web source (no `title`/`.help` /
  tooltip in `NativeBreadcrumbs.swift` or `AWCBreadcrumbs.kt`); the earlier native-tooltip statement was stale. The decision
  row in the source review now says so.
- **R6-14 (CEM).** md-breadcrumbs' `separator` part is in the regenerated CEM; a querySelector string that the generator
  read as a `static` part of md-breadcrumbs now uses `[part~="static"]`.
- **R6-03 (parts).** Typed: md-breadcrumb-item `AWCBreadcrumbItemPartAppearance` (`.awcBreadcrumbItemPartAppearance(_:for:)` / `AWCBreadcrumbItemPartAppearanceScope`) — separator (colour, font size), icon and label (colour), link (colour, underline drawn in the link colour under the label and an icon-font glyph), static (colour, background, border width and colour), state-layer (colour, opacity); md-breadcrumbs `AWCBreadcrumbsPartAppearance` (`.awcBreadcrumbsPartAppearance(_:for:)` / `AWCBreadcrumbsPartAppearanceScope`) — list (background, physical padding), separator (the overflow separator: colour, font size), overflow-button (background in every state, dots colour). Part rules come from the outer tree, so a typed value wins over the hooks and every internal state rule (a state-layer opacity shows in every state), as `::part()` rules do in Chrome. Oracle: Mac Chrome 153 `::part()` cases (6 cases in `md-breadcrumbs/web-reference/paint.html?set=parts`: n1's parts-trail / parts-item (recaptured identical) plus their dark-RTL twins and parts-surfaces(-dark-rtl) with asymmetric list padding; job d6-018). SwiftUI: NativeBreadcrumbsPaintIntegration 6134/6134 (macOS, d6-026; the parts cases were skipped before); Compose: NativeBreadcrumbsParityTest pass (d6-A006, d6-A007). Laboratory: `visualParts` in both support policies and copyable SwiftUI / Compose examples for every typed part (22 SwiftUI examples typecheck (d6-026), 22 Compose examples compile (d6-A007)).

#### Typed box target (gate-7 R6-17): md-breadcrumbs ::part(overflow)

`::part(overflow)` of md-breadcrumbs is the item holding the leading separator and the "…" button; its border and padding shift the trail. It is a typed part target, not an exception: `AWCPartBox` (background, border width / colour, border radius, padding shorthand; physical edges, content-box) on `AWCBreadcrumbsPartAppearance(overflow:)` for SwiftUI and `AWCBreadcrumbsPartAppearance(overflow:)` for Compose, taking layout space around the wrapper's content as in Chrome (everything inside and after it shifts), and the Laboratory's `visualParts` / copyable examples carry it. Oracle: Mac Chrome 153 `::part(overflow)` box cases merged into the paint fixtures; paint checks compare the typed box (background, border, radius, padding) and the wrapper geometry, plus flat pixels, on macOS, iOS and Android ([NativeBreadcrumbsPaintIntegration.swift](../../packages/native-ios/Tests/NativeBreadcrumbsPaintIntegration.swift), [NativeBreadcrumbsParityTest.kt](../../apps/native-android-playground/src/androidTest/java/dev/awc/playground/NativeBreadcrumbsParityTest.kt)).

- **R6-22 (Compose standalone crumb label, d6, 2026-11-14).** The standalone md-breadcrumb-item repainted its label one update late (the link / static swap ran after composition). The swap is now applied while composing; Android tests read the label's glyph ink after `disabled` and `current` updates (they failed before the fix) and the paint matrix measures label ink on every crumb.

## Remaining

Independent final audit.
