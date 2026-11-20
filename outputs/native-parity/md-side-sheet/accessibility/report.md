# md-side-sheet — accessibility parity

Generated 2026-11-05T01:32:19.732Z by tools/ax. Web = Chrome AX tree of the same effective node.

## open

- Web: button:Open side sheet · region:Project details · button:Close side sheet · text: Every great project starts with a shared workspace. · Tab: button:Open side sheet → button:Close side sheet
- macos (pass): button:Open side sheet · group:Project details · button:Close side sheet · text: Every great project starts with a shared workspace. · Tab: button:Open side sheet → button:Close side sheet → button:Open side sheet → button:Close side sheet
- ios (pass): button:Open side sheet · button:Close side sheet · text: Project details / Every great project starts with a shared workspace. · Tab: button:Open side sheet → button:Close side sheet → ∅ → button:Open side sheet
  - expected target: ios: button "Open side sheet" target 134×40 below 44pt
  - expected target: ios: button "Close side sheet" target 40×40 below 44pt
- android (pass): button:Open side sheet · button:Close side sheet · text: Project details / Project details / Every great project starts with a shared workspace. · Tab: button:Open side sheet → button:Close side sheet → button:Open side sheet → button:Close side sheet

## modal

- no web capture
