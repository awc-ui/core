<!--
  The two stylesheets, and the moment the component runtime is allowed to start.

  The stylesheets are custom properties and page furniture with no runtime, and
  letting Vite emit them as real stylesheets is exactly what we want. The app
  sheet lives in the kit because every framework build shares the same grid —
  see `@awc-ui/showcase-kit/credit-risk/app.css`.

  The component runtime is still NOT bundled — it arrives from
  `static/awc-runtime/`, and `scripts/sync-runtime.mjs` explains why putting it
  through Vite breaks it. What is new is WHEN it runs. `hooks.server.ts` used to
  import it from a module script in `<head>`; now it only preloads it, and this
  `onMount` executes it. This is the first moment in the app's life at which
  Svelte has finished CLAIMING the server's markup — and claiming is what
  strips the `s-id` marker Stencil reads to decide between adopting the
  server-rendered shadow roots and rendering a second copy into each of them.
  `src/lib/adopt.ts` is the file to read; this is one line of it.
-->
<script>
  import { onMount } from 'svelte';
  import { startComponentRuntime } from '$lib/adopt';
  import '@awc-ui/core/css/tokens.css';
  import '@awc-ui/showcase-kit/credit-risk/app.css';

  onMount(() => {
    startComponentRuntime();
  });
</script>

<svelte:head>
  <title>Aurelia Bank — Credit Risk Console</title>
</svelte:head>

<slot />
