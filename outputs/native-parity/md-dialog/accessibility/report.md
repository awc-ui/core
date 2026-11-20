# md-dialog — accessibility parity

Generated 2026-11-05T01:32:18.360Z by tools/ax. Web = Chrome AX tree of the same effective node.

## open

- Web: alertdialog:Project details · button:Cancel · button:OK · text: Every great project starts with a shared workspace. · Tab: button:OK → button:Cancel → button:OK → button:Cancel
- macos (pass): group:Project details · button:Cancel · button:OK · text: Every great project starts with a shared workspace. · Tab: button:OK → button:Cancel → button:OK → button:Cancel
  - expected role: role alertdialog → group ("Project details") — Decision 7: SwiftUI exposes an in-window modal surface as a named group; it offers no way to set the dialog subrole (AXApplicationDialog/AXApplicationAlertDialog) and `isModal` has no macOS mapping. Modality holds natively (focus trapped in the surface, content behind hidden from accessibility, Escape/scrim dismiss); VoiceOver reads the title, then the message.
  - expected state: alertdialog "Project details" modal: true → ∅ — Decision 7: no AXModal for SwiftUI in-window surfaces; the modal behavior itself (focus trap, hidden background) is native.
  - expected description: alertdialog "Project details" description "Every great project starts with a shared workspace." → "" — Decision 7: Web points the alert dialog's description at its message (aria-describedby); SwiftUI cannot reference a child as a group's description, so the message is the text read right after the title.
- ios (pass): button:Cancel · button:OK · text: Project details / Every great project starts with a shared workspace. · Tab: button:OK → button:Cancel → button:OK → button:Cancel
  - expected target: ios: button "Cancel" target 76×40 below 44pt
  - expected target: ios: button "OK" target 58×40 below 44pt
- android (pass): dialog:Project details · button:Cancel · button:OK · text: Every great project starts with a shared workspace. · Tab: button:OK → button:Cancel → button:OK → button:Cancel
  - expected role: role alertdialog → dialog ("Project details") — Decision 8: Android has no alert-dialog role. The dialog is a pane titled by its headline (paneTitle), which TalkBack announces when it appears, as for a platform AlertDialog window.
  - expected description: alertdialog "Project details" description "Every great project starts with a shared workspace." → "" — Decision 8: Android has no described-by relation; the message is the text TalkBack reads right after the pane title.
