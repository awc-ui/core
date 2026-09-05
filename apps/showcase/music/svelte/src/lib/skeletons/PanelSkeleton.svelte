<!--
  The card a panel is, without the card.

  The skeletons cannot use `md-card`: it is a lazily-hydrated custom element
  exactly like the content it stands in for. `.skel-panel` carries an outlined
  card's box and pads by 16, because `md-card` pads its own host by 16 ON TOP of
  `.panel__inner`'s 16 — both are needed, or the placeholder is 32px shorter
  than the panel it covers, per panel.

  `head` is not decoration: `Panel` renders no head when it has no title.
-->
<script lang="ts">
  import SkelLine from './SkelLine.svelte';
  export let head = true;
</script>

<div class="skel-panel">
  <div class="panel__inner">
    {#if head}
      <div class="panel__head">
        <SkelLine w="180px" h={20} />
        <SkelLine w="24px" h={20} />
      </div>
    {/if}
    <slot />
  </div>
</div>
