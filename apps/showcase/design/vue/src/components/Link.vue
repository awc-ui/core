<script setup lang="ts">
import { useRouter, isPlainActivation } from "~/lib/router";
import { withBase } from "~/lib/routes";
const props = defineProps<{ href: string }>();
const router = useRouter();
function click(event: MouseEvent) {
  if (!isPlainActivation(event) || event.defaultPrevented) return;
  event.preventDefault();
  router.push(props.href);
}
</script>
<template>
  <a :href="withBase(href)" @click="click"><slot /></a>
</template>
