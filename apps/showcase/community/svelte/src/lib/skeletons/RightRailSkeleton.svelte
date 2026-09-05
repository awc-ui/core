<!-- Inside `.columns__rail`, so it disappears below 1200px at exactly the width
     the thing it stands for does — no media query of its own to keep in step. -->
<script lang="ts">
  import RailPanelSkeleton from './RailPanelSkeleton.svelte';
</script>

<aside class="columns__rail">
  <RailPanelSkeleton rows={2} />
  <RailPanelSkeleton rows={3} />
  <RailPanelSkeleton rows={5} avatars />
</aside>
