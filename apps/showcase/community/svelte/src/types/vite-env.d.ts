/**
 * Vite's own ambient types.
 *
 * The one thing this build actually needs from them is `declare module '*.css'`.
 * `src/main.ts` imports `@awc-ui/core/css/tokens.css`,
 * `@awc-ui/core/css/pre-upgrade.css` and `@awc-ui/showcase-kit/community/app.css`
 * as side effects — real stylesheets that Vite turns into a `<link>`, and that
 * TypeScript would otherwise report as unresolvable modules.
 */

/// <reference types="svelte" />
/// <reference types="vite/client" />
