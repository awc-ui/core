# md-fab-menu (+ md-fab-menu-item) — gate-7 independent audit

Reviewer: gate-7 reviewer r1, 2026-10-31 ([protocol](../../../../audit/AUDIT-PROTOCOL.md)). Everything below was re-run by r1 on the
snapshot `work/audit/r1-tree` (canonical tree at 2026-10-31 00:15 UTC after 42 install jobs, latest `fx-072-install-orgchart-apk`; hash
manifest `work/audit/r1/snap/manifest.sha256`), except the Laboratory probes, which use the running 4177 server (canonical). Job logs:
`work/claude-runner/done/r1-*.log`; outputs: `work/audit/r1/runs/`; gate-1 matrices: `work/audit/r1/matrix/`; defects:
[`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md) (section r1). Mac load average during the runs: 110–940 on 16 cores.
None of these components has a `checkpoint.json`, so freshness rests on these re-runs (R1-10).

## Verdict: FAIL

Blocking: **R1-03c** (no Chrome paint/state/motion evidence; `rovingFocusVisible` paint untested), **R1-04** (no retained Laboratory
property updates), **R1-05** (undecided source caveats; proposed authored-style exception rejected), **R1-06** (inspector root differs per
platform; proposed boundary rejected). Non-blocking: R1-09, R1-10. The supporting tag md-fab-menu-item shares this verdict.

## Gate 1 — source contract

md-fab-menu: 7 properties, `mdOpen`/`mdClose` (void), `show`/`close`/`whenClosed`, default slot, 0 parts, 3 hooks = 16 rows; md-fab-menu-item:
6 properties, `mdClick` (void), default + `icon` slots, 3 parts, 5 hooks = 17 rows ([menu](../../../../audit/r1/matrix/md-fab-menu.md),
[item](../../../../audit/r1/matrix/md-fab-menu-item.md)). All rows have SwiftUI and Compose implementations and Laboratory exposure
(catalog, `fab-menu-appearance.js`, lifecycle Methods panel). Test gaps on review: `menuLabel` is exercised only at its default ("Actions",
tools/ax) and the item's `rovingFocusVisible` is implemented on both platforms (NativeFabMenuItem.swift:85, NativeFabMenuItem.kt:65) but
no test checks its focus paint (keyboard tests check the responder only) — part of R1-03c. The source review lists three caveats that
"require explicit source/native decisions" (`quick` vs entry transitions, unused stagger constant, anchor inline-colour cleanup); no
decision is recorded (R1-05). Gate 1: not met.

## Re-run counts (claimed → r1)

| Suite | Claimed | r1 macOS | r1 iOS 26.3 | r1 Android |
|---|---|---|---|---|
| `NativeFabMenuLifecycleIntegration` | 19 | **19/19** | **19/19** | — |
| `NativeFabMenuViewIntegration` | 134 (doc: 133) | **134/134** | **134/134** | — |
| `… --interactions-only --native-pointer` | 27 | **27/27** | **27/27** | — |
| Live host `test-live-fab-menu` | 24 | **24/24** | — | — |
| Android device | 5 component + 1 host + 3 regression methods | — | — | `NativeFabMenuParityTest` **5/5**, `LivePreviewHostTest#fabMenuMethods…` **1/1** (button regressions: see md-button) |
| Android unit | 6 menu contracts | — | — | `NativeFabMenuContractTest` **6/6** |
| Web | 155 source tests; e2e 18 | e2e md-fab-menu **18/18** (r1-011; r1-009 hit a dev-server start-up timeout), md-fab-menu-item **5/5** | | |

## Gates 2/5 — against Chrome (R1-03c)

The Web reference is 22 Chrome 152 computed-geometry configurations (2026-10-20, light only) plus the anchor pointer/Enter/Space event
oracle. There is no Chrome paint comparison (dark, item palettes as pixels, anchor morph to a 50 % radius), no item state run
(hover/focus/roving focus/pressed state layers, focus ring) and no open/close motion run (150 ms opacity + scale from 0.8, 180 ms close
delay, 120 ms anchor icon cross-fade) or reduced-motion run.

## Gate 3 — Laboratory

r1-003 on both hosts: `show` → accepted, frame with `mdOpen`; `whenClosed` accepted and pending; `close` accepted; the first
`method-results` poll returns all three fulfilled with `mdClose`; the closed frame has no popup node. Open-frame inspection: SwiftUI
13 nodes, Android 16 (items with icon/label/state-layer on both), but the `component` node is the 360×480 authored context on SwiftUI and the
640×544 viewport on Android, while Web's box is the 127.85×152 item stack (R1-06). r1-010: variant/open edit through a new session renders
the open menu on both. Retained `update` refused (R1-04). Examples: r1 generic menu 9 + item 9 and the fork generator's 21 per platform
compile (Swift typecheck exit 0; Kotlin BUILD SUCCESSFUL).

## Gate 6 — runtime and accessibility

tools/ax: closed/open cases, 0 open, 0 accepted, all three platforms; identical to the installed report. The menu is a labelled `AXMenu`
on macOS, a labelled container on iOS (`awcMenuAccessibility`: `.accessibilityElement(children: .contain).accessibilityLabel`,
NativeFocusBridge.swift:404) and a pane titled "Actions" on Android; items are buttons on iOS/Android — the comparator's documented role
encodings (normalize.mjs ROLE_TABLE), accepted as conventions.

## Exceptions (decisions)

- **Authored-style restoration** ("native restores authored FAB appearance after close; Web deletes its inline overrides including a
  pre-existing authored inline value"; md-fab-menu.md, packages/native-ios/audits/md-fab-menu.md:55) — **rejected**, gate-7 reviewer r1,
  2026-10-31. Missing fields: technical reason and tested native equivalent; and it is implementable: the Web source can save and restore
  the anchor's prior inline values (the native behaviour), test-first, which removes the difference (R1-05).
- **Inspector root surfaces** (SwiftUI context vs Android overlay) — **rejected**, gate-7 reviewer r1, 2026-10-31: implementable by reporting
  the item-stack bounds as `component` on both platforms (R1-06).
- Compose searchable text through `AWCSlotText`/`AWCSearchableLabelScope` instead of DOM `textContent`, and the Android outside-input scope —
  native equivalents with tests (typeahead, outside activation), not exceptions.

## Findings

R1-03c, R1-04, R1-05, R1-06 (blocking); R1-09, R1-10. See [DEFECTS.md](../../../../audit/DEFECTS.md).
