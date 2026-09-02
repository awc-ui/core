<!--
  A KPI tile's shape: label line, value line, optional sparkline, foot line.

  `spark` is what the tile actually has, not decoration. `KpiTile` draws a
  sparkline only when the screen gives it one — the overview's tiles do, the
  holdings tiles do not.

  `foot` is the same fact about the tile's last line: a foot carrying a bare
  hint is one 16px text line; a foot carrying a chip beside that text is 32,
  because the chip is 32.

  Exactly one shape per screen skeleton announces (role="status") with the
  screen name — pass `announce` on that one and only that one.
-->
<script lang="ts">
  export let announce = false;
  export let label: string | undefined = undefined;
  export let spark = true;
  /** `'32px'` when the real tile's foot holds a chip, `'16px'` when it is text alone. */
  export let foot = '32px';
</script>

<div class="skel-card skel-card--filled">
  <!-- The heights are the tile's OWN, measured off a rendered `KpiTile`: a
       16px label, a 32px value, a 34px sparkline, and a foot of 16 or 32. -->
  <div class="kpi">
    <div
      class="skel"
      style="block-size: 16px; inline-size: 60%"
      role={announce ? 'status' : undefined}
      aria-label={announce ? label : undefined}
    />
    <div class="skel" style="block-size: 32px; inline-size: 45%" />
    {#if spark}
      <div class="kpi__spark">
        <div class="skel" style="block-size: 34px; inline-size: 100%" />
      </div>
    {/if}
    <div class="skel" style="block-size: {foot}; inline-size: 70%" />
  </div>
</div>
