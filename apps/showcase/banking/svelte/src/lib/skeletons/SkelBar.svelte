<!--
  One placeholder bar with a corner of its own.

  A single `border-radius` for everything would be wrong in both directions:
  measured off the real holdings filter bar, `md-search` is a 9999px pill, an
  outlined text field is 4px, `md-chip` is 8px and `md-split-button` is 20px.

  `flex` is how a bar takes the SAME share of a `.row` its control does — the
  fields in that bar are laid out by `flex: 1 1 260px` and friends, and a
  placeholder that guessed a percentage instead would break at the first
  breakpoint.

  Named `SkelBar` rather than the React build's `Bar` because `Bar.svelte` is
  already the compact navigation bar in this port.
-->
<script lang="ts">
  /** A CSS length. The control's own corner, measured, not a guess. */
  export let radius: string;
  export let height: string;
  /** Omit to let the bar fill its box. */
  export let width: string | undefined = undefined;
  export let flex: string | undefined = undefined;

  $: style = [
    `block-size: ${height}`,
    width ? `inline-size: ${width}` : flex ? '' : 'inline-size: 100%',
    `border-radius: ${radius}`,
    flex ? `flex: ${flex}` : '',
  ]
    .filter(Boolean)
    .join('; ');
</script>

<div class="skel" {style} />
