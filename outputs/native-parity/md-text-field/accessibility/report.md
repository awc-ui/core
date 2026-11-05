# md-text-field — accessibility parity

Generated 2026-10-29T11:11:43.095Z by tools/ax. Web = Chrome AX tree of the same effective node.

## default

- Web: textbox:Project name · text: A name your team will recognize · Tab: textbox:Project name
- macos (pass): textbox:Project name · text: A name your team will recognize · Tab: textbox:Project name → textbox:Project name
- ios (findings): textbox:Project name · text: A name your team will recognize · Tab: ∅ → ∅
  - **open** focus: Tab order web [textbox:Project name] → ios [∅ | ∅]
- android (not-run): 

## filled

- Web: textbox:Project name · button:Clear · text: Visible to your team
- macos (pass): textbox:Project name · button:Clear · text: Visible to your team
- ios (pass): textbox:Project name · button:Clear · text: Visible to your team
  - expected target: ios: textbox "Project name" target 502×26 below 44pt
  - expected target: ios: button "Clear" target 40×40 below 44pt
- android (not-run): 

## error

- Web: textbox:Email · button:Clear · alert: · text: Enter a valid email address
- macos (findings): textbox:Email · button:Clear · text: Enter a valid email address
  - **open** state: textbox "Email" invalid: true → ∅
- ios (pass): textbox:Email · button:Clear · text: Enter a valid email address
  - expected target: ios: textbox "Email" target 462×26 below 44pt
  - expected target: ios: button "Clear" target 40×40 below 44pt
- android (not-run): 

## required

- Web: textbox:Project name · text: A name your team will recognize
- macos (pass): textbox:Project name {"required":"true"} · text: A name your team will recognize
- ios (pass): textbox:Project name · text: A name your team will recognize
- android (not-run): 

## disabled

- Web: textbox:Project name · button:Clear · text: A name your team will recognize
- macos (findings): button:Clear {"disabled":"true"} · text: AWC Native / A name your team will recognize · Tab: ∅ → ∅
  - **open** missing: textbox "Project name" has no macos counterpart
  - **open** text-extra: macos exposes text Web does not: "AWC Native"
- ios (pass): textbox:Project name {"disabled":"true"} · button:Clear {"disabled":"true"} · text: A name your team will recognize · Tab: ∅ → ∅
- android (not-run): 
