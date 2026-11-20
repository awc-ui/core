# Native accessibility parity

Gate 6 (runtime and accessibility) of [AUDIT.md](AUDIT.md), accessibility part. For each component the same Laboratory
cases are rendered on Web (Chrome), macOS (SwiftUI Laboratory host), iOS (simulator) and Android (emulator), the
accessibility tree each platform hands to assistive technologies is captured, and every native tree is compared with
Web: names, roles, states and values, actions, reading order, Tab order, disabled vs soft-disabled, live regions and
announcements. The tool is [`tools/ax`](../../tools/ax/README.md); per-component evidence is in
`outputs/native-parity/<tag>/accessibility/` (`report.md`, `report.json`, raw `<case>.<platform>.json` captures).

**Run** 2026-10-29, on the canonical tree after the `fa-034` install: Web = Chrome for Testing (puppeteer) on the rebuilt
`packages/core/dist`; macOS = the Laboratory SwiftUI host (`AWCLivePreview` of `apps/native-ios-playground`); iOS = iOS 26
simulator (iPhone 17 Pro, `apps/native-ios-parity`); Android = API 36 emulator (`AccessibilityProbeTest` in the debug playground,
sources identical to canonical). 29 components (30 tags), 98 cases; `md-text-field` on macOS and iOS only (its Android port has not
landed). `md-accordion` on Web was captured again after `fa-051` (fix-web-2 and the rebuilt dist). Reproduce with the commands below; raw captures, pixels and per-case findings are in each component's
`outputs/native-parity/<tag>/accessibility/`.

## How to use it (n1–n5 and later components)

```sh
node tools/ax/run.mjs --tags md-x --out outputs/native-parity/_ax/md-x \
  --ios-device <your simulator UDID> --android-serial <your emulator> --android-project <your private android copy>
node tools/ax/run.mjs --tags md-x --platforms web,compare --out ...        # re-run one phase; captures are cached
node tools/ax/summary.mjs --out outputs/native-parity/_ax/md-x            # one-line status per component
```

Add cases for the component in `tools/ax/cases.mjs` (default, every state with an accessibility effect, an explicit
`aria-label`, live regions; `tabs` for the focus walk; `LANDED` when the component exists on only some native
platforms), mirror any Laboratory presentation context in
`tools/ax/presentation.mjs` and `tools/ax/ios/AccessibilityProbe.swift`, run, then fix open findings test-first.
Only a reviewed platform convention goes into `tools/ax/expectations.mjs`, with its reason. Run `macos` before `web`
and `ios`: both render the effective node the macOS host produced.

## Role mapping

How each Web role is encoded per platform (the normalizers implement this table; `node tools/ax/summary.mjs --roles`).

| Web role | macOS (NSAccessibility) | iOS (UIAccessibility) | Android (AccessibilityNodeInfo) |
| --- | --- | --- | --- |
| `button` | AXButton (AXPopUpButton/AXMenuButton with popup) | trait button | android.widget.Button |
| `togglebutton` | AXCheckBox/AXToggle | traits button+toggleButton, value 1/0 (as SwiftUI button-style Toggle) | checkable android.widget.Button / ToggleButton |
| `checkbox` | AXCheckBox, AXValue 0/1/2 | trait button, value Checked/Unchecked/Mixed (iOS has no checkbox trait) | android.widget.CheckBox, checkable/checked (+stateDescription for mixed) |
| `switch` | AXCheckBox/AXSwitch, AXValue 0/1 | traits button+toggleButton, value 1/0 | android.widget.Switch, checkable/checked |
| `radio` | AXRadioButton, AXValue 0/1 | trait button (+selected; iOS has no radio trait) | android.widget.RadioButton, checkable/checked |
| `radiogroup` | AXRadioGroup | semanticGroup container | collection / container |
| `link` | AXLink | trait link | clickable text (link) |
| `heading` | AXHeading | trait header | isHeading |
| `img` | AXImage (named) | trait image | android.widget.ImageView (named) |
| `progressbar` | AXProgressIndicator / AXBusyIndicator | trait updatesFrequently, value | android.widget.ProgressBar + RangeInfo |
| `meter` | AXLevelIndicator | static text with value | ProgressBar + RangeInfo |
| `slider` | AXSlider | trait adjustable | android.widget.SeekBar + RangeInfo |
| `tab` | AXRadioButton/AXTabButton | button + selected inside tabBar | roleDescription "Tab" |
| `tablist` | AXTabGroup | trait tabBar | collection |
| `menu` | AXMenu | container | pane / collection |
| `menuitem` | AXMenuItem | trait button | android.widget.Button |
| `dialog` | AXGroup/AXApplicationDialog, AXSheet, AXWindow/AXDialog | accessibilityViewIsModal container | paneTitle (pane / window) |
| `status` | AXGroup/AXApplicationStatus or announcement | UIAccessibility announcement | liveRegion polite / TYPE_ANNOUNCEMENT |
| `alert` | AXGroup/AXApplicationAlert | announcement | liveRegion assertive |
| `tooltip` | AXHelp on the anchor | accessibilityHint on the anchor | tooltipText on the anchor |
| `list` | AXList | list container | CollectionInfo |
| `listbox` | AXList (selectable) | list container | CollectionInfo (selection) |
| `option` | AXStaticText + AXSelected (as WebKit exposes an option) | static text (+selected) on the keyboard focus surface (as WebKit exposes an option) | selectable collection item (RadioButton/CheckBox role, checked = selected) |
| `listitem` | row group | element in list container | CollectionItemInfo |
| `grid` | AXTable/AXGrid | dataTable container | CollectionInfo |
| `gridcell` | AXCell | dataTable cell | CollectionItemInfo |
| `textbox` | AXTextField/AXTextArea | keyboard-editable element | android.widget.EditText |
| `searchbox` | AXTextField/AXSearchField | trait searchField | android.widget.EditText |
| `combobox` | AXComboBox / AXPopUpButton | trait button | android.widget.Spinner |
| `spinbutton` | AXIncrementor | trait adjustable | android.widget.NumberPicker |
| `separator` | AXSplitter (not exposed for decorative dividers) | not exposed | not exposed |
| `group` | AXGroup (named) | semanticGroup container | container with description |

## Decisions (autonomous, reversible)

These close design gaps where Web semantics have no single native equivalent. They follow the Web source semantics with
each platform's convention, were taken by the accessibility lane without a product review, are limited to the files
named, and can be reverted by restoring those lines; `tools/ax` then reports the difference again.

1. **Live regions → native announcements.** Web `role=status`/`aria-live=polite` and `role=alert`/`aria-live=assertive`:
   SwiftUI `AccessibilityNotification.Announcement` (iOS `UIAccessibility.post(.announcement)`, macOS `NSAccessibility`
   announcement request), assertive content at high priority (`accessibilitySpeechAnnouncementPriority = .high`, macOS
   priority 90); Android Compose live regions (`LiveRegionMode.Polite`/`Assertive`, reported as status/alert).
   `tools/ax` checks that a live-region update is announced and that the macOS priority matches the Web politeness.
   Revert: the announcement calls in badge, loading indicator, skeleton, snackbar and the checkbox error (fix-ax-2).
2. **Toggle buttons use the platform toggle convention.** Web `aria-pressed` (button, icon button, button-group members,
   selectable chips): macOS `AXCheckBox` + `AXToggle`, value 0/1 (WebKit's mapping of `aria-pressed`); iOS toggle trait,
   value 1/0 (a SwiftUI button-style `Toggle`); Android keeps Compose `selected` — checkable with "Selected"/"Not selected"
   (Material filter chips and segmented buttons do the same). Revert: `policy.toggle` in `NativeFocus.swift` and the
   role/subrole/value and iOS trait lines in `NativeFocusBridge.swift` (fix-ax-2, fix-ax-4).
3. **Lists follow the Web role per selection mode.** Non-selectable lists keep list items (a row with a primary action is a
   button or link). Single-/multi-select lists are Web `listbox`/`option`: macOS `AXStaticText` + `AXSelected` (WebKit's
   mapping, on iOS too: static text + selected trait on the row's focus element), Android selectable collection items
   (selection exposed as checked; the keyboard-focused row reports focus); the option's
   name is its full content (overline, headline, supporting and trailing text). Revert: `.option` in
   `NativeFocus.swift`/`NativeFocusBridge.swift` and the row label in `NativeListItemView.swift` (fix-ax-2);
   `NativeListPaintIntegration` asserts the macOS role.
4. **The FAB menu exposes the Web menu semantics.** The open menu is a `menu` named by `menuLabel` containing menu items, and
   the FAB reports expanded/collapsed. macOS: an AppKit element with the `AXMenu` role owns the items (SwiftUI has no menu
   container role); iOS has no menu container trait (contained group of buttons); Android: a pane titled by `menuLabel`
   with a collection of items (Android has no menu role). Revert: `awcMenuAccessibility` in `NativeFocusBridge.swift` and its
   use in `NativeFabMenu.swift` (fix-ax-4, fix-ax-7).
5. **Heading around a disclosure button (accordion).** Web `h3 > button[aria-expanded]` + `region` named by the header:
   macOS `AXHeading` (with level) containing the button and a group named by the header; iOS a header-trait button
   (UIKit has no heading container); Android `heading()` on the clickable header (Compose). Revert:
   `awcAccordionHeadingSemantics`/`awcAccordionRegionSemantics` in `NativeAccordion.swift` (fix-ax-3, fix-ax-7).
6. **Required follows the Web source.** md-checkbox, md-radio and md-switch set `aria-required` on the control; Chrome does
   not report it for these roles, but macOS exposes `AXRequired` and all platforms expose the resulting invalid state
   (required and unchecked) as the source does. Recorded as an accepted difference against the Chrome tree.

7. **macOS in-window modal surfaces report the dialog role (R4-03; the former waiver was rejected by gate-7 r4).** md-dialog, md-bottom-sheet and the modal
   md-side-sheet render inside the window; SwiftUI exposes the surface as an AXGroup named by its title. The surface's
   accessibility node now also reports Chrome's mapping — subrole `AXApplicationDialog` (`AXApplicationAlertDialog` for
   the basic md-dialog), `AXModal` true and the matching role description — through the shared container-attribute
   extension (`ContainerAccessibility.swift`), and md-dialog's `aria-describedby` message is its AXHelp. The former
   expectations were removed; the modal behavior (focus trap, hidden background, Escape/scrim dismiss) is unchanged.
8. **Android dialogs are panes.** Android has no alert-dialog role and no described-by relation: md-dialog is a pane titled
   by its headline (`paneTitle`), which TalkBack announces when it appears, and the message is the text read right after
   the title; focus moves into the dialog and is trapped as on Web. Accepted entries in `expectations.mjs` (revert by
   deleting them).

## Defects fixed

Found by `tools/ax`, fixed test-first (a failing comparison or a new failing test first; the affected Swift view suites, Android
suites and Web spec/e2e suites re-run), installed through main-queue jobs `fa-020`…`fa-023`, `fa-034` and `fa-051` (anchored
scripts `fix-ax-1` … `fix-ax-10`, `fix-ax-a1` … `fix-ax-a4`, `fix-web-1`, `fix-web-2`):

| # | Defect (Web → native before the fix) | Fix |
| --- | --- | --- |
| F1 | `aria-label` ignored: button, checkbox, radio, switch and list switch exposed their visible text | Accessible name = `aria-label`/`ariaLabel` when set (`AWCNativeView.accessibleName`), macOS and iOS |
| F2 | `md-switch` exposed as a checkbox (macOS `AXCheckBox` without subrole; iOS button with value Unchecked) | macOS `AXCheckBox` + `AXSwitch`, value 0/1; iOS toggle trait, value 1/0 (as SwiftUI `Toggle`) |
| F3 | Decorative glyphs read as text ("check", "folder") in checkbox and list | Glyph text and checkbox graphic hidden from accessibility |
| F4 | Accordion header was a plain button; the expanded panel's text was not exposed (custom-drawn text) | Header: heading with its level (macOS `AXHeading`, iOS header trait) containing the disclosure button; panel text exposed as static text |
| F5 | Checkbox `indeterminate`, `error`, `required` not exposed | Mixed value (macOS 2, iOS "Mixed"); macOS `AXInvalid`/`AXRequired`, error text as help (iOS hint); a newly shown error is announced assertively |
| F6 | Radio and switch `error`/`required` not exposed | `AXInvalid`/`AXRequired` (invalid also when required and unchecked, as Web constraint validation) |
| F7 | Assist chip (host button) hidden from accessibility entirely | The host-button focus bridge is added after the hidden drawn content, so the chip is a named button |
| F8 | Selectable list rows exposed as radio/checkbox named by the headline only | Option role and full-content name (decision 3) |
| F9 | Toggle buttons exposed as plain buttons with a selected flag | Platform toggle convention (decision 2) |
| F10 | FAB menu popup exposed as a plain group | Menu container (decision 4) |
| F12 | Accordion header a group with a heading level; panel unnamed | `AXHeading` container and named panel group on macOS (decision 5) |
| F13 | Chip: iOS read the remove button before the chip | Host control sorted first |
| F14 | Android checkbox/radio/switch ignored `aria-label`; md-button ignored `aria-label` | Name from `aria-label` (the visible label is then not read in addition) |
| F15 | Android: invalid/error not exposed; checkbox mark read as text | Compose `error()` with the error text (error, or required and unchecked); mark glyph has no semantics |
| F11 | macOS SwiftUI host build broke when the capture code was a second LiveRenderer file (SwiftPM top-level code vs `@main`) | Capture embedded in `main.swift` between markers (fa-021) |
| F16 | md-dialog: macOS read OK before Cancel (AppKit listed the fallback actions' focus elements in reverse; sort priorities and a SwiftUI container had no effect) | The fallback action row is an AppKit container element listing its controls in reading order (fix-ax-9) |
| F17 | Laboratory SwiftUI host: Tab was lost in a standard (non-modal) side sheet | Tab uses the window's key-view loop unless the side sheet is modal |
| F18 | Android md-checkbox: the error text was read as part of the checkbox name | The error line is its own assertive live region (Web `role="alert"`); the checkbox keeps `error()` |
| F19 | Android Laboratory host rendered its own sample content, so comparisons used different fixtures | `configure` accepts the shared example's `children` (tools/ax sends the SwiftUI host's effective node) |
| F20 | AppKit container elements (menu, accordion heading, dialog actions) ordered members by vertical position only; members on one line were unordered | Reading order: top to bottom, then leading to trailing (fix-ax-9) |
| F21 | Laboratory SwiftUI host ended the session silently (exit 0) when a response could not be encoded: the md-list selection-mode-none accessibility read carried non-finite AX numbers | The host answers with an error and keeps the session; the capture reports non-finite numbers as null (fix-ax-9, tools/ax) |
| F22 | md-list: the icon glyph's ligature name ("folder") was read as text in rows that are not one element (selection mode none), macOS and iOS | The glyph view is an ignored, hidden element (fix-ax-10) |
| F23 | Android md-card: an interactive card wrapping AWC components (md-button, md-chip, …) exposed itself as a button around them (nested interactive) | The library's interactive components count as interactive content, as the source's selector lists them (fix-ax-a3) |
| F24 | Android md-button: an ancestor's text-style colour replaced the label colour (in a disabled card the label measured 2.27:1 against Web's 5.07:1) | The button's own content colour governs its text (fix-ax-a3) |
| F25 | Android md-chip: a disabled or soft-disabled chip's remove button was merged into the chip's name ("Design system Remove Design system") | The remove button stays its own (disabled) element (fix-ax-a3) |
| F26 | Android md-list: the keyboard-focused row did not report focus to accessibility services (Tab focus invisible to TalkBack/Switch Access) | The row reports focused (fix-ax-a3) |
| F27 | Android md-chip: the ✕ (remove) and ✓ (selected filter) glyphs were never visible — drawn with the chip's size instead of their box's (`size` resolved to NativeChip's state, not the DrawScope); contrast 1:1 against Web's 9.34:1 | The glyph lambdas use the DrawScope's size (fix-ax-a4); this also clears the pre-existing `NativeChipInteractionTest` pixel failure |
| F28 | Android Laboratory host: a standard side sheet was laid over the launcher (read and tabbed before it); the host's own sample fixture leaked into the shared example (assist chip checkable, extra icon) | The recipe's page order (launcher, then the component); a shared example renders with its own properties only (fix-ax-a3) |
| F29 | Web md-accordion: in exclusive mode an item expanded through its property right after creation collapsed itself (its index was still -1, and the listener collapsed every item whose index differed), so its panel left the accessibility tree | The toggled item is identified by element; mdToggle reports its position (fix-web-1, `md-accordion.exclusive-identity.spec.ts`) |
| F30 | Web md-accordion-item: Chrome intermittently left an expanded panel's slotted text out of its accessibility tree for good (20-30 % of cold page loads, also with `expanded` in the markup). Bisect: not `inert`, `aria-hidden`, the region role, the grid panel, the panel motion or the ripple's own `aria-hidden` — the header `md-ripple` hydrating inside the item's shadow tree during the item's first render | The ripple (interaction feedback, nothing drawn at rest) is created once the item has loaded: 0 of 24 cold loads miss the text (fix-web-2, `md-accordion-item.ripple-timing.spec.ts`) |

## Accepted platform conventions

Findings matching a reviewed entry in `tools/ax/expectations.mjs` are reported as *accepted* with the reason:

- `md-divider` macos (text-extra): Web role=separator (aria-orientation). SwiftUI has no separator role: the divider is a labelled element "Separator" with its orientation as value, which VoiceOver reads like Chrome's separator.
- `md-divider` ios (text-extra): Web role=separator. UIKit has no separator trait: label "Separator" + value orientation (VoiceOver: "Separator, Horizontal").
- `md-skeleton` (role): Web role=status "Loading" (polite). Native exposes the platform busy indicator (macOS AXBusyIndicator, iOS activity indicator) named "Loading" and announces the label politely, which is how both platforms present loading placeholders.
- `md-skeleton` ios (extra): Web role=status "Loading"; iOS presents it as the activity indicator named "Loading" (polite announcement on appear).
- `/^md-(checkbox|radio|switch)$/` macos (state): The Web source sets aria-required="true" on the control; Chrome does not report required for checkbox/radio/switch roles in its tree. macOS exposes AXRequired as the source declares (iOS has no required channel).
- `md-chip` macos (state): Web reports the chip wrapper group as disabled. AppKit groups carry no enabled state; the chip control inside reports AXEnabled false.
- `md-skeleton` (extra): Web role=status "Loading". Native presents the platform busy indicator named "Loading" (see the skeleton role entry) instead of a text status.
- `md-skeleton` (text-missing): The Web status text "Loading" is the busy indicator's name natively (and is announced politely on appear).
- `md-meter` ios (text-extra): Web role=meter. UIKit has no meter trait: the meter is a static text read with its value (percentage or aria-valuetext).
- `md-divider` android (text-extra): Web role=separator. Android has no separator role: the divider is described "Separator", as on macOS and iOS.
- `md-tooltip` android (description): Web: the tooltip describes its anchor (aria-describedby). Compose has no tooltip text on the anchor; the tooltip is a popup announced as a live region when shown.
- `md-tooltip` android (extra): The Android tooltip popup is a polite live region (how Compose tooltips announce); Web exposes the tooltip text as the anchor description.
- `md-dialog` android (role): Decision 8: Android has no alert-dialog role. The dialog is a pane titled by its headline (paneTitle), which TalkBack announces when it appears, as for a platform AlertDialog window.
- `md-dialog` android (description): Decision 8: Android has no described-by relation; the message is the text TalkBack reads right after the pane title.

## Results

| Component | Cases | macOS | iOS | Android | Open findings |
| --- | --- | --- | --- | --- | --- |
| [`md-accordion`](../../outputs/native-parity/md-accordion/accessibility/report.md) | 2 | pass | pass | pass | — |
| [`md-avatar`](../../outputs/native-parity/md-avatar/accessibility/report.md) | 3 | pass | pass | pass | — |
| [`md-badge`](../../outputs/native-parity/md-badge/accessibility/report.md) | 3 | pass | pass | pass | — |
| [`md-bottom-sheet`](../../outputs/native-parity/md-bottom-sheet/accessibility/report.md) | 1 | pass, 2 accepted | pass | pass | — |
| [`md-button`](../../outputs/native-parity/md-button/accessibility/report.md) | 8 | pass | pass | pass | — |
| [`md-button-group`](../../outputs/native-parity/md-button-group/accessibility/report.md) | 3 | pass | pass | pass | — |
| [`md-card`](../../outputs/native-parity/md-card/accessibility/report.md) | 3 | pass | pass | pass | — |
| [`md-checkbox`](../../outputs/native-parity/md-checkbox/accessibility/report.md) | 8 | pass, 1 accepted | pass | pass | — |
| [`md-chip`](../../outputs/native-parity/md-chip/accessibility/report.md) | 6 | pass, 2 accepted | pass | pass | — |
| [`md-dialog`](../../outputs/native-parity/md-dialog/accessibility/report.md) | 1 | pass, 3 accepted | pass | pass, 2 accepted | — |
| [`md-divider`](../../outputs/native-parity/md-divider/accessibility/report.md) | 2 | pass, 2 accepted | pass, 2 accepted | pass, 2 accepted | — |
| [`md-fab`](../../outputs/native-parity/md-fab/accessibility/report.md) | 4 | pass | pass | pass | — |
| [`md-fab-menu`](../../outputs/native-parity/md-fab-menu/accessibility/report.md) | 2 | pass | pass | pass | — |
| [`md-icon-button`](../../outputs/native-parity/md-icon-button/accessibility/report.md) | 6 | pass | pass | pass | — |
| [`md-list`](../../outputs/native-parity/md-list/accessibility/report.md) | 3 | pass | pass | pass | — |
| [`md-loading-indicator`](../../outputs/native-parity/md-loading-indicator/accessibility/report.md) | 2 | pass | pass | pass | — |
| [`md-meter`](../../outputs/native-parity/md-meter/accessibility/report.md) | 3 | pass | pass, 3 accepted | pass | — |
| [`md-organization-chart`](../../outputs/native-parity/md-organization-chart/accessibility/report.md) | 8 | pass | pass | pass | — |
| [`md-progress-indicator`](../../outputs/native-parity/md-progress-indicator/accessibility/report.md) | 3 | pass | pass | pass | — |
| [`md-radio`](../../outputs/native-parity/md-radio/accessibility/report.md) | 5 | pass, 1 accepted | pass | pass | — |
| [`md-ripple`](../../outputs/native-parity/md-ripple/accessibility/report.md) | 2 | pass | pass | pass | — |
| [`md-segmented-button`](../../outputs/native-parity/md-segmented-button/accessibility/report.md) | 1 | pass | pass | pass | — |
| [`md-segmented-button-set`](../../outputs/native-parity/md-segmented-button-set/accessibility/report.md) | 2 | pass | pass | pass | — |
| [`md-side-sheet`](../../outputs/native-parity/md-side-sheet/accessibility/report.md) | 1 | pass | pass | pass | — |
| [`md-skeleton`](../../outputs/native-parity/md-skeleton/accessibility/report.md) | 2 | pass, 1 accepted | pass, 1 accepted | pass | — |
| [`md-snackbar`](../../outputs/native-parity/md-snackbar/accessibility/report.md) | 3 | pass | pass | pass | — |
| [`md-split-button`](../../outputs/native-parity/md-split-button/accessibility/report.md) | 4 | pass | pass | pass | — |
| [`md-status-dot`](../../outputs/native-parity/md-status-dot/accessibility/report.md) | 3 | pass | pass | pass | — |
| [`md-switch`](../../outputs/native-parity/md-switch/accessibility/report.md) | 5 | pass, 1 accepted | pass | pass | — |
| [`md-table`](../../outputs/native-parity/md-table/accessibility/md-table/report.md) | 3 | pass, 2 accepted | pass | pass, 24 accepted | — |
| [`md-table-body`](../../outputs/native-parity/md-table/accessibility/md-table-body/report.md) | 1 | pass | pass | pass | — |
| [`md-table-cell`](../../outputs/native-parity/md-table/accessibility/md-table-cell/report.md) | 1 | pass | pass | pass | — |
| [`md-table-container`](../../outputs/native-parity/md-table/accessibility/md-table-container/report.md) | 1 | pass | pass | pass, 2 accepted | — |
| [`md-table-expand-toggle`](../../outputs/native-parity/md-table/accessibility/md-table-expand-toggle/report.md) | 1 | pass | pass | pass | — |
| [`md-table-foot`](../../outputs/native-parity/md-table/accessibility/md-table-foot/report.md) | 1 | pass | pass | pass | — |
| [`md-table-head`](../../outputs/native-parity/md-table/accessibility/md-table-head/report.md) | 1 | pass | pass | pass, 1 accepted | — |
| [`md-table-pagination`](../../outputs/native-parity/md-table/accessibility/md-table-pagination/report.md) | 2 | 7 open, 1 accepted | 7 open, 2 accepted | 7 open, 11 accepted | macos missing ×4; macos extra ×2; macos focus ×1; ios missing ×4; ios extra ×2; ios focus ×1; android missing ×4; android extra ×2; android focus ×1 |
| [`md-table-row`](../../outputs/native-parity/md-table/accessibility/md-table-row/report.md) | 2 | pass | pass | pass | — |
| [`md-table-sort-label`](../../outputs/native-parity/md-table/accessibility/md-table-sort-label/report.md) | 2 | pass | pass | pass, 2 accepted | — |
| [`md-table-toolbar`](../../outputs/native-parity/md-table/accessibility/md-table-toolbar/report.md) | 2 | pass | pass | pass, 1 accepted | — |
| [`md-text-field`](../../outputs/native-parity/md-text-field/accessibility/report.md) | 5 | 3 open | 1 open | not landed | ios focus ×1; macos state ×1; macos missing ×1; macos text-extra ×1 |
| [`md-tooltip`](../../outputs/native-parity/md-tooltip/accessibility/report.md) | 2 | pass | pass | pass, 2 accepted | — |

## Open items

Remaining open findings after this run (each component's report lists them per case):

- **`md-text-field`** (landed 2026-10-28 in AWCUI; its iOS harness, Android port and Laboratory gates are in progress in lane n3):
  macOS does not report the error state as invalid and exposes a disabled field as static text instead of a disabled text field;
  on iOS hardware Tab does not reach the field. Handed to n3 with the evidence and the native API to use (`n3-lab/REQUESTS.md`);
  the component's gate-6 accessibility line closes with that fix and a re-run of `tools/ax`.

- **md-table family** (n4, 2026-10-30): table structure follows the platform encodings in `compare.mjs` (macOS AXTable →
  AXRow → AXCell; Android a named collection with heading header cells); iOS exposes no data-table structure — an
  exception pending acceptance in [md-table.md](md-table.md#exceptions). The pagination's rows-per-page md-select is the
  generic picker until the md-select renderer lands (fork n2): its role, name and tab stop stay open there.

- **md-date-picker** (story 1-5, 2026-11-15): closed, open and docked have no open finding on any platform. Reviewed conventions: Android touch targets below 48 dp (day cells and icon buttons keep the source 40 px geometry, at least the WCAG 2.5.8 24 px minimum), no tooltip text / described-by on Android, the dialog role and modal state on macOS (as md-time-picker), the modal Tab order start (natives enter at the focused day), and the Web docked rows that Chrome leaves out intermittently. Details in [md-date-picker.md](md-date-picker.md).

Everything else found by `tools/ax` in the earlier runs is fixed (F1–F30) or recorded as a reviewed platform convention
(decisions 1–8, `expectations.mjs`); every other component has no open finding on any platform.

## What the automated evidence covers — and what it does not

Covered: what assistive technologies are *given* — exposed elements, roles, names, values, states, actions, reading
order, keyboard focus order, live-region properties, announcements (macOS: observed `AXAnnouncementRequested` with
priority; Android: events sent by the preview windows), text and non-text contrast from the rendered pixels (WCAG 1.4.3,
1.4.11) and Android Accessibility Test Framework rules.

Not covered, needs a manual pass with the real screen readers: what VoiceOver/TalkBack *speak* (phrasing, verbosity,
hints), rotor/gesture navigation, screen-reader focus movement after actions, braille, Switch Control/Voice Control,
dynamic type beyond the tested sizes, dark mode (the cases render light), and real devices. Contrast is measured from
the captured pixels on every platform and compared with Web (see `contrast` in the tools/ax README). iOS announcements cannot be observed without VoiceOver running; AWC posts
them through the same SwiftUI code path as macOS, so the macOS capture stands for both. On Android the Laboratory
host draws on a private virtual display that the system accessibility service does not track; the probe reads the
same `AccessibilityNodeInfo` objects in process from the preview windows' node providers (see the tools/ax README).
