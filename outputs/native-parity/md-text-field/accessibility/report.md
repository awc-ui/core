# md-text-field — accessibility parity

Generated 2026-11-05T01:32:20.611Z by tools/ax. Web = Chrome AX tree of the same effective node.

## default

- Web: textbox:Project name · text: A name your team will recognize · Tab: textbox:Project name
- macos (pass): textbox:Project name · text: A name your team will recognize · Tab: textbox:Project name → textbox:Project name
- ios (findings): textbox:Project name · text: A name your team will recognize · Tab: ∅ → ∅
  - **open** focus: Tab order web [textbox:Project name] → ios [∅ | ∅]
- android (pass): textbox:Project name · text: A name your team will recognize · Tab: textbox:Project name → textbox:Project name
  - expected description: textbox "Project name" description "A name your team will recognize" → "" — Web aria-describedby names the supporting text as the field's description. Android has no described-by relation for a view (stateDescription is a state): the supporting text is the field's next TalkBack stop, read right after it, and an error is the field's own AccessibilityNodeInfo error (reported as invalid with its message).

## filled

- Web: textbox:Project name · button:Clear · text: Visible to your team
- macos (pass): textbox:Project name · button:Clear · text: Visible to your team
- ios (pass): textbox:Project name · button:Clear · text: Visible to your team
  - expected target: ios: textbox "Project name" target 502×26 below 44pt
  - expected target: ios: button "Clear" target 40×40 below 44pt
- android (pass): textbox:Project name · button:Clear · text: Visible to your team
  - expected description: textbox "Project name" description "Visible to your team" → "" — Web aria-describedby names the supporting text as the field's description. Android has no described-by relation for a view (stateDescription is a state): the supporting text is the field's next TalkBack stop, read right after it, and an error is the field's own AccessibilityNodeInfo error (reported as invalid with its message).

## error

- Web: textbox:Email · button:Clear · alert: · text: Enter a valid email address
- macos (findings): textbox:Email · button:Clear · text: Enter a valid email address
  - **open** state: textbox "Email" invalid: true → ∅
- ios (pass): textbox:Email · button:Clear · text: Enter a valid email address
  - expected target: ios: textbox "Email" target 462×26 below 44pt
  - expected target: ios: button "Clear" target 40×40 below 44pt
- android (pass): textbox:Email {"invalid":"true"} · button:Clear · text: Enter a valid email address

## required

- Web: textbox:Project name · text: A name your team will recognize
- macos (pass): textbox:Project name {"required":"true"} · text: A name your team will recognize
- ios (pass): textbox:Project name · text: A name your team will recognize
- android (pass): textbox:Project name · text: A name your team will recognize
  - expected description: textbox "Project name" description "A name your team will recognize" → "" — Web aria-describedby names the supporting text as the field's description. Android has no described-by relation for a view (stateDescription is a state): the supporting text is the field's next TalkBack stop, read right after it, and an error is the field's own AccessibilityNodeInfo error (reported as invalid with its message).

## disabled

- Web: textbox:Project name · button:Clear · text: A name your team will recognize
- macos (findings): button:Clear {"disabled":"true"} · text: AWC Native / A name your team will recognize · Tab: ∅ → ∅
  - **open** missing: textbox "Project name" has no macos counterpart
  - **open** text-extra: macos exposes text Web does not: "AWC Native"
- ios (pass): textbox:Project name {"disabled":"true"} · button:Clear {"disabled":"true"} · text: A name your team will recognize · Tab: ∅ → ∅
- android (pass): textbox:Project name {"disabled":"true"} · button:Clear {"disabled":"true"} · text: A name your team will recognize · Tab: ∅ → ∅
  - expected description: textbox "Project name" description "A name your team will recognize" → "" — Web aria-describedby names the supporting text as the field's description. Android has no described-by relation for a view (stateDescription is a state): the supporting text is the field's next TalkBack stop, read right after it, and an error is the field's own AccessibilityNodeInfo error (reported as invalid with its message).
