/**
 * @awc-ui/svelte
 *
 * Svelte integration for AWC UI Material Design 3 components.
 *
 * Registration is client-only. In a plain Vite/SPA app:
 * @example
 * import { defineCustomElements } from '@awc-ui/svelte';
 * defineCustomElements(window);
 *
 * Under SvelteKit (SSR), guard it so it runs only in the browser — and for
 * server-rendered markup use `@awc-ui/core/hydrate` (`renderToString`):
 * @example
 * import { browser } from '$app/environment';
 * import { defineCustomElements } from '@awc-ui/svelte';
 * if (browser) defineCustomElements(window);
 *
 * Then use components directly in .svelte files:
 * @example
 * <md-button variant="filled">Click me</md-button>
 */
export * from './lib/components';
