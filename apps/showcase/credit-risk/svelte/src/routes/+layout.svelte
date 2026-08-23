<!--
  The two stylesheets, and nothing else.

  They are custom properties and page furniture with no runtime, and letting
  Vite emit them as real stylesheets is exactly what we want. The app sheet lives
  in the kit because all six framework builds share the same grid — see
  `@awc-ui/showcase-kit/credit-risk/app.css`.

  The component runtime is deliberately NOT imported here; it arrives as a module
  script pointing at `static/awc-runtime/`, injected by `hooks.server.ts`. See
  `scripts/sync-runtime.mjs` for why bundling it breaks it.
-->
<script>
  import '@awc-ui/core/css/tokens.css';
  import '@awc-ui/showcase-kit/credit-risk/app.css';
</script>

<svelte:head>
  <title>Aurelia Bank — Credit Risk Console</title>
</svelte:head>

<slot />
