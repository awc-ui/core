<script lang="ts">
  import PostCardSkeleton from './PostCardSkeleton.svelte';
  import RightRailSkeleton from './RightRailSkeleton.svelte';
</script>

<div class="columns">
  <div class="columns__main"><PostCardSkeleton media lines={3} /></div>
  <RightRailSkeleton />
</div>
