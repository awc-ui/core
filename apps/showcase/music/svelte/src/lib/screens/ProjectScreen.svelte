<!--
  A project drill. It delegates to `StudioScreen` with a slug rather than
  reimplementing the arrangement: two copies of the timeline would be two places
  to fix the next thing found in it.
-->
<script lang="ts">
  import { projectBySlug } from '@awc-ui/showcase-kit/music';
  import StudioScreen from '$lib/screens/StudioScreen.svelte';
  import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';
  export let slug: string;
  /* The screen guards its own parameter: it came from a URL. */
  $: project = projectBySlug(slug);
</script>

{#if !project}<NotFoundScreen />{:else}<StudioScreen {slug} />{/if}
