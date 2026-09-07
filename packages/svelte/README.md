# Svelte Web Components and SvelteKit SSR — @awc-ui/svelte

`@awc-ui/svelte` supplies types for AWC UI's native custom elements in Svelte 4
and 5. Property types and custom-event payloads come from the core declarations.

```bash
npm install @awc-ui/svelte @awc-ui/core
```

For a client-rendered Vite application, load the theme and register the components
you use through static imports. Import the Svelte package's types once:

```ts
// main.ts
import type {} from '@awc-ui/svelte';
import '@awc-ui/core/css/tokens.css';
import '@awc-ui/core/components/md-text-field';
import '@awc-ui/core/components/md-button';
```

Then use the native properties and custom events directly:

```svelte
<script lang="ts">
  let name = '';
</script>

<md-text-field
  label="Project name"
  value={name}
  on:mdInput={(event) => name = event.detail}
></md-text-field>
<md-button variant="filled">Create project</md-button>
```

The `mdInput` payload is inferred as a string, and invalid component property
values are reported by `svelte-check`. Svelte 5 also supports the event-handler
property spelling `onmdInput`. Use `value` plus the component's `mdInput` or
`mdChange` event to synchronize forms; the custom elements do not expose a
Svelte `bind:value` contract.

`defineCustomElements` remains available from `@awc-ui/svelte` for applications
that deliberately deploy the lazy loader and its runtime chunks. Static component
imports work with Vite's module graph and keep registration limited to the
components you use.

## SvelteKit server-side rendering

Use SvelteKit 2.10 or later for the client initialization hook. On the server,
transform the completed HTML response with `renderToString` from
`@awc-ui/core/hydrate`; `createPageTransform` from `@awc-ui/core/ssr/sveltekit`
buffers response chunks until the document is complete.

On the client, create a shared `createSvelteHydration()` instance from
`@awc-ui/core/ssr/sveltekit`. Call `capture()` from `hooks.client.ts`'s `init`
before Svelte hydrates, then call `restore()` in the root layout's `onMount`
before dynamically importing the SSR-capable component entries. This preserves
AWC shadow roots while Svelte claims the surrounding document.

The helper must come from the same AWC UI release as the core components. Follow
the complete [SvelteKit reference app](https://github.com/awc-ui/core/tree/main/apps/example-sveltekit)
and [shared SSR guide](https://awc-ui.dev/frameworks/ssr/) for the server hook and client lifecycle.
