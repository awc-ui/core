# Gate 7 audit — md-breadcrumbs (+ md-breadcrumb-item)

**Verdict: FAIL (findings)** — gate-7 reviewer r6, 2026-10-31.

Scope: `md-breadcrumbs`, `md-breadcrumb-item`. Independent re-run on the r6 snapshot `work/audit/r6-tree` (canonical copied 2026-10-31 02:12 Mac time, 42 installs,
latest fx-072 / fx-068 / n5-037; build products excluded and rebuilt). Job logs: `work/claude-runner/done/r6-*.log`; evidence:
[`work/audit/r6/`](../../../../audit/r6/) (`out/` suites, `gate1/` matrix, `lab/` Laboratory probes, `ax/` tools/ax, `examples/` compiled examples).
Defects: [work/audit/DEFECTS.md](../../../../audit/DEFECTS.md) (r6 section).

## Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | **Findings** | Matrix 7/1/2/1/4 + 3 parts (trail), 10/1/0/2/8 + 6 parts (crumb): properties, events, methods, slots and hooks are implemented on both platforms, exposed in the Laboratory and tested, except: parts (R6-03), `rel` (R6-10); CEM drift (`separator` part, R6-14). |
| 2 Implementation | **Finding** | Dedicated renderers match the source; native-only hover tooltip on truncated labels (R6-12). |
| 3 Laboratory | **FAIL** | Android preview, update, expand()/collapse() with mdExpand pass; the SwiftUI preview loses its session once the trail collapses (R6-02). 16+16 examples + 7 slot/method/event examples compile. |
| 4 Behaviour | Pass | States suites (interaction, motion, cancellation, runtime property changes, methods) pass on macOS, iOS and Android; host tests pass. |
| 5 Visual | Pass | Rendered views measured against Chrome 153 (99 paint + 12 hook cases, light/dark, RTL, density). |
| 6 Runtime + a11y | **Finding (doc)** | macOS, iOS (3 runtimes, r6) and Android pass; tools/ax 0 open after Web reruns (R6-15); gate-6 rows missing from ios-harness.md (R6-07). |
| 7 Independent audit | This document | FAIL until R6-02, R6-03, R6-10, R6-12 are resolved (R6-07, R6-14, R6-15 documentation / Web follow-ups). |

## Re-runs (gates 2, 4, 5, 6) — claimed vs r6

Counts are each suite's own `passed/total`; suites that sample per rendered frame have device-dependent totals (all failures are listed).
The shared fixtures are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets (gzip assets after gunzip);
`tokens.css` copies equal `packages/tokens/src/tokens.css`.

| Suite | Claimed (doc / AUDIT row) | r6 result | Job |
| --- | --- | --- | --- |
| macOS `NativeBreadcrumbsPaintIntegration` | 5,610/5,610 (n1-059) | 5610/5610 | r6-003 |
| macOS `NativeBreadcrumbsStatesIntegration` | 76,426/76,426 (n1-061) | 76426/76426 | r6-003 |
| iOS harness `NativeBreadcrumbsPaintIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 5,610/5,610 (iPhone only) | 5610/5610 / 5610/5610 / 5610/5610 | r6-005 / r6-011 |
| iOS harness `NativeBreadcrumbsStatesIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 76,333/76,333 (iPhone only) | 76473/76473 / 76473/76473 / 76473/76473 | r6-005 / r6-011 |
| Android `NativeBreadcrumbsParityTest` paint / states (emulator-5566) | 5,335/5,335 · 22,306/22,306 | 5335/5335 · 22306/22306 | r6-A001 |
| Android `LivePreviewBreadcrumbsHostTest` | 2/2 | 2/2 | r6-A001 |
| SwiftUI live host `test-live-breadcrumbs.mjs` | 23/23 | 23/23 (but 4/11 frames fail the server schema, R6-02) | r6-008, r6-010 |

## Gate 1 — source contract matrix

Built from `packages/core/src/components/<tag>/` (TSX + CSS) and `custom-elements.json` (the inventory regenerated from canonical, `gate1/current-inventory.json` (r6-006), carries the same contract; its declared support equals the policy files except md-slider's `inset-icon`, R6-04), every property (default / enum), event (payload / cancel), method, slot, CSS hook (CEM plus stylesheet-only `--md-<tag>-*` references) and part, mapped to the SwiftUI and Compose sources, the Laboratory (appearance modules, `native-property-updates.js`, `native-methods.js`, recipes, native-compiler policies) and tests (fixtures, oracles, Android tests, live-host and studio tests): [`gate1/matrix.md`](../../../../audit/r6/gate1/matrix.md) (helper `gate1/matrix.mjs`; every "none" cell was then checked by hand — form names live in `NativeForms.swift` / `AWCFormControls.kt`, slots in fixtures as `#symbol` children, events reach the Laboratory as frame events). The compiler catalog hashes match today's sources for every tag (no stale generated policy).

## Gate 3 — Laboratory

Laboratory probe through the running server (`http://127.0.0.1:4177`, requests built with the canonical Laboratory modules;
`lab/probe-lab.json`, r6-007): for each tag on the SwiftUI ("iOS" tab) and Android renderers, a session with the recipe and one typed
style hook, one retained property update, every method, events. Live-host frames were also validated against the server's inspection
schema (`lab/frames`, r6-010) because the live-host scripts talk to the renderer directly.

| Probe | SwiftUI | Android |
| --- | --- | --- |
| md-breadcrumbs session + `separatorColor` hook | ok, hook visible (image differs from unhooked) | ok |
| update `maxItems: 2` | **frame rejected (`overflow` gap), session closed** | ok, frame changed |
| `expand()` / `collapse()` | **404 SESSION_NOT_FOUND** (R6-02) | mdExpand `{expanded: true/false, itemCount: 3}` |
| md-breadcrumb-item session + `linkColor`, update `disabled` | ok | ok |

Examples: the fork's 16 SwiftUI + 16 Compose examples and r6's 7 extra API examples (each slot, method and event of both tags) regenerated
from the snapshot: SwiftUI typecheck exit 0 (r6-007), Compose compile exit 0 (r6-A002; classes for all six files verified in r6-A004).

## Gate 6 — accessibility

tools/ax (cases `trail`, `collapsed`, `link`, `current`, `disabled`; `ax/`, r6-008 / r6-A003): macOS and iOS 0 open for md-breadcrumb-item;
md-breadcrumbs `collapsed` had 1 open `text-extra` ("AWC Native") on macOS and iOS in the first run because Chrome left the current crumb's
slotted text out of its tree; two Web reruns were clean (`ax-web1`, `ax-web2`, 0 open) — R6-15. Android: md-breadcrumbs 0 open (4 accepted) /
md-breadcrumb-item 0 open.

## Exceptions and expectations

No exception records are proposed. tools/ax expectations reviewed: navigation landmark missing on iOS / Android and the Android
label read as text — **accepted** (UIKit has landmarks only as container types; Compose has no landmark role; both verified in the captures).
Source-review decisions: toggle kept when nothing collapses, mdExpand cancel ignored, link-only hover nudge, current crumb as plain text —
accepted (Web behaviour reproduced); the native-only tooltip on truncated labels — not accepted (R6-12).

## Findings

| ID | Summary |
| --- | --- |
| R6-02 | md-breadcrumbs SwiftUI Laboratory preview lost after collapse (overflow gap metric) |
| R6-03 | CSS parts: no native part appearance and no exception record |
| R6-10 | md-breadcrumb-item `rel` without exception record |
| R6-12 | native-only tooltip on truncated breadcrumb labels |
| R6-07 | gate-6 iPad 26.3 / iOS 18.6 rows missing from the docs (r6 ran them) |
| R6-14 | CEM drift not regenerated |
| R6-15 | Chrome drops slotted text from its tree intermittently (tools/ax Web capture); slider reflected "false" booleans |

## Re-check

After the owning forks install fixes for the blocking findings, r6 re-runs the affected suites on a fresh snapshot and replaces this verdict.
