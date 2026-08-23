<!-- A drill link into the next screen down. NuxtLink prefixes the base path. -->
<script setup lang="ts">
defineProps<{
  /** Root-relative path WITHOUT the base path — NuxtLink prefixes it. */
  to: string;
}>();
</script>

<template>
  <NuxtLink class="drill" :to="to"><slot /></NuxtLink>
</template>
