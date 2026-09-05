<!-- The overlap comes from the same `--profile-overlap` the real header uses,
     and the ring is what makes the avatar visible: a grey disc on a grey band
     is one shape. -->
<script lang="ts">
  import SkelBar from './SkelBar.svelte';
  import SkelLine from './SkelLine.svelte';
  import SkelCircle from './SkelCircle.svelte';
  import PostCardSkeleton from './PostCardSkeleton.svelte';
  import RailPanelSkeleton from './RailPanelSkeleton.svelte';
</script>

<div class="columns">
  <div class="columns__main">
    <div class="skel-card" style="padding: 0">
      <SkelBar width="100%" height="205px" radius="12px 12px 0 0" />
      <div
        class="row"
        style="align-items: flex-start; gap: 16px; padding: 0 16px 16px; margin-block-start: calc(var(--profile-overlap, 36px) * -1)"
      >
        <span class="profile-head__avatar" style="position: relative; z-index: 1">
          <SkelCircle size={62} />
        </span>
        <div
          class="stack"
          style="flex: 1; gap: 6px; padding-block-start: calc(var(--profile-overlap, 36px) + 8px)"
        >
          <SkelLine w="40%" h={24} />
          <SkelLine w="26%" h={14} />
        </div>
      </div>
      <div class="row" style="gap: 32px; padding: 0 16px 16px">
        {#each Array(4) as _}
          <div class="stack" style="gap: 4px">
            <SkelLine w="48px" h={20} />
            <SkelLine w="64px" h={12} />
          </div>
        {/each}
      </div>
    </div>
    <PostCardSkeleton lines={2} />
    <PostCardSkeleton media lines={3} />
  </div>
  <aside class="columns__rail">
    <RailPanelSkeleton rows={4} />
    <div class="skel-card">
      <SkelLine w="40%" h={16} />
      <div class="photo-grid" style="margin-block-start: 8px; background: transparent">
        {#each Array(6) as _}
          <SkelBar width="100%" height="86px" radius="0" />
        {/each}
      </div>
    </div>
  </aside>
</div>
