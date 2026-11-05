# Gate 7 audit — md-slider

**Verdict: FAIL (findings)** — gate-7 reviewer r6, 2026-10-31.

Scope: `md-slider` (shares its support code with md-rating). Independent re-run on the r6 snapshot `work/audit/r6-tree` (canonical copied 2026-10-31 02:12 Mac time, 42 installs,
latest fx-072 / fx-068 / n5-037; build products excluded and rebuilt). Job logs: `work/claude-runner/done/r6-*.log`; evidence:
[`work/audit/r6/`](../../../../audit/r6/) (`out/` suites, `gate1/` matrix, `lab/` Laboratory probes, `ax/` tools/ax, `examples/` compiled examples).
Defects: [work/audit/DEFECTS.md](../../../../audit/DEFECTS.md) (r6 section).

## Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | **Findings** | Matrix 28/6/0/1/24 (23 CEM hooks + `--md-slider-value-indicator-reserve`) + 8 parts. Gaps: `inset-icon` slot unsupported without an exception record (R6-04); parts (R6-03); three hooks untested and the reserve hook missing from the typed appearance / Laboratory (R6-11). |
| 2 Implementation | **Finding** | Dedicated renderers; decisions 1–4, 6, 9, 11, 12, 14 accepted (Web behaviour reproduced); decision 5 diverges from Web for `="false"` attributes (R6-15). |
| 3 Laboratory | **Finding** | Both renderers: session, hook, value update; 14/14 live frames valid; examples compile. But the generated support (compiler catalog / IR) declares the `inset-icon` slot supported, so the Laboratory offers a copyable slot example that renders nothing (R6-04). (No methods; the preview takes clicks and keys only.) |
| 4 Behaviour | Pass (with R6-06) | Interaction model replays (pointer / keyboard / touch, events and order, lifecycle, form reset) pass on all platforms; Android views 115/115. Swift slider form names are only covered by `NativeBehaviorViewIntegration`, which traps before them on canonical (R1-02). |
| 5 Visual | **FAIL** | Paint counts compare the layout model, not the rendered views (R6-05). |
| 6 Runtime + a11y | Pass (doc R6-07) | macOS, iOS (3 runtimes, r6) and Android; tools/ax 0 open with 2 reviewed expectations. |
| 7 Independent audit | This document | FAIL until R6-03, R6-04, R6-05, R6-11 are resolved. |

## Re-runs (gates 2, 4, 5, 6) — claimed vs r6

Counts are each suite's own `passed/total`; suites that sample per rendered frame have device-dependent totals (all failures are listed).
The shared fixtures are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets (gzip assets after gunzip);
`tokens.css` copies equal `packages/tokens/src/tokens.css`.

| Suite | Claimed (doc / AUDIT row) | r6 result | Job |
| --- | --- | --- | --- |
| macOS `NativeSliderRatingIntegration` (model) paint / states / reduced / lifecycle | 188/188 · 22/22 · 22/22 · 18/18 (fa-057) | 188/188 · 22/22 · 22/22 · 18/18 | r6-003 |
| iOS harness `NativeSliderRatingIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 408/408 runs (slider + rating, iPhone only) | 408/408 runs / 408/408 runs / 408/408 runs | r6-005 / r6-011 |
| Android `SrParityTest` slider paint / states / reduced / lifecycle | 188/188 · 22/22 · 22/22 · 18/18 (fa-A026/A030) | 188/188 · 22/22 · 22/22 · 18/18 | r6-A001 |
| Android `SrViewsTest` (slider + rating) | 115/115 | 115/115 | r6-A001 |
| Android `LivePreviewSRHostTest` | 2/2 | 2/2 | r6-A001 |
| SwiftUI live host `test-live-sr.mjs` / snapshot `test-snapshot-sr.mjs` | 27/27 · 6/6 | 27/27 · 6/6 (14/14 frames valid) | r6-008, r6-010 |

## Gate 1 — source contract matrix

Built from `packages/core/src/components/<tag>/` (TSX + CSS) and `custom-elements.json` (the inventory regenerated from canonical, `gate1/current-inventory.json` (r6-006), carries the same contract; its declared support equals the policy files except md-slider's `inset-icon`, R6-04), every property (default / enum), event (payload / cancel), method, slot, CSS hook (CEM plus stylesheet-only `--md-<tag>-*` references) and part, mapped to the SwiftUI and Compose sources, the Laboratory (appearance modules, `native-property-updates.js`, `native-methods.js`, recipes, native-compiler policies) and tests (fixtures, oracles, Android tests, live-host and studio tests): [`gate1/matrix.md`](../../../../audit/r6/gate1/matrix.md) (helper `gate1/matrix.mjs`; every "none" cell was then checked by hand — form names live in `NativeForms.swift` / `AWCFormControls.kt`, slots in fixtures as `#symbol` children, events reach the Laboratory as frame events). The compiler catalog hashes match today's sources for every tag (no stale generated policy).

## Gate 3 — Laboratory

Laboratory probe through the running server (`http://127.0.0.1:4177`, requests built with the canonical Laboratory modules;
`lab/probe-lab.json`, r6-007): for each tag on the SwiftUI ("iOS" tab) and Android renderers, a session with the recipe and one typed
style hook, one retained property update, every method, events. Live-host frames were also validated against the server's inspection
schema (`lab/frames`, r6-010) because the live-host scripts talk to the renderer directly.

| Probe | SwiftUI | Android |
| --- | --- | --- |
| session (recipe: value 65, labeled, md) + `activeColor` hook | ok, hook visible | ok |
| update `value: 30` | ok, frame changed | ok, frame changed |

Examples: fa's 46 + 46 (slider, rating, stepper, step: usage, theme, hooks, variant, every supported method, event and slot) regenerated
from the snapshot: SwiftUI typecheck exit 0 (r6-007), Compose compile exit 0 (r6-A002; classes for all six files verified in r6-A004).

## Gate 6 — accessibility

tools/ax (cases `default`, `range`, `valuetext`, `vertical`, `disabled`): 0 open on macOS (2 accepted) and iOS (1 accepted). Android:
0 open (2 accepted).

## Exceptions and expectations

No exception records are proposed. Decision 13 (`inset-icon` slot not rendered) is not an exception record and is implementable —
**not accepted** (R6-04). The policy lists `inset-icon` both in `slots` and in `unsupportedSlots`; the compiler derives support from `slots`
only, so the catalog, the IR, the inventory and the Laboratory report the slot as supported. Expectations reviewed: `valuetext` (CDP's valuetext never carries aria-valuetext; fa-057 probe) and the disabled
value-label contrast equal to the Web ratio (2.06:1, WCAG 1.4.3 exemption) — accepted.

## Findings

| ID | Summary |
| --- | --- |
| R6-03 | CSS parts: no native part appearance and no exception record |
| R6-04 | md-slider `inset-icon` slot unsupported, implementable, no exception record; generated support claims it supported |
| R6-05 | slider / rating / stepper paint evidence compares the layout model, not the rendered views |
| R6-06 | SR and stepper Swift fixtures not registered in test-native-views.sh; silent skip on a missing oracle |
| R6-11 | hooks without tests; slider value-indicator-reserve not in typed appearance / Laboratory |
| R6-07 | gate-6 iPad 26.3 / iOS 18.6 rows missing from the docs (r6 ran them) |
| R6-15 | Chrome drops slotted text from its tree intermittently (tools/ax Web capture); slider reflected "false" booleans |

## Re-check

After the owning forks install fixes for the blocking findings, r6 re-runs the affected suites on a fresh snapshot and replaces this verdict.
