# md-snackbar — accessibility parity

Generated 2026-10-29T11:11:40.392Z by tools/ax. Web = Chrome AX tree of the same effective node.

## open

- Web: status: · button:Undo · button:Dismiss · text: Project saved · Tab: button:Undo → button:Dismiss
- macos (pass): button:Undo · button:Dismiss · text: Project saved · Tab: button:Undo → button:Dismiss → button:Undo · announced: Changes archived
- ios (pass): button:Undo · button:Dismiss · text: Project saved · Tab: button:Undo → button:Dismiss → ∅
  - expected target: ios: button "Undo" target 65×40 below 44pt
  - expected target: ios: button "Dismiss" target 40×40 below 44pt
- android (pass): status: · button:Undo · button:Dismiss · text: Project saved · Tab: button:Undo → button:Dismiss → button:Undo

## assertive

- Web: alert: · button:Undo · button:Dismiss · text: Project saved
- macos (pass): button:Undo · button:Dismiss · text: Project saved
- ios (pass): button:Undo · button:Dismiss · text: Project saved
  - expected target: ios: button "Undo" target 65×40 below 44pt
  - expected target: ios: button "Dismiss" target 40×40 below 44pt
- android (pass): alert: · button:Undo · button:Dismiss · text: Project saved

## message-only

- Web: status: · text: Project saved
- macos (pass):  · text: Project saved
- ios (pass):  · text: Project saved
- android (pass): status: · text: Project saved
