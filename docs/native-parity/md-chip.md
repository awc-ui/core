# Chip parity checkpoint

Status: dedicated SwiftUI and Compose renderers replace the generic adapters in
production dispatch (`AWCNativeView` and `AWCComponent`). Public appearance and part
APIs exist on both platforms. The macOS and Android runtime checks below run against
trusted-input Chrome oracles. This is an implementation checkpoint (gates 1, 2, 4 and
5), not the final all-component audit or an iOS
runtime claim. Source review: [md-chip-source-review.md](md-chip-source-review.md);
plan: [md-chip-native-plan.md](md-chip-native-plan.md).

## Source (gate 1)

The source has eight defects, (a)–(h). Each was fixed test-first and mirrored
into `packages/core/src`:

* (a) A disabled filled chip drew an outline.
* (b) A colour value that is not a role tinted the chip.
* (c) and (d) Selected chips ignored the state-layer and selected-colour hooks.
* (e) A selected filled or elevated chip lost its selected container.
* (f) Disabled colour-role chips kept the role content colours.
* (g) A disabled filled chip kept its full container.
* (h) Leading or trailing icons slotted before the first render were never
  detected, so the padding and the checkmark ignored them.

Results on the Mac:

* md-chip spec, e2e, cascade and slots: 106/106.
* Chip consumers (autocomplete, multi-select, tab, hidden-attribute): 262/262.

## Browser reference (gate 2)

All captures are in `outputs/native-parity/md-chip/web-oracle/` (Chrome 153 on
macOS, DPR 1, trusted CDP input):

* Paint: 452 cases with 451 shots.
* States: 45 runs with per-frame samples, transition records and phase shots.
* Reduced motion: 5 runs.

The provisional Linux capture matches it, apart from values that do not affect
rendering (`cloud-vs-mac.txt`). A Python port of the native cascade reproduces
all 449 paint cases with colours.

## Renderers and APIs (gate 4)

* Swift: `NativeChip.swift` (`AWCChipModel`, `AWCChipStyle`, `AWCChipRowLayout`,
  `AWCNativeChip` and `AWCNativeView.nativeChip`) and `ChipAppearance.swift`
  (`AWCChipHookAppearance`, `AWCChipPartAppearance` and the
  `awcChipAppearance` / `awcChipPartAppearance` / `awcChipReducedMotion` /
  `awcChipStretch` modifiers).
  * `AWCNativeView` routes `md-chip` to `nativeChip`.
  * md-chip is excluded from the generic `.disabled` wrapper, so soft-disabled
    chips stay focusable and hoverable.
  * The old `chip` adapter in Actions.swift no longer has a caller.
* Compose: `NativeChip.kt` (`ChipModel`, `ChipStyle`, `NativeChip`, `ChipLabel`)
  with `AWCChipHookAppearance`, `AWCChipPartAppearance` and the scopes for
  appearance, parts, reduced motion, stretch and inspection.
  * `AWCComponent` dispatches `"md-chip" -> NativeChip(p, onEvent, content)`;
    that is the only change to an existing file.
* Both platforms:
  * **Events:** `mdRemove` is a cancelable action event: the chip removes
    itself unless a listener prevents it. `mdSelect` comes before `mdClick`.
  * **Keys:** Enter and Space activate. Delete and Backspace remove from the
    chip or from ✕; Enter, Space, Delete and Backspace on ✕ remove.
  * **Roles:** a button-role chip, a group-role chip with a primary action and
    ✕, and a display token.
  * **Focus:** focus-visible rings, with pointer focus not counted as
    focus-visible.
  * **Ripple and layer:** the md-ripple timing, and the source's 50 / 100 ms
    state-layer and colour transitions, removed under reduced motion (the
    ripple still plays, as in Chrome).

## Results (gate 5)

| Check | Swift (macOS, AppKit host) | Android (emulator, API 36) |
| --- | --- | --- |
| Paint, geometry, colours, shadow, parts, roles, every flat pixel (452 cases) | 9930/9930 | 11786/11786 |
| Interaction, per-frame against Chrome samples, events, focus, removal, phase paint (45 + 5 runs) | 161105/161106 staged, 131791/131792 in the full run (the per-frame count depends on frame timing) | 36753/36754 |
| Dispatch through the production view (`AWCNativeView` / `AWCComponent`) | in the paint run | the whole paint run goes through `AWCComponent` |

**Full suites.**

* Swift:
  * View fixtures: 54/55 pass; the failure is NativeChipStatesIntegration, the
    open item below.
  * All 8 package scripts pass (badge, behavior, button, button-hosts,
    divider, fab-menu, preview, status-dot).
  * button-hosts and preview first failed because the cached package graph of
    `apps/native-ios-playground` predated NativeChip.swift. They pass after a
    clean (job 515).
  * The iOS simulator build fails only in the existing UIKit errors in
    TooltipNativeAccessibility.swift, which the iOS-enablement fork owns. No
    chip file reports an error.
* Android:
  * Device suite: 269 tests, 7 failures:
    * the 5 known existing failures;
    * the chip open item;
    * NativeAccordionStatesTest's grip-drag frame timing. Rerun alone, that
      test passes 3/3.
  * Unit tests: 195/195.
* The Chrome fixtures are byte-identical across the two platforms: 3 JSON files
  plus 451 paint, 291 states and 37 reduced-motion shots.

Evidence is under `outputs/native-parity/md-chip/`:

* `native-swift/`: paint-results.json, states-results.json, captures and run logs.
* `native-android/`: device evidence JSON, XML and logs.
* `native-swift/full/` and `native-android/full/`: the full-suite runs.
* `checkpoint.json` in each platform folder.

## Known differences

* Android arrow keys move focus (2D focus search); Chrome keeps focus on the
  chip. The interaction test does not send the arrow there.
* Android `AWCComponent` hands renderers only the resolved density. A local −1
  chip under an inherited −2…−4 scope therefore keeps the 0/−1 spacing tokens
  there. Swift matches the source; Android checks the −1 scale for that case.
* A keyboard activation that changes the chip's width (a filter chip gaining its
  checkmark) keeps Chrome's ripple at the box from before the toggle. The native
  wave uses the new box, so the ripple origin/diameter check skips that case.
* On Android, label text advances differ from Chrome by up to 1 px. The label box
  and, in RTL, the positions laid out after it are compared to 1 px.
* Closed 2026-10-28: `displayToken/clickBody` phase paint (was mean 1.32 vs 1.0 on both
  platforms). Chrome photographs a phase anywhere between its last sample and the next
  phase (`shotStart`/`shotEnd`, now recorded); the wave fades during that window. Both tests
  compare the native frames inside Chrome's window (best-of, frame time reported). On Android
  the pointer steps anchored to Chrome's animation start fired at that frame, one frame late
  (Chrome's start time is already the first frame after its input); they now fire one frame
  earlier. Quiet runs: macOS states 143,027/143,027, Android interaction 36,754/36,754.

## Laboratory (gate 3)

Complete 2026-10-26: see [selection-laboratory.md](selection-laboratory.md). The twelve hooks (px in the Laboratory; SwiftUI also takes em, rem and ch), all fourteen properties as retained updates (variant, appearance and contentAlign enumerations), eight typed part targets (`::part(primary)` typed since gate-7 R4-09, see below), the three slots and the three events. The display-token click-end paint case remains open (below).

The SwiftUI chip's inspection metric for its content gap is now `contentGap` (it was `gap`, which the Laboratory's inspection schema reserves for a `{row, column}` record, so every SwiftUI chip live frame was rejected; found by `test-live-preview` in the gate-3 run). The chip paint fixture reads the new key: 9,930/9,930.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeChipPaintIntegration` | **9930/9930** | **9930/9930** | **9930/9930** |
| `NativeChipStatesIntegration` | **151923/151923** | 154439/154440 | **150663/150663** |
| **Total** | **161853/161853** | 164369/164370 | **160593/160593** |

Chip states pass on iOS 26.3 and iOS 18.6; the iPad keeps one click-shot pixel check (`displayToken … clickBody`).

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->

## Gate-7 R4-09: `::part(primary)` (2026-11-04)

The input chip's primary action overlay (rendered with a remove button) is now a native styling target on SwiftUI and Compose:
`AWCChipPartAppearance(primaryBackground:, primaryOutlineStyle:, primaryOutlineColor:, primaryOutlineWidth:, primaryOutlineOffset:)`.
The background paints above the state layer and below the label (the source's z-index 2 overlay). The outline follows CSS: with no
style set it is the source's focus-visible ring (3px solid secondary, offset −3) and the colour / width / offset fields restyle that ring
(an author `::part(primary){outline-color:…}` rule); `primaryOutlineStyle: "solid"` draws it at rest, as an author `outline:` shorthand does.
Evidence: Chrome 153 case `parts-primary` (`outputs/native-parity/md-chip/web-oracle-d4`, the other 452 snaps unchanged) added to the
oracle and both fixtures; SwiftUI chip paint 9954/9954, chip states 144576/144576 (`work/d4-lab/runs/017`, `018`), Android chip parity,
interaction and selection host 6/6 classes (`runs/A011`); copyable SwiftUI/Compose part examples in the Laboratory (`native-api-examples.js`).
