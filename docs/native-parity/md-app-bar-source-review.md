# App bar source review (md-app-bar)

Status: Gate 1 (Web source contract checkpoint). The contract is inventoried. Four source defects
were fixed test-first and mirrored into `packages/core/src` (hash-verified). `dist` was not touched.
The browser reference is **provisional**: Linux headless Chromium 141, to be recaptured on the Mac
with Chrome 153. Native renderers have not been started.

## Public contract

| Property | Attribute | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `variant` (reflected) | `small` | `small`, `medium`, `large`, `search` |
| `titleAlignment` | `title-alignment` (reflected) | `start` | `start`, `center` |
| `searchPlaceholder` | `search-placeholder` | `'Search'` | The input placeholder, and the accessible-name fallback. |
| `searchValue` | `search-value` (mutable, reflected) | `''` | Two-way. |
| `searchAriaLabel` | `search-aria-label` | `''` | The name falls back to the placeholder, then to "Search". |
| `searchDisabled` | `search-disabled` (reflected) | false | |
| `headline` | `headline` (reflected) | `''` | A non-empty prop wins over the `headline` slot. |
| `subtitle` | `subtitle` (reflected) | `''` | Ignored on `search`. |
| `scrolled` | `scrolled` (reflected) | false | The author wires it up; the component does not observe scrolling. |
| `density` | `density` (reflected) | `0` | 0 to −4 |
| `leadingIcon` | `leading-icon` | `''` | Renders an `md-icon-button part="leading-icon"` unless a `leading` slot is present. |
| `leadingIconLabel` | `leading-icon-label` | `''` | The leading button's `aria-label`. |

**Events.** All three are bubbling, composed and cancelable (Stencil defaults):

- `mdLeadingClick (MouseEvent)` fires from the prop leading button. A pointer click is trusted.
  Enter or Space go through a synthetic, untrusted `click`.
- `mdSearchActivate {value}` fires on focus (including a pointer focus), on Enter (default
  prevented) and on Space. Space is **not** prevented, so it types; the value is read before the
  character lands.
- `mdSearchInput {value}` fires on every input.

Disabled search emits nothing and is not focusable.

**Slots, parts and hooks:**

- **Slots:** `leading`, `headline`, `subtitle`, `trailing` (at most 3 shown), `search` (replaces
  the input) and `search-trailing` (in the pill; from the second item on, items hide under 600px
  unless they carry `data-compact-keep`).
- **Parts (17):** `row`, `leading`, `leading-icon`, `icon`, `state-layer`, `title`, `subtitle`,
  `trailing`, `search-host`, `search`, `search-state-layer`, `search-field`, `search-input`,
  `search-content`, `search-trailing`, `expanded` and `expanded-headline`.
- **CSS hooks (38):** see the CSS header. All 38 were checked one by one in the oracle. The two that
  had no effect are fixed (fix 3 and fix 4).

**Host semantics.** `role="banner"` is always set.

**Trailing cap.** When more than three trailing actions are **shown**, the extra ones are hidden.
The component tracks which actions it hid itself, warns once per distinct count, and never touches
an action the author hid.

## Layout and paint reference (density 0, light theme, LTR; `web-paint.json`, 156 cases)

**Small bar:**

- 64 tall. The row has 4px inline padding.
- The leading button is 48×48 (`max(32, 48+4s)`) with a 24px glyph (`max(18, 24+s)`).
- The title is title-large 22/28, inset 12px, single line with an ellipsis.
- The trailing actions are 48px each with a 2px gap.
- The fill is surface (#FFFBFE). With `scrolled`, it becomes surface-container (#F3EDF7). The bar is
  sticky at the top with z-index 100.

**Medium and large bars:**

- The row is 64px; on large it is 84px, because a 20px block-start padding aligns the icons to the
  top.
- The expanded headline is headline-medium 28/36. Bottom padding is 24 (medium) or 28 (large); the
  inline padding is 16.
- The subtitle is label-large on medium and title-medium on large.
- The inline title is still laid out, but with opacity 0 and `aria-hidden`.
- **Measured total heights are 124 (medium), 148 (large), 146 (medium with subtitle) and 174 (large
  with subtitle).** The documented heights 112, 120, 136 and 152 are only `min-block-size`; see the
  open decisions.

**Centred title:** a three-column grid (`minmax(48px,1fr) auto minmax(48px,1fr)`).

**Search bar:**

- The row has an 8px gap.
- The pill fills the bay between the leading and trailing areas. It is 56 tall (`max(40, 56+4s)`),
  corner-full, surface-container-highest (#E6E0E9); with `scrolled`, it becomes surface-container.
- The hint inset is 24px (16px under 600px, 12px under 400px), and the placeholder is
  on-surface-variant.
- In-pill trailing icons have a 4px gap, a 6px gap from the field and 8px of pill end padding.
- The outside trailing area is 48 (the avatar is 32).
- A disabled bar shows the pill at opacity 0.38 with no state layer.
- With a centred title, only the `::placeholder` is centred; the caret and typed text stay at the
  start, and nothing moves on focus.

**Search pill states:**

- The state layer is 8% on hover and 12% on press.
- The focus ring (3px secondary at offset 2px) appears only with keyboard modality. It is not shown
  on pointer focus, but it appears on the first keystroke after a pointer focus.

## Source defects fixed (test-first)

1. **Space could not be typed in the search field.** Fix: Space still emits `mdSearchActivate`, but
   its default is no longer prevented. Tests: `md-app-bar.search.spec.ts`, where the Enter/Space
   test now asserts that only Enter is prevented, and
   `md-app-bar.authoring.e2e.ts › types multi-word queries…`.
2. **The trailing cap overrode authors.** It un-hid actions the author had hidden and counted them
   toward the cap. Fix: a `WeakSet` of cap-hidden actions, counting only shown actions, and a
   `MutationObserver` on `hidden` to re-apply the cap. Tests: "leaves an author-hidden trailing
   action hidden" and "counts only shown actions…".
3. **`--md-app-bar-expanded-padding-block-end` was dead.** The per-variant defaults on medium and
   large replaced the private variable without reading the hook. Fix: both defaults now go through
   the hook. Test: "applies the expanded block-end padding hook on medium/large bars".
4. **`--md-app-bar-trailing-icon-touch-size` was dead.** The private variable was defined but never
   read; trailing buttons used the leading size. Fix: trailing slotted actions take their own touch
   target, which defaults to the leading size. Test: "sizes trailing actions with the trailing
   touch-target hook…".

**CEM drift, root cause in a shared file.** The CEM lists 32 of the 38 hooks. Missing are
`--md-app-bar-search-container-color`, `-search-container-color-scrolled`,
`-search-container-shape`, `-search-placeholder-color`, `-search-input-color` and
`-search-trailing-icon-color`.

- In `scripts/generate-docs.mjs`, `parseCss` switches sections on `/SLOTS/i`. That regex matches
  the word "slots" inside the avatar-size description ("Avatar size in trailing slots"), so header
  parsing stops early.
- Those six hooks are written as multi-line `var(\n --md-…)`, which the fallback `var\((--md-…)`
  scan cannot match.
- The proper fix is the regex in the shared generator, so it is **reported, not changed**. A
  one-word rewording of the component's CSS header would work around it.

## Behaviour kept as-is (needs a decision or native matching)

- Flexible bars never collapse on scroll and always show the expanded block.
- `role="banner"` is set unconditionally, so two app bars on one page produce two banners.
- The prop-based leading icon cannot mirror in RTL. The rule
  `.md-app-bar__leading-button[data-directional]` targets an attribute the component never sets, so
  it is dead. Slotted `[data-directional]` leading content does mirror (oracle
  `slotted-leading-directional-rtl`: `matrix(-1,0,0,1,0,0)`).
- RTL mirroring uses `:host-context([dir=rtl])` as well as `:host([dir=rtl])`. The former is
  Chromium-only.
- `mdSearchActivate` fires on every typed Space, as documented.
- The focus ring appears on the first keystroke after a pointer focus.
- A trailing-cap warning repeats each time the count rises above three again.

## Evidence

- **Source diff:** `outputs/native-parity/md-app-bar/source-changes/md-app-bar.diff`.
- **Test logs:** `source-tests/`, including `appbar-hooks-before.log` (the three dead-hook tests
  failing on the original CSS), `appbar-auth-*.log` and `after-255-final.log`.
- **Oracles (provisional):** `web-oracle-cloud/`.

## Decisions (autonomous, 2026-10-31, reversible)

Taken by n5 for the native migration (the plan's open decisions and "Behaviour kept as-is"); the Web contract stays the target.

| Decision | Chosen | Alternative | How to revert |
| --- | --- | --- | --- |
| Medium / large heights | Option (b): the rendered heights are the contract — 124 (medium), 148 (medium with subtitle), 146 (large), 174 (large with subtitle); the docs' 112/120 and 136/152 are minimums. | Option (a): change the CSS to the documented heights. | Change the source CSS (test-first), recapture `outputs/native-parity/md-app-bar/web-oracle/`, regenerate the fixtures; both renderers derive the heights from the same metrics. |
| Collapse on scroll | Keep: flexible bars never collapse on scroll and always show the expanded block. | A scroll-linked collapse. | Implement it in the source first (scroll container contract), then in both renderers with their scroll observers. |
| `role="banner"` | Keep it unconditional (two app bars produce two banners). | Banner only for the first / a top-level bar. | Change the source, recapture the ax oracle, update the platforms' landmark/heading exposure. |
| RTL mirroring of the leading icon | Keep: the property leading icon is not mirrored (the `[data-directional]` rule on the button is dead); slotted `[data-directional]` leading content is mirrored. | Mirror directional property icons. | Make the source set `data-directional` on the button, recapture `slotted-leading-directional-rtl` and the RTL cases, then mirror in both renderers. |
| CEM drift (manifest regex drops six search hooks) | A Web follow-up: the native typed appearance lists all 38 source hooks (the manifest's 32 + the six search hooks it drops); the manifest fix belongs to the Web package. | Ship only the manifest's hooks natively. | Remove the six hooks from the native appearances and the Laboratory profile. |
| `::part()` styling | Typed native part APIs (`AWCAppBarPart`, 17 parts) over the shared `AWCAccordionPartAppearance` vocabulary (`.awcAppBarPartAppearance(_:part:)` / `AWCAppBarPartAppearanceScope`); a part value follows the source part box and wins over the hooks and every state rule; the fields each part honours are listed in the Laboratory notes. Verified against a Chrome `::part()` oracle (9 cases, pixels). | Report `::part()` as an exception. | Remove the part types and the parts fixture; the Laboratory policy lists no visual parts again. |
| Home / End in the search input | As Chrome's single-line input: Home / End move the caret to the start / end — macOS: the field editor's scroll commands move the caret (AppKit only scrolls); iOS: the field's navigation keys (the bar takes none of them, so FieldTextInput moves the caret). | The platform default (scroll only). | Drop the two FieldTextInput cases (install-appbar-swift.py) and the iOS `navigationKeys` of the search input (NativeAppBar.swift). |
| Host write of `searchValue` | The host's own property replaces the editing text in the update that brings it (Web: setting the property sets the input). Traced: through the merged model value the editing text cleared one update later (n5-059) and the AppKit field showed "" while the input's inspection kept the typed text for ≥ 150 ms (n5-060) — the inspection was not republished for that later update, the user-visible field was right; with the write applied in its own update the inspection follows (macOS states 1395/1397 → 1397/1397). | Follow the merged value only. | Remove the `node.properties["searchValue"]` onChange in `NativeAppBar.swift` (the Compose bar reads the property directly). |
| Search input role | Web `role=searchbox`: macOS the AXSearchField subrole and iOS the searchField trait (FieldTextInput, for `role = "searchbox"` only); Android has no search-field role — the input is an EditText with the Search IME action (tools/ax convention). | Report a plain text field. | Drop the `awcSubrole` / searchField lines in `FieldTextInput.swift` and the `role` in `inputConfig`. |
| Banner landmark | Web `<header role=banner>` (unnamed): no native platform exposes it — SwiftUI cannot give a container the AXLandmarkBanner subrole and an AppKit landmark bridge (the rail's) re-hosts only focus elements, which would drop the headline, subtitle and slotted content (the md-stepper decision); UIKit has landmarks only as a container type; Compose has no landmark role. The bar's button, text, field and actions are exposed in reading order (tools/ax conventions, macOS / iOS / Android). | A macOS landmark bridge re-hosting focus elements plus synthetic text elements (slotted content lost). | Add the bridge (as `AWCNavigationRailLandmarkView`, subrole AXLandmarkBanner) and drop the three expectations. |
| Laboratory Tab from the search input (macOS live host) | A keyboard's Tab: through the field editor (`insertTab:` → the key view after the field), as the live host does for md-color-picker / md-time-picker; the window's `selectNextKeyView` from the field editor kept focus in the field (tools/ax n5-A041). | `selectNextKeyView`. | Remove `"md-app-bar"` from that live-host rule (lab-patch-appbar.py). |
| Bar timeline after a transition | The bar's timeline pauses when its transitions end (the body is re-evaluated then) and the inspection carries `renderTime` only while one runs. Cause of `test-live-nav.mjs`'s intermittent "a search bar (medium)" (r6-026, d2-064): the timeline stayed unpaused after a transition, so the bar re-rendered on every display frame and (since n5-059) published a new inspection every frame; a host update landing then kept the previous inspection once the timeline paused. Measured on the installed renderer (n5-062, `appbar/probe-settle.mjs`): `renderTime` still advancing 300 ms after a 100 ms transition; `variant: search` after a `scrolled` transition read `medium` in 20 of 20 rounds (still 500 ms later), 0 of 40 rounds without a transition before the update; `test-live-nav.mjs` failed 2 of 10 runs. With the fix: no frame time once settled, 0 of 40 stale, 10 of 10 runs pass. | Keep the timeline running and a frame time in every inspection. | Remove `settled` / `animating(_:)` in `NativeAppBar.swift`. |
