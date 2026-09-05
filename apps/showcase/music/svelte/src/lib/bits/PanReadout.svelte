<!--
  A side and an amount, never a signed number: "L 0" and "R 0" are both wrong,
  and a build formatting a signed float produces one of them.
-->
<script lang="ts">
  import { panPosition } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  export let pan: number;
  $: position = panPosition(pan);
</script>

<span class="strip__readout">{position.side === 'centre'
  ? $t('music.label.panCentre')
  : $t(position.side === 'left' ? 'music.label.panLeft' : 'music.label.panRight', {
      amount: $t.formatNumber(position.amount),
    })}</span>
