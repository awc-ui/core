<!-- `/counterparties/[id]/` — 24 pages, one per obligor. -->
<script setup lang="ts">
import CounterpartyScreen from '~/components/screens/CounterpartyScreen.vue';

const route = useRoute();
const counterpartyId = computed(() => String(route.params.id));
</script>

<template>
  <CounterpartyScreen :counterparty-id="counterpartyId" />
</template>
