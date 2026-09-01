<!--
  The chrome that OUTLIVES navigation.

  The route outlet in `App.svelte` swaps a different screen component per
  route, so everything a screen renders is torn down and rebuilt on every
  click. If the app bar and the rail lived inside each screen, that would mean
  a BRAND NEW `md-navigation-rail` on each navigation — and a new element has
  nothing to animate FROM, so the active indicator would jump instead of slide
  and the expand/collapse width transition would never run.

  Rendered ONCE, above the outlet, with the routed screen dropped into `main`.
  Exactly ONE navigation surface is visible at a time: the rail and the bar
  render the same five destinations from the kit's `DESTINATIONS`, and
  `app.css` shows one and `display: none`s the other at 900px — hidden, not
  merely invisible, so a screen reader never finds two "Main navigation"
  landmarks claiming different current destinations.
-->
<script lang="ts">
  import AppBar from './AppBar.svelte';
  import Rail from './Rail.svelte';
  import Bar from './Bar.svelte';
  import Dock from './Dock.svelte';
</script>

<div class="shell">
  <AppBar />

  <div class="shell__body">
    <Rail />

    <main class="shell__main"><slot /></main>
  </div>

  <Bar />
</div>
<Dock />
