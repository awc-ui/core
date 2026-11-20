# md-step — accessibility parity

Generated 2026-11-05T01:33:54.830Z by tools/ax. Web = Chrome AX tree of the same effective node.

## standalone

- Web: button:Step 1 of 0: Workspace, current · text: Choose a project name · Tab: button:Step 1 of 0: Workspace, current
- macos (pass): button:Step 1 of 0: Workspace, current · text: Choose a project name · Tab: button:Step 1 of 0: Workspace, current → button:Step 1 of 0: Workspace, current
- ios (pass): button:Step 1 of 0: Workspace, current · Tab: button:Step 1 of 0: Workspace, current → ∅
  - expected text-missing: text not exposed on ios: "Choose a project name" — Decision 9: md-step.css `@media (max-width: 599px)` hides a horizontal row's supporting captions; natively the rule follows the screen width, and the iPhone / phone emulator screens are narrower than 600 (the Web capture runs at desktop width). The captions are not painted there, so they are not exposed.
- android (pass): alert: · button:Step 1 of 0: Workspace, current · Tab: button:Step 1 of 0: Workspace, current → button:Step 1 of 0: Workspace, current
  - expected text-missing: text not exposed on android: "Choose a project name" — Decision 9: md-step.css `@media (max-width: 599px)` hides a horizontal row's supporting captions; natively the rule follows the screen width, and the iPhone / phone emulator screens are narrower than 600 (the Web capture runs at desktop width). The captions are not painted there, so they are not exposed.
