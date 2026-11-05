# Gate 7 audit — `md-accordion` (+ `md-accordion-item`)

Reviewer: gate-7 reviewer r3, 2026-10-31. Independent of the implementing forks; no product code changed.

**Verdict: FAIL** — findings r3-07, r3-09, r3-16, r3-17, r3-18, r3-19, r3-20, r3-21. Every test suite re-ran green on macOS
(14/14 fixtures, 120,974 checks), iOS 26.3 (14/14, 139,830 checks) and Android (34/34 device methods + unit). The failures are
source behaviours without a native implementation or an accepted exception, and one Android Laboratory defect.

## Method

- Snapshot `work/audit/r3-tree` (job `r3-002`, 2026-10-31 02:12 EET, 42 install jobs, newest `fx-072-install-orgchart-apk`).
- Contract: `packages/core/src/components/md-accordion{,-item}/` + regenerated inventory (`r3-006`), unchanged from baseline:
  md-accordion 15/5/0/1, 14 hooks, part `drop-placeholder`; md-accordion-item 10/3/2/4, 24 hooks, 13 parts.
- The accordion checkpoints (`outputs/native-parity/md-accordion/*/checkpoint.json`) predate many shared-file changes; the r3
  re-runs below are the current evidence.

## Gate checklist

| Gate | Result | Evidence |
| --- | --- | --- |
| 1 Source contract | **finding r3-18** | `drop-placeholder`, `chassis-handle`, `chassis-handle-bar` "accept no part declarations" (policies) — no exception record |
| 2 Implementation | **findings r3-07, r3-09, r3-17, r3-19, r3-20** | forced colours missing on SwiftUI and untested on Compose; CSS cursor (grab/grabbing/pointer/not-allowed) not mapped; `hidden` ignored (group and item); floating panel z-order local to siblings; SwiftUI placeholder dash phase |
| 3 Laboratory | **finding r3-16** | `accordion-appearance.js` 14 + 24 hooks; retained updates; item methods `toggle`/`focusHeader`; 81+81 examples |
| 4 Behaviour | pass | state 65, actual-Web sequences 58, initialization 100, scrolling 278, reorder 628, shift 16,316, states 45,590, floating 46,304 (macOS); Android 34 device methods |
| 5 Visual | pass (with r3-20) | appearance 1,478, parts 8,272, lift 280, placeholder 320; light/dark, LTR/RTL, variants, densities |
| 6 Runtime + a11y | pass (r3-21: stale policy notes) | iOS 26.3 re-run 14/14; tools/ax default + exclusive: 0 open findings on macOS, iOS, Android |
| 7 Final audit | FAIL | this document |

## Source contract matrix (summary)

| Family | md-accordion | md-accordion-item | SwiftUI | Compose | Laboratory | Test |
| --- | --- | --- | --- | --- | --- | --- |
| Properties | 15 | 10 | all | all | retained updates (15 + 10) | state/initialization/appearance/floating/scrolling oracles |
| Events | mdToggle, mdReorder, mdDragStart/Move/End | mdItemToggle, mdItemRequestFocus, mdItemRequestReorder | all | all | event log | state, reorder, floating oracles |
| Methods | — | toggle, focusHeader | `AWCAccordionItemController` | `AWCAccordionItemControllerScope` | method buttons | live hosts, Android `accordionItemAppearanceAndControllerMethods` |
| Slots | default | default, leading-icon, headline, trailing-icon | slot views | slot lambdas | text slots (default, headline) | parts/appearance cases |
| Hooks | 14 | 24 | `AWCAccordionAppearance`, `AWCAccordionItemAppearance` | same | `accordion-appearance.js` | every hook exercised (appearance/parts/floating/placeholder/lift/motion fixtures) |
| Parts | drop-placeholder (**hooks only**) | 11 typed + chassis-handle, chassis-handle-bar (**hooks only**) | `AWCAccordionItemPart` (11 declared) | same | Styles panel | parts 192 configurations |
| `:host([hidden])` | — | — | **not handled** | **not handled** | — | **none** |
| `@media (forced-colors)` (floating border, item border, no state layer, chassis bar CanvasText) | — | — | **none** | opt-in `AWCAccessibilityAppearanceScope(forcedColors)` | — | **none** |
| `@media (prefers-reduced-motion)` | — | — | handled | handled | — | motion/placeholder/floating suites |

## Exception decisions

| Proposed / listed difference | Decision |
| --- | --- |
| Android heading level, region role and labelled-by "proposed as platform exceptions (not accepted)" (`md-accordion-compose-renderer.md`) | **Accepted**, gate-7 reviewer r3, 2026-10-31. Source: `h<headingLevel>` header, panel `role=region` `aria-labelledby` header. Platform/API: Android `AccessibilityNodeInfo`/Compose semantics offer `heading()` without a level, no landmark/region role and no labelled-by relation for Compose nodes. Reason: no public API (TalkBack does not announce heading levels for native views). User impact: TalkBack users hear "heading" without the level and no region boundary; content order is header → panel, so the panel still follows its label. Tested native equivalent: heading + button with expanded state, collapsed panels removed from semantics (`NativeAccordionAccessibilityTest`), tools/ax Android pass (default, exclusive). Evidence: `md-accordion-compose-renderer.md`, `outputs/native-parity/md-accordion/accessibility/`, r3 re-run `work/audit/r3/out/ax/md-accordion/report.md`. Scope: these three relations only. |
| iOS: no region container (macOS uses a named group) | Accepted as the same class of platform convention (UIKit landmarks are container types, not elements; tools/ax ROLE_TABLE). |
| Floating panel: `zIndex` orders only siblings (SwiftUI and Compose) vs CSS `position: fixed` + `z-index` | **Rejected** — implementable: render floating panels in a window-level layer (the shared modal layer already does this for md-dialog/sheets) so they stack against the whole window like the source. r3-19. |
| `drop-placeholder`, `chassis-handle`, `chassis-handle-bar` accept no part declarations (styled only through 5 + 2 hooks) | **Rejected** — implementable: the other 11 item parts already take typed part appearance (`AWCAccordionItemPart` even contains `chassisHandle`/`chassisHandleBar`). r3-18. |
| SwiftUI drop-placeholder dash phase after a rounded corner differs from Chrome by up to one period (only the top side's phase is tested) | **Rejected** — implementable: paint each side with Chrome's per-side dash distribution (Compose stays within 1.20 px); r3-20. |
| Compose dash centres drift ≤ 1.20 px (tested bound 1.25) | Accepted as a measured raster tolerance. |

## Re-run counts (claimed → r3)

| Suite (macOS, `r3-005`) | Claimed (latest) | r3 |
| --- | --- | --- |
| `NativeAccordionStateIntegration` | 65 | **65/65** |
| `NativeAccordionBrowserStateIntegration` | 58 snapshots | **58/58** |
| `NativeAccordionMotionIntegration` | 716 | **716/716** |
| `NativeAccordionRendererIntegration` | 569 | **569/569** |
| `NativeAccordionInitializationIntegration` | 100 (20 cases) | **100/100** |
| `NativeAccordionScrollingIntegration` | 278 | **278/278** |
| `NativeAccordionAppearanceIntegration` | 1,478 | **1,478/1,478** |
| `NativeAccordionPartsIntegration` | 8,272 | **8,272/8,272** |
| `NativeAccordionReorderIntegration` | 628 | **628/628** |
| `NativeAccordionLiftIntegration` | 280 | **280/280** |
| `NativeAccordionShiftIntegration` | 15,240 (frame-dependent) | **16,316/16,316** |
| `NativeAccordionStatesIntegration` | 40,486 (frame-dependent) | **45,590/45,590** |
| `NativeAccordionPlaceholderIntegration` | 320 | **320/320** |
| `NativeAccordionFloatingIntegration` | 44,234 (frame-dependent) | **46,304/46,304** |
| **macOS total** | | **120,974/120,974** |

| Other suites | Claimed | r3 | Job |
| --- | --- | --- | --- |
| Android device (16 accordion classes incl. `LivePreviewAccordionHostTest`) | 230/235 full suite (5 non-accordion) | **34/34 methods** (floating 16,466/16,466) | `r3-A003` |
| Android unit accordion classes | in 190/190 | **38/38** (unit total 195/195) | `r3-A001` |
| SwiftUI live host `test-live-accordion.mjs` | 24/24 | **pass** | `r3-0106` |
| iOS 14 fixtures (iPhone 17 Pro, iOS 26.3, AWC-r3) | 140,493/140,493 | **139,830/139,830** (state 65, actual-Web 58, motion 716, renderer 493, initialization 100, scrolling 278, appearance 1,478, parts 8,272, reorder 628, lift 280, shift 20,156, states 56,014, placeholder 320, floating 50,972) | `r3-012` |
| Swift / Kotlin examples | 81 / 81 | **81 typecheck, 0 errors / 81 compile** | `r3-010`, `r3-A007` |
| tools/ax default, exclusive | pass ×3 | **pass** ×3 (0 open) | `r3-0107`, `r3-A009` |

## Laboratory (gate 3)

`lab-probe.mjs` / `lab-probe2.mjs` (`r3-0105`, `r3-0109`) through the 4177 server: SwiftUI accepts every tried retained update
(`exclusive`, `variant`, `keepOneExpanded`); Compose accepts `density` and `variant` but `update {exclusive:true}` answers
`502 ANDROID_HOST_FAILED` and the session is gone (`404 SESSION_NOT_FOUND`) — 3 of 3 attempts (r3-16). md-accordion-item sessions:
`update {headline}` 200 and `toggle()` 200 with `mdItemToggle` on both platforms. Studio focused suites 95/95 and full 807/807
(`r3-0108`); SwiftUI live host `test-live-accordion.mjs` and Android `LivePreviewAccordionHostTest` pass.

## Accessibility (gate 6)

tools/ax re-run (`work/audit/r3/out/ax/md-accordion/report.md`): default and exclusive cases pass on all three platforms with
no expectation entry. Headings, header buttons with expanded state and panel text match Web; the Web region is a named group on
macOS and is not an element on iOS/Android (ROLE_TABLE conventions; Android accepted above). The iPad and iOS 18.6 gate-6 claims
(141,136 and 139,424) match the fi logs (`outputs/native-parity/_ios/fi/summary-r8p-.json`, `summary-r8o-.json`) but were run on
`work/fi-tree-r8`, whose shared AWCUI files differ from canonical; `NativeAccordion.swift` is identical. They were not re-run by r3.

## Findings

- **r3-07** (gates 2, 5) forced colours: SwiftUI none; Compose opt-in `forcedColors` path untested.
- **r3-09** (gate 2) CSS cursor not mapped (header pointer/not-allowed, grip grab/grabbing).
- **r3-16** (gate 3) Android Laboratory: `exclusive` retained update kills the session.
- **r3-17** (gates 2, 4) `hidden` ignored for the group and items.
- **r3-18** (gate 1) `drop-placeholder`, `chassis-handle`, `chassis-handle-bar` take no part declarations; no exception record.
- **r3-19** (gate 2) floating panel z-order local to siblings.
- **r3-20** (gate 5) SwiftUI placeholder dash phase.
- **r3-21** (gate 7) released policy notes still claim iOS/VoiceOver execution is unavailable.

Defect rows with evidence paths and suggested fixes: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate-7 reviewer r3". Evidence: `work/audit/r3/` (runner logs `work/claude-runner/done/r3-*.log`); progress `work/audit/r3/PROGRESS.md`.
