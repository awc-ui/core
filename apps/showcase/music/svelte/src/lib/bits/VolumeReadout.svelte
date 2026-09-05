<!--
  `volumeDb()` returns null at zero rather than `-Infinity`, and this is the one
  place that decision shows: a fader all the way down reads "Silent".
-->
<script lang="ts">
  import { volumeDb } from '@awc-ui/showcase-kit/music';
  import { t } from '$lib/showcase';
  export let volume: number;
  $: db = volumeDb(volume);
</script>

<span class="strip__readout">{db === null
  ? $t('music.label.silent')
  : $t('music.label.decibels', { value: $t.formatNumber(db, { maximumFractionDigits: 1 }) })}</span>
