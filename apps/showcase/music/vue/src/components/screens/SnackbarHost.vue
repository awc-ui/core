<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';
import { useSnackbar } from '~/components/screens/useSnackbar';

const t = useT();
const { message, close } = useSnackbar();
const text = computed(() => (message.value ? t.value(message.value.key, message.value.params) : ''));
</script>

<template>
  <md-snackbar
    class="app-snackbar"
    :open="message !== null || undefined"
    :message="text"
    :duration="4000"
    @mdClose="close()"
  />
</template>
