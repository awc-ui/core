<!-- A labelled figure inside a `.dl` grid. -->
<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <div>
    <dt>{{ label }}</dt>
    <dd><slot /></dd>
  </div>
</template>
