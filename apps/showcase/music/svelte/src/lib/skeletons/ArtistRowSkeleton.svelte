<script lang="ts">
  import SkelLine from './SkelLine.svelte';
  import SkelCircle from './SkelCircle.svelte';
</script>
<div class="artist-row">
  <SkelCircle size={48} />
  <div class="track-row__text"><SkelLine w="34%" h={20} /><SkelLine w="22%" h={16} /></div>
</div>
