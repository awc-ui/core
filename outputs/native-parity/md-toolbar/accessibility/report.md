# md-toolbar — accessibility parity

Generated 2026-11-05T01:32:20.791Z by tools/ax. Web = Chrome AX tree of the same effective node.

## default

- Web: toolbar:Formatting · button:Undo · button:Redo · separator: · togglebutton:Bold · togglebutton:Italic · Tab: button:Undo
- macos (pass): toolbar:Formatting · button:Undo · button:Redo · togglebutton:Bold {"pressed":"false"} · togglebutton:Italic {"pressed":"false"} · Tab: button:Undo → button:Undo → button:Undo
- ios (pass): button:Undo · button:Redo · switch:Bold {"checked":"false"} · switch:Italic {"checked":"false"} · text: Separator Vertical · Tab: button:Undo → ∅ → button:Undo
  - expected text-extra: ios exposes text Web does not: "Separator Vertical" — The md-divider between the actions: Web role=separator; no native platform has a separator role, so the divider is the labelled element "Separator" (the md-divider convention; iOS adds its orientation as the value: "Separator, Vertical"). macOS drops it inside a role=toolbar container (Chrome's AXSplitter is optional there) and keeps it in generic mode.
  - expected target: ios: button "Undo" target 40×40 below 44pt
  - expected target: ios: button "Redo" target 40×40 below 44pt
  - expected target: ios: switch "Bold" target 40×40 below 44pt
  - expected target: ios: switch "Italic" target 40×40 below 44pt
- android (pass): button:Undo · button:Redo · togglebutton:Bold {"pressed":"false"} · togglebutton:Italic {"pressed":"false"} · text: Formatting / Separator · Tab: button:Undo → button:Undo → button:Undo
  - expected text-extra: android exposes text Web does not: "Formatting Separator" — Web role=toolbar named by aria-label, and role=separator. Compose has neither role: the toolbar is a traversal group whose contentDescription carries the label (read before its controls), and the divider is described "Separator"; the checker reports both as text.
  - expected target: android: button "Undo" target 88×96 below 48dp
  - expected target: android: togglebutton "Bold" target 88×96 below 48dp
  - expected atf: ATF ERROR TouchTargetSizeCheck: This item's width is 44dp. Consider making the width of this touch target 48dp or larger. [android.view.View ""] — A floating toolbar packs its 40 dp icon buttons 4 dp apart (Web geometry, gap 4 px): 48 dp targets would overlap their neighbours, so each control keeps its 44 dp pitch; WCAG 2.5.8 (24 px) is met as on the Web and the paint parity verifies the geometry.
  - expected atf: ATF ERROR TouchTargetSizeCheck: This item's width is 44dp. Consider making the width of this touch target 48dp or larger. [android.view.View ""] — A floating toolbar packs its 40 dp icon buttons 4 dp apart (Web geometry, gap 4 px): 48 dp targets would overlap their neighbours, so each control keeps its 44 dp pitch; WCAG 2.5.8 (24 px) is met as on the Web and the paint parity verifies the geometry.

## docked

- Web: toolbar:Formatting · button:Undo · button:Redo · separator: · togglebutton:Bold · togglebutton:Italic · Tab: button:Undo
- macos (pass): toolbar:Formatting · button:Undo · button:Redo · togglebutton:Bold {"pressed":"false"} · togglebutton:Italic {"pressed":"false"} · Tab: button:Undo → button:Undo
- ios (pass): button:Undo · button:Redo · switch:Bold {"checked":"false"} · switch:Italic {"checked":"false"} · text: Separator Vertical · Tab: button:Undo → ∅
  - expected text-extra: ios exposes text Web does not: "Separator Vertical" — The md-divider between the actions: Web role=separator; no native platform has a separator role, so the divider is the labelled element "Separator" (the md-divider convention; iOS adds its orientation as the value: "Separator, Vertical"). macOS drops it inside a role=toolbar container (Chrome's AXSplitter is optional there) and keeps it in generic mode.
  - expected target: ios: button "Undo" target 40×40 below 44pt
  - expected target: ios: button "Redo" target 40×40 below 44pt
  - expected target: ios: switch "Bold" target 40×40 below 44pt
  - expected target: ios: switch "Italic" target 40×40 below 44pt
- android (pass): button:Undo · button:Redo · togglebutton:Bold {"pressed":"false"} · togglebutton:Italic {"pressed":"false"} · text: Formatting / Separator · Tab: button:Undo → button:Undo
  - expected text-extra: android exposes text Web does not: "Formatting Separator" — Web role=toolbar named by aria-label, and role=separator. Compose has neither role: the toolbar is a traversal group whose contentDescription carries the label (read before its controls), and the divider is described "Separator"; the checker reports both as text.

## vertical

- Web: toolbar:Formatting · button:Undo · button:Redo · separator: · togglebutton:Bold · togglebutton:Italic · Tab: button:Undo
- macos (pass): toolbar:Formatting · button:Undo · button:Redo · togglebutton:Bold {"pressed":"false"} · togglebutton:Italic {"pressed":"false"} · Tab: button:Undo → button:Undo
- ios (pass): button:Undo · button:Redo · switch:Bold {"checked":"false"} · switch:Italic {"checked":"false"} · text: Separator Vertical · Tab: button:Undo → ∅
  - expected text-extra: ios exposes text Web does not: "Separator Vertical" — The md-divider between the actions: Web role=separator; no native platform has a separator role, so the divider is the labelled element "Separator" (the md-divider convention; iOS adds its orientation as the value: "Separator, Vertical"). macOS drops it inside a role=toolbar container (Chrome's AXSplitter is optional there) and keeps it in generic mode.
  - expected target: ios: button "Undo" target 40×40 below 44pt
  - expected target: ios: button "Redo" target 40×40 below 44pt
  - expected target: ios: switch "Bold" target 40×40 below 44pt
  - expected target: ios: switch "Italic" target 40×40 below 44pt
- android (pass): button:Undo · button:Redo · togglebutton:Bold {"pressed":"false"} · togglebutton:Italic {"pressed":"false"} · text: Formatting / Separator · Tab: button:Undo → button:Undo
  - expected text-extra: android exposes text Web does not: "Formatting Separator" — Web role=toolbar named by aria-label, and role=separator. Compose has neither role: the toolbar is a traversal group whose contentDescription carries the label (read before its controls), and the divider is described "Separator"; the checker reports both as text.
  - expected target: android: button "Undo" target 96×88 below 48dp
  - expected target: android: togglebutton "Bold" target 96×88 below 48dp
  - expected atf: ATF ERROR TouchTargetSizeCheck: This item's height is 44dp. Consider making the height of this touch target 48dp or larger. [android.view.View ""] — A floating toolbar packs its 40 dp icon buttons 4 dp apart (Web geometry, gap 4 px): 48 dp targets would overlap their neighbours, so each control keeps its 44 dp pitch; WCAG 2.5.8 (24 px) is met as on the Web and the paint parity verifies the geometry.
  - expected atf: ATF ERROR TouchTargetSizeCheck: This item's height is 44dp. Consider making the height of this touch target 48dp or larger. [android.view.View ""] — A floating toolbar packs its 40 dp icon buttons 4 dp apart (Web geometry, gap 4 px): 48 dp targets would overlap their neighbours, so each control keeps its 44 dp pitch; WCAG 2.5.8 (24 px) is met as on the Web and the paint parity verifies the geometry.

## generic

- Web: button:Undo · button:Redo · separator: · togglebutton:Bold · togglebutton:Italic · Tab: button:Undo → button:Redo → togglebutton:Bold
- macos (pass): button:Undo · button:Redo · togglebutton:Bold {"pressed":"false"} · togglebutton:Italic {"pressed":"false"} · text: Separator · Tab: button:Undo → button:Redo → togglebutton:Bold
  - expected text-extra: macos exposes text Web does not: "Separator" — The md-divider between the actions: Web role=separator; no native platform has a separator role, so the divider is the labelled element "Separator" (the md-divider convention; iOS adds its orientation as the value: "Separator, Vertical"). macOS drops it inside a role=toolbar container (Chrome's AXSplitter is optional there) and keeps it in generic mode.
- ios (pass): button:Undo · button:Redo · switch:Bold {"checked":"false"} · switch:Italic {"checked":"false"} · text: Separator Vertical · Tab: button:Undo → button:Redo → switch:Bold
  - expected text-extra: ios exposes text Web does not: "Separator Vertical" — The md-divider between the actions: Web role=separator; no native platform has a separator role, so the divider is the labelled element "Separator" (the md-divider convention; iOS adds its orientation as the value: "Separator, Vertical"). macOS drops it inside a role=toolbar container (Chrome's AXSplitter is optional there) and keeps it in generic mode.
  - expected target: ios: button "Undo" target 40×40 below 44pt
  - expected target: ios: button "Redo" target 40×40 below 44pt
  - expected target: ios: switch "Bold" target 40×40 below 44pt
  - expected target: ios: switch "Italic" target 40×40 below 44pt
- android (pass): button:Undo · button:Redo · togglebutton:Bold {"pressed":"false"} · togglebutton:Italic {"pressed":"false"} · text: Separator · Tab: button:Undo → button:Redo → togglebutton:Bold
  - expected text-extra: android exposes text Web does not: "Separator" — The md-divider between the actions: Web role=separator; no native platform has a separator role, so the divider is the labelled element "Separator" (the md-divider convention; iOS adds its orientation as the value: "Separator, Vertical"). macOS drops it inside a role=toolbar container (Chrome's AXSplitter is optional there) and keeps it in generic mode.
  - expected target: android: button "Undo" target 88×96 below 48dp
  - expected target: android: togglebutton "Bold" target 88×96 below 48dp
  - expected atf: ATF ERROR TouchTargetSizeCheck: This item's width is 44dp. Consider making the width of this touch target 48dp or larger. [android.view.View ""] — A floating toolbar packs its 40 dp icon buttons 4 dp apart (Web geometry, gap 4 px): 48 dp targets would overlap their neighbours, so each control keeps its 44 dp pitch; WCAG 2.5.8 (24 px) is met as on the Web and the paint parity verifies the geometry.
  - expected atf: ATF ERROR TouchTargetSizeCheck: This item's width is 44dp. Consider making the width of this touch target 48dp or larger. [android.view.View ""] — A floating toolbar packs its 40 dp icon buttons 4 dp apart (Web geometry, gap 4 px): 48 dp targets would overlap their neighbours, so each control keeps its 44 dp pitch; WCAG 2.5.8 (24 px) is met as on the Web and the paint parity verifies the geometry.
