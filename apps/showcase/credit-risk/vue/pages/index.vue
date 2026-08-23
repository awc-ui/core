<!--
  `/` — portfolio overview.

  Every page in this app is a thin wrapper around one screen component. The
  fixture selectors are pure and synchronous, so the screen renders completely
  during the prerender — the static HTML carries real rows and real numbers, not
  a loading state.
-->
<script setup lang="ts">
import OverviewScreen from '~/components/screens/OverviewScreen.vue';
</script>

<template>
  <OverviewScreen />
</template>
