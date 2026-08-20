<script>
  import '@awc-ui/core/css/tokens.css';
  import { onMount } from 'svelte';
  // Client-only: register the custom elements so the server DSD hydrates.
  onMount(async () => {
    const { defineCustomElements } = await import('@awc-ui/core/loader');
    defineCustomElements(window);
  });
</script>

<slot />
