<script lang="ts">
  import SkelBar from './SkelBar.svelte';
  import SkelCircle from './SkelCircle.svelte';
  import PostCardSkeleton from './PostCardSkeleton.svelte';
  import RightRailSkeleton from './RightRailSkeleton.svelte';
</script>

<div class="columns">
  <div class="columns__main">
    <div class="skel-card">
      <!-- `flex="1"`, not `width="100%"`: a 100%-wide bar in a flex row is 100%
           of the ROW and wraps under the avatar. -->
      <div class="row" style="gap: 12px; align-items: center; flex-wrap: nowrap">
        <SkelCircle size={40} />
        <SkelBar flex="1" height="44px" radius="9999px" />
      </div>
    </div>
    <PostCardSkeleton lines={3} />
    <PostCardSkeleton media lines={2} />
    <PostCardSkeleton lines={4} />
  </div>
  <RightRailSkeleton />
</div>
