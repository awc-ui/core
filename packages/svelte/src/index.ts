/**
 * Svelte 4/5 custom-element types and optional lazy-loader registration.
 *
 * In a client-rendered Vite app, load types and statically register what you use:
 * @example
 * import type {} from '@awc-ui/svelte';
 * import '@awc-ui/core/css/tokens.css';
 * import '@awc-ui/core/components/md-button';
 *
 * Under SvelteKit, use @awc-ui/core/ssr/sveltekit to preserve server-rendered
 * shadow roots, then dynamically import components after Svelte hydrates.
 * See the Svelte framework guide for the complete client/server lifecycle.
 */
export * from './lib/components.js';
export type { AwcElementAttributes } from './lib/elements.js';
