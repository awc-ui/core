# Gate 7 audit — md-toolbar

**Verdict: FAIL (findings)** — gate-7 reviewer r6, 2026-10-31.

Scope: `md-toolbar`. Independent re-run on the r6 snapshot `work/audit/r6-tree` (canonical copied 2026-10-31 02:12 Mac time, 42 installs,
latest fx-072 / fx-068 / n5-037; build products excluded and rebuilt). Job logs: `work/claude-runner/done/r6-*.log`; evidence:
[`work/audit/r6/`](../../../../audit/r6/) (`out/` suites, `gate1/` matrix, `lab/` Laboratory probes, `ax/` tools/ax, `examples/` compiled examples).
Defects: [work/audit/DEFECTS.md](../../../../audit/DEFECTS.md) (r6 section).

## Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | **Findings** | Matrix 8/0/1/4/11 + 2 parts. Gap: parts `container`, `fab-container` (the component doc says "no parts"; R6-03). |
| 2 Implementation | Pass | Dedicated renderers; decisions accepted. |
| 3 Laboratory | **FAIL** | The SwiftUI preview never opens through the Laboratory server: every frame is rejected as invalid layout measurements (R6-01). Android: session, hook, update, setFocus() pass. 11+11 examples compile. |
| 4 Behaviour | Pass | States suites (roving focus, re-sync, pointer, RTL) and host tests pass. |
| 5 Visual | Pass | Rendered views measured against Chrome 153 (116 paint cases + 3 aria-labelledby checks). |
| 6 Runtime + a11y | Pass (doc R6-07) | macOS, iOS (3 runtimes, r6) and Android pass; tools/ax 0 open with accepted expectations. |
| 7 Independent audit | This document | FAIL until R6-01 and R6-03 are resolved. |

## Re-runs (gates 2, 4, 5, 6) — claimed vs r6

Counts are each suite's own `passed/total`; suites that sample per rendered frame have device-dependent totals (all failures are listed).
The shared fixtures are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets (gzip assets after gunzip);
`tokens.css` copies equal `packages/tokens/src/tokens.css`.

| Suite | Claimed (doc / AUDIT row) | r6 result | Job |
| --- | --- | --- | --- |
| macOS `NativeToolbarPaintIntegration` | 7,466/7,466 | 7466/7466 | r6-003 |
| macOS `NativeToolbarStatesIntegration` | 2,255/2,255 | 2255/2255 | r6-003 |
| iOS harness `NativeToolbarPaintIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 7,466/7,466 (iPhone only) | 7466/7466 / 7466/7466 / 7466/7466 | r6-005 / r6-011 |
| iOS harness `NativeToolbarStatesIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 2,255/2,255 (iPhone only) | 2255/2255 / 2255/2255 / 2255/2255 | r6-005 / r6-011 |
| Android `NativeToolbarParityTest` paint / states | 6,999/6,999 · 1,904/1,904 | 6999/6999 · 1904/1904 | r6-A001 |
| Android `LivePreviewNavHostTest` | 2/2 | 2/2 | r6-A001 |
| SwiftUI live host `test-live-nav.mjs` | 29 checks | 29/29 (**10/10 frames fail the server schema**, R6-01) | r6-008, r6-010 |

## Gate 1 — source contract matrix

Built from `packages/core/src/components/<tag>/` (TSX + CSS) and `custom-elements.json` (the inventory regenerated from canonical, `gate1/current-inventory.json` (r6-006), carries the same contract; its declared support equals the policy files except md-slider's `inset-icon`, R6-04), every property (default / enum), event (payload / cancel), method, slot, CSS hook (CEM plus stylesheet-only `--md-<tag>-*` references) and part, mapped to the SwiftUI and Compose sources, the Laboratory (appearance modules, `native-property-updates.js`, `native-methods.js`, recipes, native-compiler policies) and tests (fixtures, oracles, Android tests, live-host and studio tests): [`gate1/matrix.md`](../../../../audit/r6/gate1/matrix.md) (helper `gate1/matrix.mjs`; every "none" cell was then checked by hand — form names live in `NativeForms.swift` / `AWCFormControls.kt`, slots in fixtures as `#symbol` children, events reach the Laboratory as frame events). The compiler catalog hashes match today's sources for every tag (no stale generated policy).

## Gate 3 — Laboratory

Laboratory probe through the running server (`http://127.0.0.1:4177`, requests built with the canonical Laboratory modules;
`lab/probe-lab.json`, r6-007): for each tag on the SwiftUI ("iOS" tab) and Android renderers, a session with the recipe and one typed
style hook, one retained property update, every method, events. Live-host frames were also validated against the server's inspection
schema (`lab/frames`, r6-010) because the live-host scripts talk to the renderer directly.

| Probe | SwiftUI | Android |
| --- | --- | --- |
| session (recipe: floating "Formatting") with and without `containerColor` | **502 INVALID_LIVE_FRAME** — `padding` / `margin` / `gap` reported as numbers (R6-01) | ok |
| update `variant: docked`, `setFocus()` | not reachable | ok, frame changed |

Examples: 11 SwiftUI + 11 Compose (incl. the leading / trailing / fab slots): SwiftUI typecheck exit 0 (r6-007), Compose compile exit 0 (r6-A002; classes for all six files verified in r6-A004).

## Gate 6 — accessibility

tools/ax (cases `default`, `docked`, `vertical`, `generic`): 0 open on macOS (1 accepted) and iOS (4 accepted). Android: 0 open (10 accepted).

## Exceptions and expectations

No exception records (the doc states none). Expectations reviewed: the divider exposed as "Separator" text, Android label and
divider as text, Android ATF touch-target size (44 dp pitch equals the Web geometry) — accepted.

## Findings

| ID | Summary |
| --- | --- |
| R6-01 | md-toolbar SwiftUI Laboratory preview rejected (inspection metrics schema) |
| R6-03 | CSS parts: no native part appearance and no exception record |
| R6-07 | gate-6 iPad 26.3 / iOS 18.6 rows missing from the docs (r6 ran them) |

## Re-check

After the owning forks install fixes for the blocking findings, r6 re-runs the affected suites on a fresh snapshot and replaces this verdict.
