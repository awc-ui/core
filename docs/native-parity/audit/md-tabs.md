# Gate 7 audit — md-tabs (+ md-tab, md-tab-panel, md-tab-panels)

**Verdict: FAIL (findings)** — gate-7 reviewer r6, 2026-10-31.

Scope: `md-tabs`, `md-tab`, `md-tab-panel`, `md-tab-panels`. Independent re-run on the r6 snapshot `work/audit/r6-tree` (canonical copied 2026-10-31 02:12 Mac time, 42 installs,
latest fx-072 / fx-068 / n5-037; build products excluded and rebuilt). Job logs: `work/claude-runner/done/r6-*.log`; evidence:
[`work/audit/r6/`](../../../../audit/r6/) (`out/` suites, `gate1/` matrix, `lab/` Laboratory probes, `ax/` tools/ax, `examples/` compiled examples).
Defects: [work/audit/DEFECTS.md](../../../../audit/DEFECTS.md) (r6 section).

## Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | **Findings** | Matrix md-tabs 6/1/1/1/2 + 1 part, md-tab 9/1/0/2/9 (+2 runtime-internal glide variables) + 6 parts, md-tab-panel 1/0/0/1/0, md-tab-panels 2/0/0/1/0. Gaps: parts (R6-03), md-tab `controls` / aria-controls (R6-09); CEM drift (R6-14). |
| 2 Implementation | Pass (with R6-08) | Dedicated renderers; source decisions reproduced (silent writes, modifier-agnostic arrows, colour fades under reduced motion). |
| 3 Laboratory | Pass | Both renderers: sessions, hooks, retained updates for all four tags, selectTab(2) → mdTabChange `{index: 2, previousIndex: 1}`; 18/18 live frames valid; 20+20 + 8 extra examples compile. |
| 4 Behaviour | Pass | States suites and host tests pass on all platforms. |
| 5 Visual | Pass | Rendered views measured against Chrome 153 (135 paint cases incl. hooks, RTL, density). |
| 6 Runtime + a11y | **FAIL** | Suites pass on macOS, iOS (3 runtimes, r6) and Android; the active panel is not a Tab stop natively (expectation rejected, R6-08); gate-6 rows missing from ios-harness.md (R6-07). |
| 7 Independent audit | This document | FAIL until R6-03, R6-08, R6-09 are resolved. |

## Re-runs (gates 2, 4, 5, 6) — claimed vs r6

Counts are each suite's own `passed/total`; suites that sample per rendered frame have device-dependent totals (all failures are listed).
The shared fixtures are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets (gzip assets after gunzip);
`tokens.css` copies equal `packages/tokens/src/tokens.css`.

| Suite | Claimed (doc / AUDIT row) | r6 result | Job |
| --- | --- | --- | --- |
| macOS `NativeTabsPaintIntegration` | 14,297/14,297 | 14297/14297 | r6-003 |
| macOS `NativeTabsStatesIntegration` | 137,124/137,124 | 137124/137124 | r6-003 |
| iOS harness `NativeTabsPaintIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 14,297/14,297 (iPhone only) | 14297/14297 / 14297/14297 / 14297/14297 | r6-005 / r6-011 |
| iOS harness `NativeTabsStatesIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 132,004/132,004 (iPhone only, n1-A128) | 132004/132004 / 132004/132004 / 132004/132004 | r6-005 / r6-011 |
| Android `NativeTabsParityTest` paint / states | 11,370/11,370 · 136,956/136,956 (n1-A126) | 11370/11370 · 136956/136956 | r6-A001 |
| Android `LivePreviewTabsHostTest` | 4/4 | 4/4 | r6-A001 |
| SwiftUI live host `test-live-tabs.mjs` | 38/38 | 38/38 (18/18 frames valid) | r6-008, r6-010 |

## Gate 1 — source contract matrix

Built from `packages/core/src/components/<tag>/` (TSX + CSS) and `custom-elements.json` (the inventory regenerated from canonical, `gate1/current-inventory.json` (r6-006), carries the same contract; its declared support equals the policy files except md-slider's `inset-icon`, R6-04), every property (default / enum), event (payload / cancel), method, slot, CSS hook (CEM plus stylesheet-only `--md-<tag>-*` references) and part, mapped to the SwiftUI and Compose sources, the Laboratory (appearance modules, `native-property-updates.js`, `native-methods.js`, recipes, native-compiler policies) and tests (fixtures, oracles, Android tests, live-host and studio tests): [`gate1/matrix.md`](../../../../audit/r6/gate1/matrix.md) (helper `gate1/matrix.mjs`; every "none" cell was then checked by hand — form names live in `NativeForms.swift` / `AWCFormControls.kt`, slots in fixtures as `#symbol` children, events reach the Laboratory as frame events). The compiler catalog hashes match today's sources for every tag (no stale generated policy).

## Gate 3 — Laboratory

Laboratory probe through the running server (`http://127.0.0.1:4177`, requests built with the canonical Laboratory modules;
`lab/probe-lab.json`, r6-007): for each tag on the SwiftUI ("iOS" tab) and Android renderers, a session with the recipe and one typed
style hook, one retained property update, every method, events. Live-host frames were also validated against the server's inspection
schema (`lab/frames`, r6-010) because the live-host scripts talk to the renderer directly.

| Probe | SwiftUI | Android |
| --- | --- | --- |
| md-tabs session + `containerColor` hook, update `activeTabIndex: 1` | ok, hook visible, frame changed | ok, frame changed |
| `selectTab(2)` | mdTabChange `{index: 2, previousIndex: 1}` | same |
| md-tab session + hook, update `disabled` | ok | ok |
| md-tab-panel update `active`; md-tab-panels update `sizing: active` | ok | ok |

Examples: 20 SwiftUI + 20 Compose (fork set) and 8 extra API examples (md-tab `icon` / `badge` slots, events, panels) regenerated from the
snapshot: SwiftUI typecheck exit 0 (r6-007), Compose compile exit 0 (r6-A002; classes for all six files verified in r6-A004).

## Gate 6 — accessibility

tools/ax (6 cases; `ax/`): md-tabs, md-tab, md-tab-panels 0 open on macOS and iOS; md-tab-panel `panel` had one `text-extra` on macOS /
iOS in the first run (Chrome left the slotted text out of its tree), clean in two Web reruns (R6-15). Android: md-tabs and md-tab 0 open; md-tab-panel and md-tab-panels 0 open with 2 accepted each (the focus expectation among them is rejected by r6, R6-08).

## Exceptions and expectations

No exception records are proposed. Expectations reviewed: md-tabs Android label as text — accepted; md-tab-panel(s) `tabpanel`
role missing on every platform — accepted (no native tab-panel element; content in place, inactive panels hidden, verified);
md-tab-panel(s) **focus** (Web `tabindex=0` on the active panel, no native Tab stop) — **rejected**: an implementable gap waived as a
platform convention, the decision itself names the implementation (R6-08). Source-review decisions (secondary stacked tabs stay 48 px,
silent writes, colour fades under reduced motion, nearest-preceding panels fallback) — accepted.

## Findings

| ID | Summary |
| --- | --- |
| R6-03 | CSS parts: no native part appearance and no exception record |
| R6-08 | active md-tab-panel not a Tab stop natively (expectation rejected) |
| R6-09 | md-tab `controls` (aria-controls) not implemented, no exception record |
| R6-07 | gate-6 iPad 26.3 / iOS 18.6 rows missing from the docs (r6 ran them) |
| R6-14 | CEM drift not regenerated |
| R6-15 | Chrome drops slotted text from its tree intermittently (tools/ax Web capture); slider reflected "false" booleans |

## Re-check

After the owning forks install fixes for the blocking findings, r6 re-runs the affected suites on a fresh snapshot and replaces this verdict.
