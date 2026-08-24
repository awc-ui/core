/**
 * Vite's own ambient types.
 *
 * The one thing this build actually needs from them is `declare module '*.css'`.
 * `src/main.ts` imports `@awc-ui/core/css/tokens.css` and
 * `@awc-ui/showcase-kit/credit-risk/app.css` as side effects — real stylesheets
 * that Vite turns into a `<link>`, and that TypeScript would otherwise report as
 * unresolvable modules. The SvelteKit build in this pair got the same
 * declaration from its generated `.svelte-kit/tsconfig.json`; there is no
 * generated tsconfig here, so it is referenced explicitly.
 */

/// <reference types="svelte" />
/// <reference types="vite/client" />
