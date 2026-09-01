<!--
  The chrome that OUTLIVES navigation.

  The route outlet in `App.vue` renders a different component per route, so
  everything inside the outlet is unmounted and rebuilt on every click. When
  the app bar and the rail lived inside each screen (the credit-risk builds'
  arrangement), that meant a BRAND NEW `md-navigation-rail` on each navigation —
  and a new element has nothing to animate FROM, so the active indicator jumped
  to its destination instead of sliding, and the rail's expand/collapse width
  transition never ran either. So this frame wraps the outlet, is rendered
  once, and the routed screen drops into `<main>`.

  Exactly ONE navigation surface is present at a time. The rail and the bar
  render the same five destinations from the kit's `DESTINATIONS`, and
  `app.css` shows one and `display: none`s the other at 900px — hidden, not
  merely invisible, so a screen reader never finds two "Main navigation"
  landmarks claiming different current destinations.
-->
<script setup lang="ts">
import AppBar from './AppBar.vue';
import Rail from './Rail.vue';
import Bar from './Bar.vue';
import DockBar from './DockBar.vue';
</script>

<template>
  <div class="shell">
    <AppBar />

    <div class="shell__body">
      <Rail />

      <main class="shell__main"><slot /></main>
    </div>

    <Bar />
  </div>
  <DockBar />
</template>
