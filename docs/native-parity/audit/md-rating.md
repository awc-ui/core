# Gate 7 audit — md-rating

**Verdict: FAIL (findings)** — gate-7 reviewer r6, 2026-10-31.

Scope: `md-rating`. Independent re-run on the r6 snapshot `work/audit/r6-tree` (canonical copied 2026-10-31 02:12 Mac time, 42 installs,
latest fx-072 / fx-068 / n5-037; build products excluded and rebuilt). Job logs: `work/claude-runner/done/r6-*.log`; evidence:
[`work/audit/r6/`](../../../../audit/r6/) (`out/` suites, `gate1/` matrix, `lab/` Laboratory probes, `ax/` tools/ax, `examples/` compiled examples).
Defects: [work/audit/DEFECTS.md](../../../../audit/DEFECTS.md) (r6 section).

## Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | **Findings** | Matrix 17/2/1/0/13 + 6 parts. Gaps: parts (R6-03); `--md-rating-pop-scale`, `-duration`, `-state-layer-color`, `-icon-font-family` untested (R6-11). |
| 2 Implementation | Pass | Dedicated renderers; decisions 7–10, 12 accepted (Web behaviour reproduced). |
| 3 Laboratory | Pass | Both renderers: session, hook, value update, focusRating(); examples compile. (Hover preview cannot be shown: the preview takes clicks and keys only.) |
| 4 Behaviour | Pass (with R6-06) | Interaction model replays pass on all platforms; Android views 115/115 (with slider). |
| 5 Visual | **FAIL** | Paint counts compare the layout model, not the rendered views (R6-05). |
| 6 Runtime + a11y | Pass (doc R6-07) | macOS, iOS (3 runtimes, r6) and Android; tools/ax 0 open. |
| 7 Independent audit | This document | FAIL until R6-03, R6-05, R6-11 are resolved. |

## Re-runs (gates 2, 4, 5, 6) — claimed vs r6

Counts are each suite's own `passed/total`; suites that sample per rendered frame have device-dependent totals (all failures are listed).
The shared fixtures are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets (gzip assets after gunzip);
`tokens.css` copies equal `packages/tokens/src/tokens.css`.

| Suite | Claimed (doc / AUDIT row) | r6 result | Job |
| --- | --- | --- | --- |
| macOS `NativeSliderRatingIntegration` (model) paint / states / reduced / lifecycle | 113/113 · 16/16 · 16/16 · 13/13 | 113/113 · 16/16 · 16/16 · 13/13 | r6-003 |
| iOS harness `NativeSliderRatingIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 408/408 runs (slider + rating, iPhone only) | 408/408 runs / 408/408 runs / 408/408 runs | r6-005 / r6-011 |
| Android `SrParityTest` rating paint / states / reduced / lifecycle | 113/113 · 16/16 · 16/16 · 13/13 | 113/113 · 16/16 · 16/16 · 13/13 | r6-A001 |
| Android `SrViewsTest` / `LivePreviewSRHostTest` | 115/115 · 2/2 | 115/115 · 2/2 | r6-A001 |
| SwiftUI live host `test-live-sr.mjs` / snapshot | 27/27 · 6/6 | 27/27 · 6/6 | r6-008 |

## Gate 1 — source contract matrix

Built from `packages/core/src/components/<tag>/` (TSX + CSS) and `custom-elements.json` (the inventory regenerated from canonical, `gate1/current-inventory.json` (r6-006), carries the same contract; its declared support equals the policy files except md-slider's `inset-icon`, R6-04), every property (default / enum), event (payload / cancel), method, slot, CSS hook (CEM plus stylesheet-only `--md-<tag>-*` references) and part, mapped to the SwiftUI and Compose sources, the Laboratory (appearance modules, `native-property-updates.js`, `native-methods.js`, recipes, native-compiler policies) and tests (fixtures, oracles, Android tests, live-host and studio tests): [`gate1/matrix.md`](../../../../audit/r6/gate1/matrix.md) (helper `gate1/matrix.mjs`; every "none" cell was then checked by hand — form names live in `NativeForms.swift` / `AWCFormControls.kt`, slots in fixtures as `#symbol` children, events reach the Laboratory as frame events). The compiler catalog hashes match today's sources for every tag (no stale generated policy).

## Gate 3 — Laboratory

Laboratory probe through the running server (`http://127.0.0.1:4177`, requests built with the canonical Laboratory modules;
`lab/probe-lab.json`, r6-007): for each tag on the SwiftUI ("iOS" tab) and Android renderers, a session with the recipe and one typed
style hook, one retained property update, every method, events. Live-host frames were also validated against the server's inspection
schema (`lab/frames`, r6-010) because the live-host scripts talk to the renderer directly.

| Probe | SwiftUI | Android |
| --- | --- | --- |
| session (value 4, value label, lg) + `activeColor` hook, update `value: 2` | ok, hook visible, frame changed | ok, frame changed |
| `focusRating()` | ok | ok |

Examples: in fa's set (46 + 46): SwiftUI typecheck exit 0, Compose compile exit 0 (r6-A002, verified r6-A004).

## Gate 6 — accessibility

tools/ax (cases `default`, `half`, `readonly`, `disabled`, `soft-disabled`): 0 open on macOS and iOS. Android: 0 open.

## Exceptions and expectations

No exception records or expectations. Decisions 7 (press ripple under reduced motion), 8 (off-grid programmatic values), 10
(English defaults), 12 (assistive SetProgress rounding) — accepted.

## Findings

| ID | Summary |
| --- | --- |
| R6-03 | CSS parts: no native part appearance and no exception record |
| R6-05 | slider / rating / stepper paint evidence compares the layout model, not the rendered views |
| R6-06 | SR and stepper Swift fixtures not registered in test-native-views.sh; silent skip on a missing oracle |
| R6-11 | hooks without tests; slider value-indicator-reserve not in typed appearance / Laboratory |
| R6-07 | gate-6 iPad 26.3 / iOS 18.6 rows missing from the docs (r6 ran them) |

## Re-check

After the owning forks install fixes for the blocking findings, r6 re-runs the affected suites on a fresh snapshot and replaces this verdict.
