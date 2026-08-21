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

```sh
cd <starter>
npm install     # not needed for html/
npm run dev     # html/: npm start
```
