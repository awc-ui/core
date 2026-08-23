<!--
  `/sectors/[sector]/` — one page per sector, all seven emitted at build time.

  The route list is built in `nuxt.config.ts` from the fixture rather than a
  hard-coded table, so adding a sector to the kit adds a page here without a
  second edit.
-->
<script setup lang="ts">
import SectorScreen from '~/components/screens/SectorScreen.vue';

const route = useRoute();
const sectorId = computed(() => String(route.params.sector));
</script>

<template>
  <SectorScreen :sector-id="sectorId" />
</template>
