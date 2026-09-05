<!-- The fallback. It is the FEED's shape rather than a neutral block, because
     the feed is the screen a reader arrives on and the one any unnamed screen
     is most likely to resemble. -->
<script lang="ts">
  import HomeSkeleton from './HomeSkeleton.svelte';
  export let label: string | undefined = undefined;
</script>

<div aria-label={label} aria-busy="true"><HomeSkeleton /></div>
