<script lang="ts">
  import PanelSkeleton from './PanelSkeleton.svelte';
  import ProjectListSkeleton from './ProjectListSkeleton.svelte';
  import SkelBar from './SkelBar.svelte';
  import SkelLine from './SkelLine.svelte';
</script>
<div class="stack">
  <!-- The project header carries no panel title. -->
  <PanelSkeleton head={false}>
    <div class="studio-head">
      <div class="studio-head__facts">
        <SkelBar width="64px" height="64px" radius="8px" />
        <div class="track-row__text"><SkelLine w="180px" h={28} /><SkelLine w="240px" h={20} /></div>
      </div>
      <div class="row">
        <SkelBar width="84px" height="32px" radius="16px" />
        <SkelBar width="84px" height="32px" radius="16px" />
      </div>
    </div>
  </PanelSkeleton>

  <!-- The arrangement in the REAL lane grid: a ruler with seven lanes says a
       timeline is coming and how many tracks are on it. -->
  <PanelSkeleton>
    <div class="lanes">
      <div class="lane-names">
        <div class="lane-names__pad"></div>
        {#each Array(7) as _, i (i)}<div class="lane-name"><SkelLine w="70%" h={16} /></div>{/each}
      </div>
      <div>
        <SkelBar height="28px" radius="0" />
        {#each Array(7) as _, i (i)}<SkelBar height="56px" radius="0" />{/each}
      </div>
    </div>
  </PanelSkeleton>

  <!-- The history opens empty, so this is the empty state's height. -->
  <PanelSkeleton><SkelBar height="96px" radius="8px" /></PanelSkeleton>
  <PanelSkeleton><ProjectListSkeleton count={4} /></PanelSkeleton>
</div>
