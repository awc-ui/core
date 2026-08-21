<script>
  // Global MD3 design tokens (--md-sys-*) that the components' shadow styles
  // reference via var(). Must live in the document, not per shadow root.
  import '@awc-ui/tokens/tokens.css';
  import { onMount } from 'svelte';
  // Client-only: register the custom elements so the server DSD hydrates.
  onMount(async () => {
    const { defineCustomElements } = await import('@awc-ui/core/loader');
    defineCustomElements(window);
  });
</script>

<slot />
