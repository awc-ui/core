<script lang="ts">
  import SkelBar from './SkelBar.svelte';
  export let w = '100%';
  export let h = 14;
</script>
<SkelBar width={w} height={`${h}px`} radius="4px" />
