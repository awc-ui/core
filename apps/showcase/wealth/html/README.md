# Kestrel Private Bank — Wealth Management Console (plain HTML)

The no-framework build of the `wealth` showcase vertical. Five framework builds
render the same six screens from the same fixture; this one is written out as
static HTML files at build time and served at
`awc-ui.dev/showcase/wealth/html/`.

```bash
pnpm --filter @awc-ui/showcase-wealth-html build    # -> dist/
pnpm --filter @awc-ui/showcase-wealth-html serve    # dist/ at the real mount path (:4332)
pnpm --filter @awc-ui/showcase-wealth-html verify   # drive the built output in a browser
```

`build` runs `sync-runtime` first, which needs `packages/core/dist` to exist
(`pnpm --filter @awc-ui/core build`).

## Screens

| Route | Screen |
|---|---|
| `/` | Book overview |
| `/holdings/` | Holdings |
| `/households/[id]/` | Household drill (8 pages) |
| `/proposals/` | Proposals |
| `/trade/` | Trade |
| `/planning/` | Planning |

13 screens × 3 locales = **39 static files**, plus one client bundle and six
stylesheets.

## The decisions worth knowing

**There is no framework, and the templating is nine lines.** `src/lib/html.mjs`
is a tagged template that escapes every interpolation unless it is itself the
result of `html` — the same rule JSX follows, written down once because nothing
else here enforces it. Household names, advisors and instruments come out of
the fixture and go straight into markup, so it genuinely earns its keep.

**The language is in the URL, not in client state.** There is no client-side
rendering to re-run, so the strings inside a file are already in a language:
`/html/` is English, `/html/ro/` Romanian, `/html/ar/` Arabic and right-to-left.
The default locale stays unprefixed so the entry URL matches the other four
builds. `<awc-showcase-dock locale-route="en">` makes the dock's language picker
navigate rather than fire a state change nothing would re-render for, and
`data-locale-route` on `<html>` stops a stale locale in localStorage from
stamping the wrong `lang` over a page written in another language. Theme,
density and accent are pure CSS and still come from storage.

**The chrome is the React build's, emitted per page.** The React app hoists its
app bar, rail and bottom bar above the router so the same elements survive
navigation; here every document simply contains the whole frame, with
`active-index` baked in from the route and every destination a real localized
`href` — a nav click is a page load, so nothing intercepts anything. The two
behaviours a static document cannot carry (the rail's expand toggle, the FAB —
`md-fab` has no `href` prop) are progressive enhancements in
`src/client/shell.mjs`.

**JavaScript only adds behaviour.** The client bundle carries the dock, the
chart configuration that cannot travel in attributes (`src/client/charts.mjs`
applies axes and locale-bound formatters, and names every plot region through
the translator), and the shell enhancements. The screens phase adds one
idempotent `enhance*()` per interactive behaviour, each detaching rather than
hiding DOM so the live element census matches React's.

**The components are not bundled.** Stencil's lazy runtime is copied into
`public/awc-runtime/` by `scripts/sync-runtime.mjs` (verbatim the React app's
copy) and loaded from a static absolute URL. Putting it through a bundler makes
it resolve its entry chunks under the bundler's own paths, where the build never
wrote them, and every element renders at zero height. `esbuild` builds the
client bundle only, and declares `@awc-ui/core` external so nothing can quietly
put the loader back into the graph.

## Checking it

`pnpm lint` is the stand-in for the type-check the other four builds get: it
imports every module (a stray backtick inside an `html` template silently ends
it) and renders all 13 screens in all three locales, failing on `undefined`,
`[object Object]` or an unresolved dictionary key in the output.

`pnpm verify` starts a server (:4341) and drives a real browser: chrome readable
with JavaScript disabled, every component upgraded, the dock present and
labelled, the rail toggle firing, the Arabic tree translated and right-to-left
with in-locale navigation, and a stale locale in storage losing to the language
the page is written in.
