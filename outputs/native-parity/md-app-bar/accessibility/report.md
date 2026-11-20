# md-app-bar — accessibility parity

Generated 2026-11-08T17:59:46.632Z by tools/ax. Web = Chrome AX tree of the same effective node.

## default

- Web: banner: · button:Open navigation · button:Search · text: Your workspace · Tab: button:Open navigation → button:Search
- macos (pass): button:Open navigation · button:Search · text: Your workspace · Tab: button:Open navigation → button:Search
  - expected missing: banner "" has no macos counterpart — Web <header role=banner> (the host, unnamed). SwiftUI cannot give a container the AXLandmarkBanner subrole, and an AppKit landmark bridge (md-navigation-rail / md-navigation-bar) re-hosts only focus elements, which would drop the headline, the subtitle and the slotted headline / subtitle / search content (the md-stepper decision): the bar's leading button, text, search field and actions are exposed in reading order without the landmark.
- ios (pass): button:Open navigation · button:Search · text: Your workspace · Tab: button:Open navigation → button:Search
  - expected missing: banner "" has no ios counterpart — Web <header role=banner>. UIKit exposes landmarks only as a container type, never as an element: the bar is a container (SwiftUI .contain) whose leading button, text, search field and actions VoiceOver reads in order.
- android (pass): button:Open navigation · button:Search · text: Your workspace · Tab: button:Open navigation → button:Search
  - expected missing: banner "" has no android counterpart — Web <header role=banner>. Compose has no landmark role: the bar's leading button, text, search field and actions are read in its layout order.

## center

- Web: banner: · button:Open navigation · button:Search · text: Your workspace / 12 unread · Tab: button:Open navigation → button:Search
- macos (pass): button:Open navigation · button:Search · text: Your workspace / 12 unread · Tab: button:Open navigation → button:Search
  - expected missing: banner "" has no macos counterpart — Web <header role=banner> (the host, unnamed). SwiftUI cannot give a container the AXLandmarkBanner subrole, and an AppKit landmark bridge (md-navigation-rail / md-navigation-bar) re-hosts only focus elements, which would drop the headline, the subtitle and the slotted headline / subtitle / search content (the md-stepper decision): the bar's leading button, text, search field and actions are exposed in reading order without the landmark.
- ios (pass): button:Open navigation · button:Search · text: Your workspace / 12 unread · Tab: button:Open navigation → button:Search
  - expected missing: banner "" has no ios counterpart — Web <header role=banner>. UIKit exposes landmarks only as a container type, never as an element: the bar is a container (SwiftUI .contain) whose leading button, text, search field and actions VoiceOver reads in order.
- android (pass): button:Open navigation · button:Search · text: Your workspace / 12 unread · Tab: button:Open navigation → button:Search
  - expected missing: banner "" has no android counterpart — Web <header role=banner>. Compose has no landmark role: the bar's leading button, text, search field and actions are read in its layout order.

## medium

- Web: banner: · button:Open navigation · button:Search · text: Your workspace / 12 unread · Tab: button:Open navigation → button:Search
- macos (pass): button:Open navigation · button:Search · text: Your workspace / 12 unread · Tab: button:Open navigation → button:Search
  - expected missing: banner "" has no macos counterpart — Web <header role=banner> (the host, unnamed). SwiftUI cannot give a container the AXLandmarkBanner subrole, and an AppKit landmark bridge (md-navigation-rail / md-navigation-bar) re-hosts only focus elements, which would drop the headline, the subtitle and the slotted headline / subtitle / search content (the md-stepper decision): the bar's leading button, text, search field and actions are exposed in reading order without the landmark.
- ios (pass): button:Open navigation · button:Search · text: Your workspace / 12 unread · Tab: button:Open navigation → button:Search
  - expected missing: banner "" has no ios counterpart — Web <header role=banner>. UIKit exposes landmarks only as a container type, never as an element: the bar is a container (SwiftUI .contain) whose leading button, text, search field and actions VoiceOver reads in order.
- android (pass): button:Open navigation · button:Search · text: Your workspace / 12 unread · Tab: button:Open navigation → button:Search
  - expected missing: banner "" has no android counterpart — Web <header role=banner>. Compose has no landmark role: the bar's leading button, text, search field and actions are read in its layout order.

## search

- Web: banner: · button:Open navigation · searchbox:Search mail · button:Search · Tab: button:Open navigation → searchbox:Search mail → button:Search
- macos (pass): button:Open navigation · searchbox:Search mail · button:Search · Tab: button:Open navigation → searchbox:Search mail → button:Search
  - expected missing: banner "" has no macos counterpart — Web <header role=banner> (the host, unnamed). SwiftUI cannot give a container the AXLandmarkBanner subrole, and an AppKit landmark bridge (md-navigation-rail / md-navigation-bar) re-hosts only focus elements, which would drop the headline, the subtitle and the slotted headline / subtitle / search content (the md-stepper decision): the bar's leading button, text, search field and actions are exposed in reading order without the landmark.
- ios (pass): button:Open navigation · searchbox:Search mail · button:Search · Tab: button:Open navigation → searchbox:Search mail → button:Search
  - expected missing: banner "" has no ios counterpart — Web <header role=banner>. UIKit exposes landmarks only as a container type, never as an element: the bar is a container (SwiftUI .contain) whose leading button, text, search field and actions VoiceOver reads in order.
- android (pass): button:Open navigation · textbox:Search mail · button:Search · Tab: button:Open navigation → textbox:Search mail → button:Search
  - expected missing: banner "" has no android counterpart — Web <header role=banner>. Compose has no landmark role: the bar's leading button, text, search field and actions are read in its layout order.
  - expected role: role searchbox → textbox ("Search mail") — Web role=searchbox. Android has no search-field role: the input is an EditText (TalkBack "edit box") named by the search label, with the Search IME action.
  - expected focus: Tab order web [button:Open navigation | searchbox:Search mail | button:Search] → android [button:Open navigation | textbox:Search mail | button:Search] — The same Tab stops and names as the Web; the search input reports textbox (Android has no search-field role, see the role entry).
