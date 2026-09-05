<!--
  A run of loudness samples as bars.

  THE HEIGHT IS A DATA ATTRIBUTE, NOT A STYLE: `style-src-attr 'none'` refuses
  `style="height: 62%"`, so each sample is rounded to one of eleven buckets and
  `app.css` carries a rule per bucket. `aria-hidden`, because it is a texture.
-->
<script lang="ts">
  export let peaks: readonly number[];
  const bucket = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 10);
</script>

<span class="peaks" aria-hidden="true">
  {#each peaks as value, index (index)}<span class="peaks__bar" data-h={bucket(value)}></span>{/each}
</span>
