# Search source review (md-search)

Status: Gate 1 (Web source contract checkpoint).

* The contract is inventoried below.
* Three source defects are fixed test-first and mirrored into
  `packages/core/src` (D2, D3 and D4). D2 also covers result focus tracking
  when md-search sits inside another shadow root.
* A browser reference is captured: paint, interaction and reduced-motion
  oracles.

The oracle is **provisional**. It was captured in headless Chromium 141 on
Linux, and must be recaptured on the Mac (Chrome 153) and diffed. No native
code has changed.

## Composition

* **Bar** (`part=bar`): leading button (`part=leading`, the search glyph at
  rest, `chevron_left` (contained) or `arrow_back` (divided) when open),
  native `<input>` (`part=input`), clear button (`part=clear-button`),
  voice button (`part=voice-button`), `leading` / `trailing` slots, and the
  `loader` slot (`part=loading`).
* **Trigger** (`part=trigger`, `part=trigger-button`): an icon button that
  opens the full-screen view (the default for `layout="full-screen"`), or
  the bar itself (`trigger="bar"`). An external opener (`trigger-for` or
  `triggerElement`) replaces it, gets `aria-haspopup="dialog"` and
  `aria-expanded`, and receives focus on close.
* **Panel** (`part=panel`, `panel-body`, `results-viewport`,
  `results-host`, `divider`, `empty`):
  * `docked`: anchored under the bar, 360–720px wide, results up to ⅔ of
    the viewport height, non-modal.
  * `full-screen`: an opaque edge-to-edge surface with a focus trap and
    document scroll lock.
* **Status** (`part=status`): a polite live region with
  `results-label` / `no-results-label` / `loading-label`. It speaks only
  while open.

## Public contract

* **Props:**
  * Layout and look: `variant` (`contained` | `divided`), `layout`
    (`full-screen` | `docked`), `trigger`, `trigger-icon`, `trigger-for` /
    `triggerElement`, `full-width`, `elevation` 0–5, `leading-icon`,
    `open-leading-icon`, `scroll-shadow`, `max-block-size` and `density`
    0…−4.
  * Value and state: `value` (reflected), `placeholder`, `open`
    (reflected), `disabled`, `loading` and `loading-label`.
  * Behaviour: `show-clear-button`, `voice-search`, `escape-closes`,
    `dismiss-on-outside-click`, `initial-focus` (`auto` | `input` |
    `leading`) and `input-aria-label`.
  * Announcements: `announce-results`, `results-label` and
    `no-results-label`.
  * Emission: `debounce` and `throttle` (`mdSearch` only, with throttle
    acting as maxWait).
* **Events:**
  * `mdInput {value}` on every keystroke.
  * `mdSearch {value}`: debounced or throttled, trimmed and
    distinct-until-changed; flushed at once on Enter and on clear.
  * `mdSubmit {value}` on Enter while open.
  * `mdChange {value}` on blur, when the value differs from the value at
    focus.
  * `mdOpen` and `mdClose`.
  * `mdClear`.
  * `mdVoice {value, final}`.
  * `mdLeadingIconClick {value, open}` and `mdTrailingIconClick`.
* **Methods:** `show`, `close`, `whenClosed`, `toggle`, `focusInput`,
  `startVoice` and `stopVoice`.
* **Keyboard:**
  * Closed: Enter or Space on the bar opens it; typing opens it.
  * Open: ArrowDown / ArrowUp move through the slotted result rows
    (`md-list-item`, `[role=option]`, `[role=menuitem]`,
    `[data-search-result]`, `li`), and Up from the first row returns to the
    input. Enter submits. Escape closes when `escape-closes` is set.
  * Full-screen traps Tab.
  * Docked acts on keys only while focus is in the search, on its external
    trigger, or nowhere (fix D2).
  * An IME-committing Enter is ignored (fix D3).
* **CSS hooks (25):** `--md-search-{avatar-size, container-height,
  container-max-inline-size, container-min-inline-size,
  container-padding-inline, divided-fullscreen-bar-height,
  divider-thickness, docked-panel-shape, empty-padding-block,
  empty-padding-inline, expand-focused-inset, expand-inset,
  focus-indicator-offset, focus-indicator-thickness,
  fullscreen-bar-panel-gap, icon-button-size, icon-size,
  leading-icon-label-gap, leading-padding-inline, max-block-size,
  panel-max-block-size, panel-min-block-size, panel-padding-block-start,
  trailing-icon-label-gap, trailing-padding-inline}`.

## Layout and paint reference

* **Docked bar:** 56 high, a full pill, surface-container-high `#ECE6F0`
  (dark `#2B2930`), inset 24px on each side of a 420px host (372 wide).
* **Docked panel:** opens under the bar (shape from `docked-panel-shape`),
  168px tall for three one-line rows. `divided` adds a divider between bar
  and results.
* **Full-screen:** an opaque panel the full viewport height.
  * The bar keeps the back chevron and the clear ✕.
  * The icon trigger at rest is a 48×48 icon button.
* **Loading:** the loader replaces the trailing icon. The results panel
  fades to opacity 0 while `loading`, and the status reads "Searching".
* RTL mirrors the bar (search glyph and back arrow at the right, clear at
  the left).

## Interaction and motion reference

Runs: `search-docked-{contained,divided}-{ltr,rtl}`,
`search-fullscreen-{contained,divided}`, `search-fullscreen-icon-trigger`,
`search-docked-clear-loading` and `search-docked-outside-keys`.

* **Docked** (`debounce=200`):
  * A click on the bar emits `mdOpen` and focuses the input.
  * Typing `al` → `mdInput "a"`, `"al"`, then a single `mdSearch "al"`
    after the pause. The status reads "3 results available".
  * ↓ → Alpha (the input blur emits `mdChange "al"`); ↓ → Alpine;
    ↑ → Alpha; ↑ → the input.
  * Enter → `mdSubmit "al"`. Escape → `mdClose`, with focus kept in the
    input.
* **Full-screen** (`trigger="bar"`, no debounce): each keystroke emits
  `mdSearch`. Tab goes input → clear → Alpha row → wraps to the back
  button. Shift+Tab from the back button wraps to Alpha (fix D4). Escape
  closes with focus in the bar.
* **Icon trigger:** a click opens the view with focus in the input. The back
  button emits `mdLeadingIconClick {open:true}`, then `mdClose`, and focus
  returns to the trigger once the exit transition ends. A probe shows the
  same for Escape and for keyboard activation of the back button.
* **Clear:** emits `mdChange` (the blur of the old value), `mdInput ""`,
  `mdSearch ""` and `mdClear`. An outside click closes the view (`mdClose`)
  and leaves focus on the body.
* **Outside keys:** with a docked search open, ↓ and Escape in a textarea
  stay in the textarea (fix D2).
* **Motion:**
  * Panel opacity and transform: 300ms `cubic-bezier(.2,0,0,1)`.
  * Docked bar width spring: 400ms `cubic-bezier(.34,1.56,.64,1)`.
  * Clear button fade and scale: 250ms.
  * Leading icon swap: 300ms.
  * Result rows: shape morph 400ms `cubic-bezier(.05,.7,.1,1)`, state layer
    100ms.
* **Reduced motion:** the panel, bar and icon motion are gone. Only the row
  state layer and the ripple remain.

## Source defects fixed (test-first)

Tests are in `md-search.keyboard-scope.e2e.ts` (10 tests: 6 fail on the
unchanged source, 4 are guards). Each fix is in `md-search.tsx`, with the
readme updated.

* **D2. An open docked search took over keys from the rest of the page.**
  * The bug: the window keydown listener moved focus into the results on
    ↓/↑ and closed on Escape from any page control (a textarea lost its
    caret movement; Escape in an unrelated field closed the search).
  * The fix: docked acts only while focus is in the search (composed tree),
    on its external trigger, or on the body. Full-screen keeps owning the
    keyboard.
  * Also fixed: result focus was tracked through `document.activeElement`,
    which breaks when md-search lives in another shadow root (↓ always went
    back to the first row, ↑ jumped to the input). It now uses the deep
    active element with composed containment.
  * Tests: the textarea ↓ and Escape tests, the nested-shadow test, and two
    guards.
* **D3. An IME-committing Enter submitted.**
  * The bug: Enter with `isComposing` (or WebKit's `keyCode` 229) emitted
    `mdSubmit` and flushed `mdSearch` with the half-composed text.
  * The fix: those keydowns are ignored (no submit, no open).
  * Tests: two composition tests and one plain-Enter guard.
* **D4. The full-screen focus trap skipped the slotted results.**
  * The bug: the trap listed shadow tabbables and light-DOM matches of a
    flat selector. A row whose tab stop lives in its own shadow
    (md-list-item's inner span) was never in the list, so Tab wrapped from
    the clear button straight back to the back button and the results were
    unreachable by keyboard.
  * The fix: the trap walks the composed tree (slots → flattened assigned
    elements, open shadow roots, visibility checks) and compares against the
    deep active element.
  * Tests: Tab and Shift+Tab.

## Observed, not changed (decisions needed)

1. **`mdInput` and `mdSearch` during composition:** md-search emits both
   with the provisional text, where md-text-field holds them until
   `compositionend`. Align them?
2. **Focus during the exit motion:** after the back button or Escape, focus
   sits on the body for the length of the exit transition before it
   returns to the trigger. Move the focus first?
3. **Loading hides results:** the results panel goes to opacity 0 while
   `loading`. M3 keeps stale results under a progress indicator. Intended?
4. **Privacy:** `value` is reflected to the `value` attribute, so the query
   is visible in the DOM and in serialisers.
5. **Hard-coded English labels:** "Clear search", "Search by voice" and
   "Stop voice search" have no translatable label props.

## Evidence

* Oracle: `outputs/native-parity/md-search/web-oracle-cloud/` (123 paint
  cases, 9 runs, 9 reduced-motion runs, `SHA256SUMS`).
* Tests: 7 suites (6 at baseline, plus the new 10-test
  `md-search.keyboard-scope.e2e.ts`), all passing within the family run
  (633/633).
