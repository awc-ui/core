# md-tooltip — accessibility parity

Generated 2026-10-29T11:11:40.613Z by tools/ax. Web = Chrome AX tree of the same effective node.

## plain

- Web: button:Hover or focus me · Tab: button:Hover or focus me
- macos (pass): button:Hover or focus me · Tab: button:Hover or focus me → button:Hover or focus me
- ios (pass): button:Hover or focus me · Tab: button:Hover or focus me → ∅
  - expected target: ios: button "Hover or focus me" target 149×40 below 44pt
- android (pass): button:Hover or focus me · Tab: button:Hover or focus me → button:Hover or focus me
  - expected description: button "Hover or focus me" description "One source. Every surface." → "" — Web: the tooltip describes its anchor (aria-describedby). Compose has no tooltip text on the anchor; the tooltip is a popup announced as a live region when shown.

## rich

- Web: button:Hover or focus me · Tab: button:Hover or focus me
- macos (pass): button:Hover or focus me · Tab: button:Hover or focus me → button:Hover or focus me
- ios (pass): button:Hover or focus me · Tab: button:Hover or focus me → ∅
  - expected target: ios: button "Hover or focus me" target 149×40 below 44pt
- android (pass): button:Hover or focus me · Tab: button:Hover or focus me → button:Hover or focus me
  - expected description: button "Hover or focus me" description "Design systems. One source. Every surface." → "" — Web: the tooltip describes its anchor (aria-describedby). Compose has no tooltip text on the anchor; the tooltip is a popup announced as a live region when shown.
