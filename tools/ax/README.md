# tools/ax — accessibility parity

`tools/ax` captures the accessibility tree that assistive technologies receive for the same component case on
Web, macOS SwiftUI, iOS (simulator) and Android (emulator), normalizes the four trees into one model and compares
every native platform with Web. It is the accessibility part of gate 6 in `docs/native-parity/AUDIT.md`;
results are summarized in `docs/native-parity/accessibility.md`.

## What is captured, and how

| Platform | Renderer | Tree source | Focus order |
| --- | --- | --- | --- |
| Web | Chrome for Testing (puppeteer), the component built from the **effective node** the macOS host rendered | CDP `Accessibility.getFullAXTree` (Chrome's platform accessibility tree) | trusted CDP `Tab` presses, focused node through `Accessibility.getPartialAXTree` |
| macOS | The Laboratory SwiftUI host (`AWCLivePreview --stdio`, `configure` = the Laboratory request) | `accessibility` command: the macOS Accessibility API (`AXUIElement` on the host process) — the interface VoiceOver uses — read on a background thread while the host's main thread services it | host `key Tab` (AppKit key-view loop), AppKit first responder + its AX role/label |
| iOS | `tools/ax/ios/AccessibilityProbe.swift` in the simulator harness (`apps/native-ios-parity`), rendering the **same effective node** with the Laboratory presentation | UIKit accessibility runtime switched on in-process (`_AXSSetAutomationEnabled`, as XCTest and accessibility inspectors do) so SwiftUI vends its nodes; walk of `accessibilityElements` / `accessibilityElement(at:)` in VoiceOver navigation order | real HID `Tab` key presses; `UIFocusSystem` focused item and first responder |
| Android | The Laboratory Compose host (`LivePreviewActivity`) driven by `AccessibilityProbeTest`, configured with the **same effective node**: the macOS node's properties and its `children` (the host renders exactly those children and leaves its own sample fixture out; a segmented set goes through `segmentedContext`) | the host draws into a `Presentation` on a private virtual display, which the system accessibility service does not track, so the probe reads the preview windows **in process**: each window's views and their `AccessibilityNodeProvider` — the `AccessibilityNodeInfo` objects Compose serves TalkBack for the same content in an ordinary window (`childOrder` in the capture says whether child order came from the provider or from Compose semantics). Accessibility Test Framework on the View hierarchy (`AccessibilityCheckPreset.LATEST`); contrast is measured by `contrast.mjs` from `PixelCopy` pixels. Events the preview windows send (announcements, live-region and pane changes) are recorded at the window root | the Compose root takes focus forward (unless the component already holds focus, as an open dialog does), then host `key Tab` (dispatched to the preview window like the Laboratory); focused Compose semantics node (lifted to the node that merges it) |

## Model and comparison

`normalize.mjs` turns each tree into **semantic elements** in reading order (`role`, `name`, `value`, `states`,
`range`, `actions`, `frame`) plus **text runs** that are not already part of a semantic element's name.
`ROLE_TABLE` documents how each ARIA role is encoded per platform (for example: iOS has no checkbox or radio trait;
AWC encodes a checkbox as a button whose value is Checked/Unchecked/Mixed). `compare.mjs` aligns native elements
to Web elements (longest common subsequence on compatible roles, preferring equal names) and reports:

- `missing` / `extra` elements, `role`, `name`, `state` (checked, pressed, expanded, selected, disabled, required,
  invalid, modal — states without a public platform channel are listed in `UNSUPPORTED_STATES` and not compared),
  `value`, `range` (min/max/now/valuetext), `description`, `live` (live regions);
- `text-missing` / `text-extra` (static text outside names, word by word);
- `focus` (Tab order: the first Web-length stops must match; extra native stops are reported);
- `contrast` (WCAG 1.4.3 text 4.5:1, or 3:1 for large text; 1.4.11 non-text 3:1 for controls), measured from each platform's
  captured pixels with the same method as on Web's pixels and quoted with the Web ratio: in a text box the most frequent
  colour is the background and the most contrasting frequent colour the foreground (the Accessibility Test Framework's
  method); a control's most contrasting part is measured against a 3-unit ring around it. Disabled controls are exempt, and so is
  the text of a case marked `inactive` (an inactive component whose container reports no disabled state, e.g. a disabled card).
  Pixels: Web `page.screenshot` (2x), macOS the host window content (`cacheDisplay`), iOS the probe host view
  (`drawHierarchy`), Android every preview window copied with `PixelCopy` and composed in preview-display coordinates.
  Web's own failures are listed in each case as "Web contrast (reported for the Web source)";
- `announce` (a live-region update that is not announced, or announced at the wrong politeness: Web alert/assertive ↔ macOS
  priority high, status/polite ↔ below high);
- `lint` (unnamed controls) and `atf` (Android ATF errors and warnings); touch targets below 44 pt / 48 dp are reported as `info`.

A finding is **open** until it is fixed or matches a reviewed entry in `expectations.mjs` (documented platform
convention with its reason). Reports: `<out>/<tag>/report.md` and `report.json`; raw captures
`<out>/<tag>/<case>.<platform>.json`.

## Running

```sh
# all platforms for some components (macOS host binary: AWC_NATIVE_LIVE_RENDERER or the playground's .build/debug)
node tools/ax/run.mjs --tags md-checkbox,md-switch --out outputs/native-parity/_ax \
  --ios-device <simulator UDID> --android-serial emulator-5556 --android-project <android playground dir>
# one platform or only the comparison (captures are cached per case)
node tools/ax/run.mjs --tags md-chip --platforms web,compare
```

Requirements: the Laboratory SwiftUI host built with the `accessibility` command (it is part of
`apps/native-ios-playground/LiveRenderer`), Xcode with an iOS simulator for iOS, an emulator with the debug
playground for Android (`AccessibilityProbeTest` runs through `connectedDebugAndroidTest`; cases are written to the
test APK's assets), and puppeteer's Chrome for Web. macOS order: the Web and iOS phases read the effective node from
the macOS capture, so run `macos` first.

## Adding a component

1. Add cases to `cases.mjs` (Laboratory properties per case; `tabs` for the focus walk; `LANDED[tag]` when the component
   exists on only some native platforms — the others are skipped and reported as not run). Cover the default,
   every state with an accessibility effect (checked/selected/expanded/disabled/soft-disabled/error/required),
   an explicit `aria-label` where the source supports one, and live regions or announcements.
2. If the Laboratory renders the component inside a context (anchor, overlay host), mirror it for Web in
   `presentation.mjs` and for iOS in `ios/AccessibilityProbe.swift` (`AXProbeRoot.example`), the same way
   `PreviewRoot` (macOS) and `LivePreviewActivity` (Android) do.
3. Run all platforms, fix the open findings test-first, and add an `expectations.mjs` entry only for a reviewed
   platform convention (exact source behavior, native equivalent, reason).

## What this evidence covers — and what it does not

It covers what assistive technologies are *given*: the exposed elements, their roles, names, values, states,
actions, reading order, keyboard focus order, live-region properties, announcements (macOS: `AXAnnouncementRequested`
notifications with their priority, observed on the host process; Android: events sent by the preview windows) and
Android ATF rule results. iOS announcements are not observable without VoiceOver running: AWC posts them through the
same SwiftUI `AccessibilityNotification.Announcement` code as macOS, so the macOS capture stands for both. It does not cover what a screen reader *speaks* (phrasing, verbosity settings, rotor/gesture behavior),
VoiceOver/TalkBack focus movement after actions, braille output, Switch Control or Voice Control, dynamic type
beyond the tested sizes, or real-device differences. Those need a manual pass with the actual screen readers.
