<!-- The root layout returns Stencil's render markers after Svelte has claimed
     the document. The lazy runtime then adopts the parser-created shadow roots. -->
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
