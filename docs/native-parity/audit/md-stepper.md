# Gate 7 audit — md-stepper (+ md-step)

**Verdict: FAIL (findings)** — gate-7 reviewer r6, 2026-10-31.

Scope: `md-stepper`, `md-step`. Independent re-run on the r6 snapshot `work/audit/r6-tree` (canonical copied 2026-10-31 02:12 Mac time, 42 installs,
latest fx-072 / fx-068 / n5-037; build products excluded and rebuilt). Job logs: `work/claude-runner/done/r6-*.log`; evidence:
[`work/audit/r6/`](../../../../audit/r6/) (`out/` suites, `gate1/` matrix, `lab/` Laboratory probes, `ax/` tools/ax, `examples/` compiled examples).
Defects: [work/audit/DEFECTS.md](../../../../audit/DEFECTS.md) (r6 section).

## Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | **Findings** | Matrix stepper 22/3/4/2/2 (gap + runtime-internal step-count) + 5 parts, step 15/3/0/1/23 (22 + runtime-internal idx) + 13 parts. Gaps: parts (R6-03); connector / expand / collapse durations untested (R6-11); CEM drift (R6-14). |
| 2 Implementation | Pass | Dedicated renderers; decisions 1–15 accepted (Web behaviour reproduced; 9 maps the media query to the screen width — see note). |
| 3 Laboratory | Pass | Both renderers: session, hook, update `active` → mdStepChange, next() / prev() → mdBeforeChange + mdStepChange, reset() → mdStepChange, goTo(2) refused while step 2 is unreachable (linear; source `canNavigateTo`, both platforms agree); examples compile. |
| 4 Behaviour | Pass (with R6-06) | Model replays (20 runs plain + reduced, events, cancel, announcements) pass on all platforms; Android views 93/93. |
| 5 Visual | **FAIL** | Paint counts compare the layout model, not the rendered views (R6-05). |
| 6 Runtime + a11y | **Needs evidence** | Suites pass on macOS, iOS (3 runtimes, r6) and Android; tools/ax 0 open; the macOS landmark expectation needs a probe or an implementation (R6-13). |
| 7 Independent audit | This document | FAIL until R6-03, R6-05, R6-11, R6-13 are resolved. |

## Re-runs (gates 2, 4, 5, 6) — claimed vs r6

Counts are each suite's own `passed/total`; suites that sample per rendered frame have device-dependent totals (all failures are listed).
The shared fixtures are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets (gzip assets after gunzip);
`tokens.css` copies equal `packages/tokens/src/tokens.css`.

| Suite | Claimed (doc / AUDIT row) | r6 result | Job |
| --- | --- | --- | --- |
| macOS `NativeStepperIntegration` (model): rungs + paint 142 + extra 6 + states 20 + reduced 20 | 189/189 (fa-063) | 189/189 | r6-003 |
| iOS harness `NativeStepperIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 189/189 (iPhone only) | 189/189 / 189/189 / 189/189 | r6-005 / r6-011 |
| Android `StepperParityTest` paint + extra / states / reduced | 142/142 + 6/6 · 20/20 · 20/20 | 142/142 + 6/6 · 20/20 · 20/20 (rungs 1/1) | r6-A001 |
| Android `StepperViewsTest` | 93/93 | 93/93 | r6-A001 |
| Android `LivePreviewStepperHostTest` | 2/2 | 2/2 | r6-A001 |
| SwiftUI live host `test-live-stepper.mjs` / snapshot | 38/38 · 6/6 | 38/38 · 6/6 (22/22 frames valid) | r6-008, r6-010 |

## Gate 1 — source contract matrix

Built from `packages/core/src/components/<tag>/` (TSX + CSS) and `custom-elements.json` (the inventory regenerated from canonical, `gate1/current-inventory.json` (r6-006), carries the same contract; its declared support equals the policy files except md-slider's `inset-icon`, R6-04), every property (default / enum), event (payload / cancel), method, slot, CSS hook (CEM plus stylesheet-only `--md-<tag>-*` references) and part, mapped to the SwiftUI and Compose sources, the Laboratory (appearance modules, `native-property-updates.js`, `native-methods.js`, recipes, native-compiler policies) and tests (fixtures, oracles, Android tests, live-host and studio tests): [`gate1/matrix.md`](../../../../audit/r6/gate1/matrix.md) (helper `gate1/matrix.mjs`; every "none" cell was then checked by hand — form names live in `NativeForms.swift` / `AWCFormControls.kt`, slots in fixtures as `#symbol` children, events reach the Laboratory as frame events). The compiler catalog hashes match today's sources for every tag (no stale generated policy).

## Gate 3 — Laboratory

Laboratory probe through the running server (`http://127.0.0.1:4177`, requests built with the canonical Laboratory modules;
`lab/probe-lab.json`, r6-007): for each tag on the SwiftUI ("iOS" tab) and Android renderers, a session with the recipe and one typed
style hook, one retained property update, every method, events. Live-host frames were also validated against the server's inspection
schema (`lab/frames`, r6-010) because the live-host scripts talk to the renderer directly.

| Probe | SwiftUI | Android |
| --- | --- | --- |
| session + `indicatorColor` hook, update `active: 1` | ok, hook visible, mdStepChange | ok, mdStepChange |
| `next()` / `prev()` | mdBeforeChange + mdStepChange `{2, 1}` / `{1, 2}` | same |
| `goTo(2)` | no event (step 2 unreachable in linear mode, as the source) | same |
| `reset()` | mdStepChange `{0, 1}` (no mdBeforeChange, decision 6) | same |
| md-step session + hook, update `completed` | ok, frame changed | ok, frame changed |

Examples: in fa's set (46 + 46, incl. the `content` slot): SwiftUI typecheck exit 0, Compose compile exit 0 (r6-A002, verified r6-A004).

## Gate 6 — accessibility

tools/ax (cases `horizontal`, `vertical`, `dot-nonlinear`, `mobile`, `readonly`, `standalone`): 0 open on macOS (11 accepted) and iOS
(9 accepted). Android: md-stepper 0 open (10 accepted) / md-step 0 open (1 accepted).

## Exceptions and expectations

No exception records are proposed. Expectations reviewed: decision 16 on iOS / Android (no landmark element) — accepted; decision 16
on macOS — **not accepted yet** (R6-13: a limit of the current bridge, not of AppKit); decision 17 (panels as named groups, word match) and
decision 9 (phone-width captions) — accepted; decision 18 (Chrome intermittently drops open-panel text) — accepted for native, reported to
the Web source (R6-15). Note on decision 9: the compact rule follows the screen width (macOS a fixed 1200), so a narrow macOS window or an
iPad split view never gets the compact row that a narrow browser viewport gets; consider the window (scene) width.

## Findings

| ID | Summary |
| --- | --- |
| R6-03 | CSS parts: no native part appearance and no exception record |
| R6-05 | slider / rating / stepper paint evidence compares the layout model, not the rendered views |
| R6-06 | SR and stepper Swift fixtures not registered in test-native-views.sh; silent skip on a missing oracle |
| R6-11 | hooks without tests; slider value-indicator-reserve not in typed appearance / Laboratory |
| R6-13 | md-stepper macOS landmark expectation needs evidence |
| R6-07 | gate-6 iPad 26.3 / iOS 18.6 rows missing from the docs (r6 ran them) |
| R6-14 | CEM drift not regenerated |
| R6-15 | Chrome drops slotted text from its tree intermittently (tools/ax Web capture); slider reflected "false" booleans |

## Re-check

After the owning forks install fixes for the blocking findings, r6 re-runs the affected suites on a fresh snapshot and replaces this verdict.
