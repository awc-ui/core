<script lang="ts">
  import SkelBar from './SkelBar.svelte';
  import SkelLine from './SkelLine.svelte';
  import PostCardSkeleton from './PostCardSkeleton.svelte';
  import RailPanelSkeleton from './RailPanelSkeleton.svelte';
  export let timeline = false;
</script>

<div class="columns">
  <div class="columns__main">
    <div class="skel-card">
      <SkelBar width="100%" height="240px" radius="16px" />
      <SkelLine w="52%" h={26} />
      <div class="row" style="gap: 8px">
        <SkelBar width="86px" height="30px" radius="9999px" />
        <SkelBar width="104px" height="30px" radius="9999px" />
        <SkelBar width="128px" height="36px" radius="9999px" />
      </div>
      <SkelLine w="100%" h={13} />
      <SkelLine w="88%" h={13} />
    </div>
    {#if timeline}
      <PostCardSkeleton lines={2} />
      <PostCardSkeleton media lines={3} />
    {/if}
  </div>
  <aside class="columns__rail">
    <RailPanelSkeleton rows={1} avatars />
    <RailPanelSkeleton rows={4} avatars />
  </aside>
</div>
