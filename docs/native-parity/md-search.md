# Search parity checkpoint (md-search)

Status (n3, 2026-11-15): dedicated SwiftUI (macOS + iOS) and Compose renderers (`NativeSearch.swift`, `NativeSearch.kt`) built on
the installed md-text-field primitive, with typed appearance and part APIs, against Mac Chrome 153 oracles. Source review:
[md-search-source-review.md](md-search-source-review.md); plan: [md-search-native-plan.md](md-search-native-plan.md).
Open for gate 7: the exception `md-search-ios-open-gap` (below, with its macOS extension) and the reviewed accessibility
expectations marked `pending gate-7 review`. The Laboratory probe (port 4177) is run by the coordinator.

## Evidence (story 1-2; job names in `work/claude-runner/done/`)

- Paint (Chrome oracles, 7186 checks incl. the typed `::part` cases): macOS and iPhone 17 Pro iOS 26.3 7186/7186
  (`1-2-md-search-finish-and-install-038-mac-ios-paint-parts3`); Android 7050/7050 (`...-A031-parts3-android`); iPad Pro 11 M5 iOS 26.3
  6936/6936 on the earlier source (`...-023-final-ios-ipad-mac`; rerun on the final source is listed as open in the story).
- States (766 checks): Android 766/766 (A031); macOS 762-765/766 over three quiet-Mac runs (`...-028`, `...-036`), iPhone 762/766
  (`...-037`); every remaining miss is a `PENDING gate-7 review` frame of the exception below.
- Laboratory live host (SwiftUI): 30/30 (`...-033-mac-parts2-ax4-rerun`); Android host test accepts `height` for md-search.
- Typed parts: all 19 CSS parts have typed native targets on SwiftUI and Compose (`AWCSearchPartAppearance`) with a Chrome
  `::part` oracle case each (`search-web-parts.json`; the `status` part is visually hidden and has a no-paint case).

## Accessibility (tools/ax, final)

- macOS and iOS: 0 open findings (`...-038`). Fixed in the renderers: iOS empty state is static text announced politely; only
  `slot="results"` is rendered (the source has no default slot); the panel is a labelled container / pane; Compose combobox
  expand / collapse actions; macOS duplicate icon-button elements removed.
- Reviewed conventions (`tools/ax/expectations.mjs`, md-search entries, same pattern as md-autocomplete / md-date-picker):
  role combobox -> textbox (iOS, Android), macOS controls relation, macOS dialog -> group and its modal state, Tab order starts
  from the input that holds focus at mount (the source focuses it at load when `open` is set), input non-text contrast, and the
  Android icon-trigger dialog pairing and disabled-case items (the Compose semantics tree holds the Clear button and panel,
  job `...-A034-disabled-diag`: closedClear=1 openClear=1 openEmpty=1 panes=1; the probe lists none of them while disabled).
  Each carries the reason `Pending gate-7 review`.

## Exceptions

### md-search-ios-open-gap (proposed 2026-11-15, story 1-2 session 5; reviewer acceptance pending: story 7-11)

- *Source behaviour:* opening md-search (bar click, icon-trigger click, typing into a closed bar) starts the panel / bar
  reveal transitions in the frame of the click; Chrome draws every 16.7 ms frame of the reveal (Mac Chrome 153 oracle
  `outputs/native-parity/md-search/web-oracle-mac`, states fixture).
- *Affected platform / API:* iOS 26.3 Simulator (iPhone 17 Pro, iPad Pro 11-inch M5), SwiftUI on UIKit. Not macOS, not Android
  (Android states 766/766, n3-A069).
- *Technical reason (measured):* after an open the simulator draws no new frame for 50-100 ms. Job 021 trace
  (`diag/focus-trace.py`, click-icon-opens): applyOpen +9 ms after the press; the open's run-loop iteration is busy 52 ms
  (the modal entry's view tree is created: bar, field, results); focusing the new UITextField 15 ms; the reveal starts on time
  but its first two frames take 45 ms and 42 ms of main-thread work (first drawing of the bar / panel layers), steady frames
  12-13 ms. The frames that are drawn carry values on Chrome's curve for their time (timed from the press, fix12). Ruled out:
  the accessibility runtime (job 009, AX off: same misses), the delivered-input timing (ios-harness.md item 31, queue anchor,
  job 012), a single code hotspot (sample(1), jobs 011 / 020), per-frame body cost (fix15: AWCSearchAppearance.merging 111 -> 0,
  AWCSearchModel.init 63 -> 2 samples, no change in the misses), a stale modal entry (fix11, fix14), drawing at opacity 0
  before the reveal (fix18: no change). Options not taken: pre-building the full-screen entry while closed needs a change of
  the shared AWCModalScope contract (an entry means an active modal: scrim, focus trap, inert background).
- *User impact:* on an iOS device the first 50-100 ms of the open reveal (opacity / slide of the bar and panel) may show fewer
  intermediate frames than Chrome; the end state, timing of the transition's later frames, focus, events and announcements
  are unchanged. No functional difference.
- *Tested native equivalent:* the same reveal (duration, easing, start time) on SwiftUI; every drawn frame inside Chrome's
  envelope. macOS paint 6936/6936, iOS paint 6936/6936 (jobs 017, 018, 020).
- *Scope (fixture):* `NativeSearchStatesIntegration` on iOS only: a Chrome frame outside the native envelope is reported as
  `PENDING gate-7 review (md-search-ios-open-gap)` instead of failing only when the phase is an opening phase (click-bar,
  click-bar-focus, click-bar-opens, click-icon-opens, type-x-opens) and the native drawn frames around it are 50 ms or more
  apart (`drawGap`). Every other miss fails. `AWC_SEARCH_PENDING=0` runs the strict check.
- *Evidence:* `work/n3-lab/search2/out/1-2-017`, `1-2-018`, `1-2-020`, `1-2-021` (trace in `traced-console.log`), `1-2-022`;
  job logs `work/claude-runner/done/1-2-md-search-finish-and-install-0{17,18,20,21,22}-*.log`.
- *Reviewer:* gate-7 reviewer of story 7-11 (accepts or rejects; until then the cases are pending, not passed).
- *Final measurement (job 023, 2026-11-15, Mac load average 120-490, outputs `out/1-2-023`):* iPhone 17 Pro 26.3 paint
  6936/6936, states 760, 761, 760 /766; iPad Pro 11 (M5) 26.3 paint 6936/6936, states 764, 762, 763 /766. With the pending rule
  1-3 frames per run are reported pending (click-icon-opens, reduced click-bar-opens); the rule does NOT cover the remaining
  misses, which are the same rendering behaviour at a smaller scale: (a) the first frame after a long gap (click-icon-opens
  t=133 after a 171 ms gap, iPad states1) and docked click-bar-focus t=150-166 (native one frame behind, iOS drawing at ~30 fps
  there, gap 33 ms < 50 ms); (b) closing phases (Escape-closes, outside-click-closes, leading-back-closes): the same gap after
  the close (fullscreen-divided Escape-closes: native frames t=-3 then t=64); (c) clear-loading loading-off (30 fps, values ~5-10 ms
  behind). The rule was not widened (coordinator note 2026-11-14: no further tolerance widening). Reviewer options: accept the
  exception for opening AND closing phases with a gap measured over the phase's first 200 ms (a wider rule than the one
  implemented), or require a run on an unloaded Mac first.

#### macOS extension: one-frame boundary misses (coordinator decision 1, 2026-11-15; story 1-2 session 8; pending gate-7 review)

The same proposal covers the macOS misses, which are the same behaviour at a smaller scale: the native renderer draws no frame for
20-99 ms around one Chrome frame. Three runs of `NativeSearchStatesIntegration` on macOS (job `1-2-md-search-finish-and-install-028-mac-quiet-x3`,
outputs `out/1-2-028`; the Mac was NOT quiet: 1-minute load 37.5 / 23.2 / 19.9 before the runs and 23.2 / 19.9 / 212 after them, so these
are load-affected runs on a busy Mac, not unloaded ones). Per miss: check, Chrome value (`want`), native envelope, relation to Chrome's neighbouring frames.

| Run | States | Check (case, phase, frame, quantity) | Chrome value | Native range | Relation |
|---|---|---|---|---|---|
| 1 | 763/766 | fullscreen-contained click-bar-opens t=83 bar opacity | 0.8005 | 0.902-1.0 | Chrome's dip minimum (frames t=67 0.963, t=83 0.801, t=100 0.932); native frames t=68 and t=100 are on the curve of the neighbouring frames, none at t=83 |
| 1 | | docked-contained-ltr (reduced) Escape-closes t=33 panel opacity | 0.0 | 1.0-1.0 | native still 1.0 = Chrome's value one frame earlier (the reduced close is instant in Chrome at t=33; native draws it later) |
| 1 | | docked-contained-rtl (reduced) Escape-closes t=33 panel opacity | 0.0 | 1.0-1.0 | same |
| 2 | 762/766 | fullscreen-contained click-bar-opens t=83 bar opacity | 0.8005 | 0.968-1.0 | dip minimum as run 1 |
| 2 | | fullscreen-divided click-bar-opens t=83 bar opacity | 0.8009 | 0.853-1.0 | dip minimum as run 1 |
| 2 | | docked-divided-rtl (reduced) Escape-closes t=33 panel opacity | 0.0 | 1.0-1.0 | one frame earlier |
| 2 | | fullscreen-contained (reduced) Escape-closes t=33 panel opacity | 0.0 | 1.0-1.0 | one frame earlier |
| 3 | 763/766 | fullscreen-contained click-bar-opens t=83 bar opacity | 0.8005 | 0.943-1.0 | dip minimum as run 1 |
| 3 | | docked-contained-ltr (reduced) Escape-closes t=33 panel opacity | 0.0 | 1.0-1.0 | one frame earlier |
| 3 | | fullscreen-contained (reduced) Escape-closes t=33 panel opacity | 0.0 | 1.0-1.0 | one frame earlier |

Run 1 to 3 together: the click-bar-opens dip (Chrome's single frame at t=83, native drawing t=68 then t=100 while the full-screen view is first built) fails in
3 of 3 runs for fullscreen-contained and in 1 of 3 for fullscreen-divided; the reduced Escape-closes frame t=33 fails in every run for 2 of the
docked / full-screen cases, which cases changes per run. Earlier quiet-Mac run (job 027, Mac load 0.2): the reduced close landed one frame EARLY there (native
panel already 0 where the envelope held 1.0), so the direction depends on load; every miss is within one Chrome frame (16.7 ms) of the value Chrome shows.
- *Scope (fixture):* `search-test-pending2.py`: on macOS the states fixture reports a miss as `PENDING gate-7 review (md-search-ios-open-gap, macOS one-frame boundary)`
  instead of failing only for the phases click-bar-opens and Escape-closes when the native drawn frames around it are 20-99 ms apart. No tolerance changed; every
  other macOS miss fails; `AWC_SEARCH_PENDING=0` is strict.
- *Reviewer options:* accept (the end states and every drawn frame are on Chrome's curve), or reject with a fix story (pre-building the full-screen view while closed,
  the same option as on iOS, which needs a change of the shared AWCModalScope contract).
