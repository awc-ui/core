---
'@awc-ui/core': minor
---

**new `@awc-ui/core/css/pre-upgrade.css`:** opt-in size floors for the
lazy-loading window. The lazy runtime defines every tag at bootstrap and only
then fetches each component's chunk, so a layout-critical component is a 0-size
inline box until its CSS arrives — measured cold-load shifts of 64-132px on
rails, bars and toolbars, which consumers were closing by hand-copying private
`--_*` defaults into their own stylesheets.

The sheet ships one rule per covered component (rail, app bar, toolbar,
navigation bar, FAB), gated on `:not(.hydrated)` so each rule stops matching
the instant the component's own styles take over. Where the size lives on the
bare `:host` it is GENERATED from the component's own declaration at build time
and cannot drift; where it lives on an inner element the entry is curated and
the build fails if the source expression changes. Floors are `min-*`, so the
settled size simply satisfies them; nothing can regress after hydration.

Opt in with one import beside the token sheet:
`import '@awc-ui/core/css/pre-upgrade.css'`.
