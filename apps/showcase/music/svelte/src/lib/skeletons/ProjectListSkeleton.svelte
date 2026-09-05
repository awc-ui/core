<script lang="ts">
  import SkelBar from './SkelBar.svelte';
  import SkelLine from './SkelLine.svelte';
  export let count: number;
</script>
<div class="stack">
  {#each Array(count) as _, i (i)}
    <div class="project-card">
      <SkelBar width="64px" height="64px" radius="8px" />
      <div class="track-row__text"><SkelLine w="30%" h={20} /><SkelLine w="18%" h={16} /></div>
    </div>
  {/each}
</div>
