# Playground icon font

This **playground-only** subset replaces the 3,829,152-byte Material Symbols
Outlined variable font in the HTML, React, Vue, Svelte and Angular catalogues.
It does not change published Core font selection or consumer assets. The source
is `material-symbols@0.40.2` (Apache 2.0; see `LICENSE`). Existing legacy Material
Icons families remain unchanged; they do not download unless used.

The generator derives the actual GSUB ligature-name-to-glyph mapping, intersects
it with complete tokens in Core source/tests and all five playgrounds, and keeps
a conservative superset (including comment/identifier matches). Runtime branches
such as `visibility`/`visibility_off`, `menu`/`menu_open`, `calendar_today`/`edit`
and `check`/`close` are therefore included. It also preserves explicit PUA code
points. Unselected ligature rules are removed **before** glyph closure, so the
shared alphabet cannot accidentally retain the full font. FILL substitutions,
composite glyph dependencies and all FILL/GRAD/opsz/wght axes remain variable.

`coverage.json` records the pinned source hash, exact selected ligatures, source
examples, glyph count and verification results. Regenerate whenever demo/Core
icon names change. Arbitrary external icon names are outside this subset's scope;
a fallback font cannot repair a missing ligature whose letters exist in this font.
If adding names assembled from fragments at runtime, change that data to complete
source literals or extend the generator's explicit coverage and checks.

## Regenerate and check

Run from the repository root after installing the playground dependencies. Use
Python 3.12 with these isolated, pinned generation dependencies (not app runtime
dependencies):

```sh
python3.12 -m venv /tmp/awc-playground-fonts-venv
/tmp/awc-playground-fonts-venv/bin/pip install -r scripts/playground-icons-requirements.txt
/tmp/awc-playground-fonts-venv/bin/python scripts/generate-playground-icons.py
/tmp/awc-playground-fonts-venv/bin/python scripts/generate-playground-icons.py --check
node scripts/verify-playground-icons.mjs --artifacts=/tmp/awc-playground-icons
```

Generation verifies every selected ligature's output glyph, advances and outline
against the original at all 54 combinations of axis endpoints/defaults. `--check`
regenerates deterministically and fails on stale assets or coverage. The browser
check loads both actual WOFF2 files and compares Chromium pixels at six axis
configurations, including FILL 0/1 and weight/optical-size/grade extremes. It also
writes a sample original/subset image when `--artifacts` is supplied. No Core or
playground build is required for either verification command.
