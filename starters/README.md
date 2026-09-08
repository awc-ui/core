# AWC UI starters

Five minimal, standalone starter projects, each rendering the same compact
mini-dashboard — app bar, two stat cards, a line chart, a small table, and a
dark-mode switch — against the **published** packages
(`@awc-ui/core@^1.0.0-beta`, `@awc-ui/tokens@^1.0.0-beta`, plus the framework
wrapper where one exists).

These folders are intentionally **outside the pnpm workspace**: each one
installs from the npm registry with plain `npm install`, exactly the way a
consumer would.

| Starter | Wiring highlights |
|---|---|
| [`next/`](./next) | App Router; SSR DSD via `@awc-ui/react/server` wrappers; client components for the chart + theme switch |
| [`nuxt/`](./nuxt) | Nitro `render:html` hook + `@awc-ui/core/hydrate` for SSR DSD; client plugin registers the elements |
| [`sveltekit/`](./sveltekit) | `hooks.server.ts` `transformPageChunk` + `@awc-ui/core/hydrate`; static adapter prerenders with DSD baked in |
| [`astro/`](./astro) | Middleware post-processes pages with `@awc-ui/core/hydrate` at build time; inline script registers the elements |
| [`html/`](./html) | No build step — `@awc-ui/core` loader from esm.sh, tokens CSS from jsDelivr |

Every starter's README carries an **Open in StackBlitz** badge of the form
`https://stackblitz.com/fork/github/awc-ui/core/tree/main/starters/<name>`
(the links work once this directory lands on the `main` branch).

## Run any of them

Use Node.js 20.19 or later. The Astro starter requires Node.js 22.12 or later.

```sh
cd <starter>
npm install     # not needed for html/
npm run dev     # html/: npm start
```

## Verify consumer installations

From the repository root, after building core and React:

```sh
node scripts/verify-starters.mjs --starter=next,nuxt,sveltekit,astro
node scripts/verify-starters.mjs --source=registry
```

The first command installs packed candidate packages into clean temporary projects
outside the workspace, builds them, and verifies server DSD, browser adoption,
chart data, and the theme switch. The second tests published package ranges and
the HTML starter's CDN URLs; run it after publishing the matching release.
The source starter may use APIs added since the last release. Candidate tests
verify those before publication; registry tests verify the published result.

Use `--starter=sveltekit` to select one project and `--keep` to inspect its
installation and lockfile. npm uses a temporary cache by default. Pass
`--cache=/path/to/cache` to reuse an explicit cache, with `--offline` when its
registry packages are already cached. The HTML starter also validates `npm install`;
its browser check loads the published CDN URLs and requires network access. Chromium must
be installed for Puppeteer. `--skip-browser` explicitly limits verification to
installation, production build, and initial HTML; it does not prove hydration.

Dependency ranges intentionally allow compatible releases. This harness records
the resolved versions in each temporary project's package-lock.json; use
`--keep` to preserve it when diagnosing a regression.
