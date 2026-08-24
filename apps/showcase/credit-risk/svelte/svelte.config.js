import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Svelte on its own — no SvelteKit, no `kit` block, no adapter.
 *
 * `@sveltejs/vite-plugin-svelte` reads this file directly when it is used as a
 * plain Vite plugin, so `preprocess` and `onwarn` still apply. What is gone,
 * deliberately, is everything the meta-framework contributed: `paths.base` (the
 * mount is Vite's `base` now, and `src/lib/routes.ts` derives it from the kit),
 * `trailingSlash` (the kit's route table has always spelled every path with
 * one), the adapter, and the file-system router (`src/App.svelte` is six `{#if}`
 * branches over `location.pathname`).
 *
 * `vitePreprocess()` is what lets the components keep `<script lang="ts">`. It
 * is the only preprocessor here — no SCSS, no PostCSS beyond what Vite already
 * does for the two imported stylesheets.
 */

/**
 * Silence three a11y warnings, and ONLY on the library's own elements.
 *
 * Svelte's a11y linter reasons about the tag it can see. It cannot see into a
 * custom element's shadow root, so it is wrong about all three of these in the
 * same way:
 *
 * - `a11y-misplaced-scope` on `<md-table-cell head scope="col">`. The component
 *   renders a real `<th>` and forwards `scope` onto it — which is exactly why
 *   the prop exists, and dropping it would cost every table its column
 *   associations. 26 of these, one per header cell in the app.
 * - the two click-handler warnings on `<md-button on:click>`. It renders a real
 *   `<button>`; adding a `role` or a keyboard handler on the host would give
 *   the accessibility tree a second, competing control.
 *
 * The frame check is what keeps this honest: the same warning on a real `<td>`
 * or a real `<div on:click>` is still reported, because those would be genuine.
 * Nothing is suppressed globally.
 */
const SHADOWED = new Set([
  'a11y-misplaced-scope',
  'a11y-click-events-have-key-events',
  'a11y-no-noninteractive-element-interactions',
  'a11y-no-static-element-interactions',
]);

export default {
  preprocess: vitePreprocess(),
  onwarn(warning, handler) {
    if (SHADOWED.has(warning.code) && /<(md|awc)-/.test(warning.frame ?? '')) return;
    handler(warning);
  },
};
