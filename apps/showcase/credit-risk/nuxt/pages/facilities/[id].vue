<!-- `/facilities/[id]/` — 61 pages, one per committed line. -->
<script setup lang="ts">
import FacilityScreen from '~/components/screens/FacilityScreen.vue';

const route = useRoute();
const facilityId = computed(() => String(route.params.id));
</script>

<template>
  <FacilityScreen :facility-id="facilityId" />
</template>
