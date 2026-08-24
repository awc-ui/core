<!--
  `/sectors/[sector]/` — one screen per sector, seven of them in the fixture.

  There is no route list any more: the dynamic segment is matched at request
  time and the id is looked up in the kit's fixture, so adding a sector to the
  kit adds a screen here with no second edit and no rebuild.
-->
<script setup lang="ts">
import SectorScreen from '~/components/screens/SectorScreen.vue';

const route = useRoute();
const sectorId = computed(() => String(route.params.sector));
</script>

<template>
  <SectorScreen :sector-id="sectorId" />
</template>
