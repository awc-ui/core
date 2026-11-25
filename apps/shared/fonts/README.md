# Playground icon font

This **playground-only** subset replaces the 3,829,152-byte Material Symbols
Outlined variable font in the HTML, React, Vue, Svelte and Angular catalogues.
It does not change published Core font selection or consumer assets. The source
is `material-symbols@0.40.2` (Apache 2.0; see `LICENSE`). Existing legacy Material
Icons families remain unchanged; they do not download unless used.

The generator derives the GSUB ligature-to-glyph mapping and keeps complete
tokens from the five playgrounds. For Core, it uses the workspace TypeScript
parser to retain production string literals, template literal values, JSX text
and object keys. It keeps quoted CSS values and explicit private-use code
points. Runtime branches such as `visibility`/`visibility_off`, `menu`/`menu_open`,
`calendar_today`/`edit` and `check`/`close` are included. The generator removes
unselected ligature rules before glyph closure and retains FILL substitutions,
composite glyph dependencies and all FILL/GRAD/opsz/wght axes.

`coverage.json` records the pinned source hash, exact selected ligatures, source
examples, glyph count and verification results. Regenerate whenever demo or Core
icon names change. Use complete source literals for names assembled from values
that only exist at runtime, or extend the generator to cover that data. CSS font
fallback operates on the input letters and cannot supply a missing ligature.

## Regenerate and check

Run from the repository root after installing workspace dependencies. Use
Python 3.12 with the pinned generation dependencies in an isolated environment.

```sh
python3.12 -m venv /tmp/awc-playground-fonts-venv
/tmp/awc-playground-fonts-venv/bin/pip install -r scripts/playground-icons-requirements.txt
/tmp/awc-playground-fonts-venv/bin/python scripts/generate-playground-icons.py
/tmp/awc-playground-fonts-venv/bin/python scripts/generate-playground-icons.py --check
node --test scripts/playground-icon-literals.test.mjs
node scripts/verify-playground-icons.mjs --artifacts=/tmp/awc-playground-icons
```

Generation verifies every selected ligature's output glyph, advances and outline
against the original at all 54 combinations of axis endpoints/defaults. `--check`
regenerates deterministically and fails on stale assets or coverage. The browser
check loads both actual WOFF2 files and compares Chromium pixels at six axis
configurations, including FILL 0/1 and weight, optical-size and grade extremes.
Use `--artifacts` to save sample original and subset images. After rebuilding the
five production catalogs, run `node scripts/verify-playground-icons.mjs --catalogs`
to check the served font hash and the ligatures rendered through catalog
interactions, including inside shadow roots.
