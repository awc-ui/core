# Gate 7 audit — md-navigation-bar (+ md-navigation-tab)

**Verdict: FAIL (findings)** — gate-7 reviewer r6, 2026-10-31.

Scope: `md-navigation-bar`, `md-navigation-tab`. Independent re-run on the r6 snapshot `work/audit/r6-tree` (canonical copied 2026-10-31 02:12 Mac time, 42 installs,
latest fx-072 / fx-068 / n5-037; build products excluded and rebuilt). Job logs: `work/claude-runner/done/r6-*.log`; evidence:
[`work/audit/r6/`](../../../../audit/r6/) (`out/` suites, `gate1/` matrix, `lab/` Laboratory probes, `ax/` tools/ax, `examples/` compiled examples).
Defects: [work/audit/DEFECTS.md](../../../../audit/DEFECTS.md) (r6 section).

## Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | **Findings** | Matrix bar 4/1/2/1/7 + 1 part, destination 13/1/1/3/22 + 7 parts (the stylesheet's 22 hooks; the CEM lists 12). Gaps: parts (R6-03); `--md-navigation-tab-slotted-icon-font` has no test (R6-11); CEM drift (R6-14). |
| 2 Implementation | Pass | Dedicated renderers; decisions (22 hooks, FILL 0, zIndex, authored labelBehavior override, macOS landmark) accepted. |
| 3 Laboratory | Pass | Both renderers: hooks, labelBehavior update, select(1) → mdChange `{1, 0}`, focusTab(2), focusEl(); 12/12 live frames valid; 17+17 + 9 extra examples compile. |
| 4 Behaviour | Pass | States suites and host tests pass on all platforms. |
| 5 Visual | Pass (with R6-11) | Rendered views measured against Chrome 153 (77 paint cases incl. slotted icons). |
| 6 Runtime + a11y | **FAIL (iOS 18.6)** | macOS, iPhone / iPad iOS 26.3 and Android pass; iPhone 16 Pro iOS 18.6 fails one press check deterministically (3/3 runs, R6-16); tools/ax 0 open with accepted landmark expectations; gate-6 rows missing from ios-harness.md (R6-07). |
| 7 Independent audit | This document | FAIL until R6-03, R6-11 and R6-16 are resolved. |

## Re-runs (gates 2, 4, 5, 6) — claimed vs r6

Counts are each suite's own `passed/total`; suites that sample per rendered frame have device-dependent totals (all failures are listed).
The shared fixtures are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets (gzip assets after gunzip);
`tokens.css` copies equal `packages/tokens/src/tokens.css`.

| Suite | Claimed (doc / AUDIT row) | r6 result | Job |
| --- | --- | --- | --- |
| macOS `NativeNavigationBarPaintIntegration` | 14,500/14,500 | 14500/14500 | r6-003 |
| macOS `NativeNavigationBarStatesIntegration` | 189,386/189,386 | 189386/189386 | r6-003 |
| iOS harness `NativeNavigationBarPaintIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 14,500/14,500 (iPhone only) | 14500/14500 / 14500/14500 / 14500/14500 | r6-005 / r6-011 |
| iOS harness `NativeNavigationBarStatesIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 189,386/189,386 (iPhone only) | 189338/189338 / 189386/189386 / **189361/189362** (3/3 runs, R6-16) | r6-005 / r6-011 |
| Android `NativeNavigationBarParityTest` paint / states | 13,123/13,123 · 189,338/189,338 | 13123/13123 · 189338/189338 | r6-A001 |
| Android `LivePreviewNavigationBarHostTest` | 2/2 | 2/2 | r6-A001 |
| SwiftUI live host `test-live-navbar.mjs` | 27/27 | 27/27 (12/12 frames valid) | r6-008, r6-010 |

## Gate 1 — source contract matrix

Built from `packages/core/src/components/<tag>/` (TSX + CSS) and `custom-elements.json` (the inventory regenerated from canonical, `gate1/current-inventory.json` (r6-006), carries the same contract; its declared support equals the policy files except md-slider's `inset-icon`, R6-04), every property (default / enum), event (payload / cancel), method, slot, CSS hook (CEM plus stylesheet-only `--md-<tag>-*` references) and part, mapped to the SwiftUI and Compose sources, the Laboratory (appearance modules, `native-property-updates.js`, `native-methods.js`, recipes, native-compiler policies) and tests (fixtures, oracles, Android tests, live-host and studio tests): [`gate1/matrix.md`](../../../../audit/r6/gate1/matrix.md) (helper `gate1/matrix.mjs`; every "none" cell was then checked by hand — form names live in `NativeForms.swift` / `AWCFormControls.kt`, slots in fixtures as `#symbol` children, events reach the Laboratory as frame events). The compiler catalog hashes match today's sources for every tag (no stale generated policy).

## Gate 3 — Laboratory

Laboratory probe through the running server (`http://127.0.0.1:4177`, requests built with the canonical Laboratory modules;
`lab/probe-lab.json`, r6-007): for each tag on the SwiftUI ("iOS" tab) and Android renderers, a session with the recipe and one typed
style hook, one retained property update, every method, events. Live-host frames were also validated against the server's inspection
schema (`lab/frames`, r6-010) because the live-host scripts talk to the renderer directly.

| Probe | SwiftUI | Android |
| --- | --- | --- |
| md-navigation-bar session + hook, update `labelBehavior: selected` | ok (the label fade lands after the immediate reply frame; the live-host test checks it after 400 ms) | ok, frame changed |
| `select(1)` / `focusTab(2)` | mdChange `{index: 1, previousIndex: 0}` / ok | same |
| md-navigation-tab session + hook, update `badge`, `focusEl()` | ok | ok |

Examples: 17 + 17 (fork set) and 9 extra API examples (`icon` / `active-icon` / default slots, methods, events): SwiftUI typecheck exit 0
(r6-007), Compose compile exit 0 (r6-A002; classes for all six files verified in r6-A004).

## Gate 6 — accessibility

tools/ax (cases `bar`, `manual`, `destination`, `soft-disabled`): 0 open on macOS and iOS (2 accepted on iOS). Android:
md-navigation-bar 0 open (2 accepted) / md-navigation-tab 0 open.

## Exceptions and expectations

No exception records are proposed. Expectations reviewed: navigation landmark missing on iOS / Android — accepted (container-only
landmarks in UIKit, no landmark role in Compose).

## Findings

| ID | Summary |
| --- | --- |
| R6-03 | CSS parts: no native part appearance and no exception record |
| R6-11 | hooks without tests; slider value-indicator-reserve not in typed appearance / Laboratory |
| R6-16 | md-navigation-bar states on iOS 18.6: press state layer ahead of Chrome (1 check, 3/3 runs) |
| R6-07 | gate-6 iPad 26.3 / iOS 18.6 rows missing from the docs (r6 ran them) |
| R6-14 | CEM drift not regenerated |

## Re-check

After the owning forks install fixes for the blocking findings, r6 re-runs the affected suites on a fresh snapshot and replaces this verdict.
