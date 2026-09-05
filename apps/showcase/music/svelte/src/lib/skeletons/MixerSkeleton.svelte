<script lang="ts">
  import PanelSkeleton from './PanelSkeleton.svelte';
  import SkelBar from './SkelBar.svelte';
  import SkelLine from './SkelLine.svelte';
  import SkelCircle from './SkelCircle.svelte';
</script>
<PanelSkeleton>
  <div class="mixer">
    <!-- Seven strips, each measured: the real strip is 435px and holds a name,
         a 24px kind glyph, a 160px fader, a meter, two readouts, a 40px pan
         slider and two buttons. -->
    {#each Array(7) as _, i (i)}
      <div class="strip">
        <SkelLine w="70%" h={16} />
        <SkelLine w="40%" h={24} />
        <div class="strip__body"><SkelBar width="48px" height="160px" radius="8px" /></div>
        <SkelBar height="10px" radius="5px" />
        <SkelLine w="50%" h={16} />
        <SkelBar height="40px" radius="20px" />
        <SkelLine w="50%" h={16} />
        <div class="row"><SkelCircle size={40} /><SkelCircle size={40} /></div>
      </div>
    {/each}
  </div>
</PanelSkeleton>
