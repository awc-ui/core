# md-bottom-sheet — accessibility parity

Generated 2026-10-29T11:11:41.657Z by tools/ax. Web = Chrome AX tree of the same effective node.

## open

- Web: dialog:Project details · button:Close bottom sheet · text: Every great project starts with a shared workspace. · Tab: button:Close bottom sheet → button:Close bottom sheet → button:Close bottom sheet → button:Close bottom sheet
- macos (pass): group:Project details · button:Close bottom sheet · text: Every great project starts with a shared workspace. · Tab: button:Close bottom sheet → button:Close bottom sheet → button:Close bottom sheet → button:Close bottom sheet
  - expected role: role dialog → group ("Project details") — Decision 7: SwiftUI exposes an in-window modal surface as a named group; it offers no way to set the dialog subrole (AXApplicationDialog/AXApplicationAlertDialog) and `isModal` has no macOS mapping. Modality holds natively (focus trapped in the surface, content behind hidden from accessibility, Escape/scrim dismiss); VoiceOver reads the title, then the message.
  - expected state: dialog "Project details" modal: true → ∅ — Decision 7: no AXModal for SwiftUI in-window surfaces; the modal behavior itself (focus trap, hidden background) is native.
- ios (pass): button:Close bottom sheet · text: Project details / Every great project starts with a shared workspace. · Tab: button:Close bottom sheet → button:Close bottom sheet → button:Close bottom sheet → button:Close bottom sheet
  - expected target: ios: button "Close bottom sheet" target 40×40 below 44pt
- android (pass): dialog:Project details · button:Close bottom sheet · text: Every great project starts with a shared workspace. · Tab: button:Close bottom sheet → button:Close bottom sheet → button:Close bottom sheet → button:Close bottom sheet
