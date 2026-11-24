<script>
  import '@awc-ui/core/css/tokens.css';
  import { onMount } from 'svelte';
  import { awcHydration } from '$lib/awc';

  onMount(() => {
    awcHydration.restore();
    // Explicit entries are bundled with their dependencies and adopt server DSD.
    void import('$lib/components').catch((error) => console.error('[awc-ui]', error));
  });
</script>

<slot />
