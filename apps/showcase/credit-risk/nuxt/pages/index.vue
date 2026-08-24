<!--
  `/` — portfolio overview.

  Every page in this app is a thin wrapper around one screen component. The
  fixture selectors are pure and synchronous, so the screen renders completely
  inside the request — no `useAsyncData`, no suspense boundary, and the response
  carries real rows and real numbers rather than a loading state.
-->
<script setup lang="ts">
import OverviewScreen from '~/components/screens/OverviewScreen.vue';
</script>

<template>
  <OverviewScreen />
</template>
