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
