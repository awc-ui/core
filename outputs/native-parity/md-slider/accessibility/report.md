# md-slider — accessibility parity

Generated 2026-11-05T01:33:54.214Z by tools/ax. Web = Chrome AX tree of the same effective node.

## default

- Web: slider:Volume · text: 30 · Tab: slider:Volume
- macos (pass): slider:Volume · text: 30 · Tab: slider:Volume → slider:Volume
- ios (pass): slider:Volume · text: 30 · Tab: slider:Volume → ∅
  - expected target: ios: slider "Volume" target 24×44 below 44pt
- android (pass): slider:Volume · text: 30 · Tab: slider:Volume → slider:Volume

## range

- Web: slider:Minimum price · slider:Maximum price · text: 20 / 60 · Tab: slider:Minimum price → slider:Maximum price
- macos (pass): slider:Minimum price · slider:Maximum price · text: 20 / 60 · Tab: slider:Minimum price → slider:Maximum price → slider:Minimum price
- ios (pass): slider:Minimum price · slider:Maximum price · text: 20 / 60 · Tab: slider:Minimum price → slider:Maximum price → ∅
  - expected target: ios: slider "Minimum price" target 24×44 below 44pt
  - expected target: ios: slider "Maximum price" target 24×44 below 44pt
- android (pass): slider:Minimum price · slider:Maximum price · text: 20 / 60 · Tab: slider:Minimum price → slider:Maximum price → slider:Minimum price

## valuetext

- Web: slider:Brightness · text: 3
- macos (pass): slider:Brightness · text: 3
  - expected range: slider "Brightness" valuetext "3" → "Level 3 of 5" — The Web value is CDP's valuetext, which never carries aria-valuetext (Chrome 153 probe: a role="slider" with aria-valuetext reports "", a native range input its value string) while the input holds aria-valuetext="Level 3 of 5" from valueText. Native exposes valueText as the value description (macOS AXValueDescription, iOS accessibilityValue, Android stateDescription).
- ios (pass): slider:Brightness · text: 3
  - expected range: slider "Brightness" valuetext "3" → "Level 3 of 5" — The Web value is CDP's valuetext, which never carries aria-valuetext (Chrome 153 probe: a role="slider" with aria-valuetext reports "", a native range input its value string) while the input holds aria-valuetext="Level 3 of 5" from valueText. Native exposes valueText as the value description (macOS AXValueDescription, iOS accessibilityValue, Android stateDescription).
  - expected target: ios: slider "Brightness" target 24×44 below 44pt
- android (pass): slider:Brightness · text: 3
  - expected range: slider "Brightness" valuetext "3" → "Level 3 of 5" — The Web value is CDP's valuetext, which never carries aria-valuetext (Chrome 153 probe: a role="slider" with aria-valuetext reports "", a native range input its value string) while the input holds aria-valuetext="Level 3 of 5" from valueText. Native exposes valueText as the value description (macOS AXValueDescription, iOS accessibilityValue, Android stateDescription).

## vertical

- Web: slider:Volume · text: 40
- macos (pass): slider:Volume · text: 40
- ios (pass): slider:Volume · text: 40
  - expected target: ios: slider "Volume" target 44×24 below 44pt
- android (pass): slider:Volume · text: 40
  - expected target: android: slider "Volume" target 88×96 below 48dp

## disabled

- Web: slider:Volume · text: 30
  - Web contrast (reported for the Web source): text "30" 2.06:1 (#fbf9fb on #b1b0b1) < 4.5:1
- macos (pass): slider:Volume {"disabled":"true"} · text: 30 · Tab: ∅ → ∅
  - expected contrast: text "30" 2.06:1 (#fbf9fb on #b1b0b1) < 4.5:1; Web 2.06:1 — Disabled slider: the value label fades with the host (CSS opacity 0.38 over the indicator as one group) to the Web source's ratio; WCAG 1.4.3 exempts text of inactive user interface components.
- ios (pass): slider:Volume {"disabled":"true"} · text: 30 · Tab: ∅ → ∅
- android (pass): slider:Volume {"disabled":"true"} · text: 30 · Tab: ∅ → ∅
  - expected contrast: text "30" 2.04:1 (#fbf9fb on #b1b1b2) < 4.5:1; Web 2.06:1 — Disabled slider: the value label fades with the host (CSS opacity 0.38 over the indicator as one group) to the Web source's ratio; WCAG 1.4.3 exempts text of inactive user interface components.
