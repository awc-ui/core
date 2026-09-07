<script setup lang="ts">
import {
  computed,
  ref,
  shallowRef,
  toRefs,
  toRef,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { watchLifecycle } from "~/composables/lifecycle";
import Screen from "~/components/Screen.vue";
import EmptyState from "~/components/screens/EmptyState.vue";
import { useRouter } from "~/lib/router";
import { route } from "~/lib/routes";
import { useT } from "~/composables/useShowcase";
type Pointer = PointerEvent;

const t = useT();
const { push } = useRouter();
</script>
<template>
  <Screen
    :title="t('design.screen.notFound.title')"
    :subtitle="t('design.screen.notFound.subtitle')"
  >
    <EmptyState :message="t('design.screen.notFound.subtitle')"></EmptyState>
    <div class="row">
      <md-button
        class="notfound__home"
        variant="filled"
        icon="home"
        @click="() => push(route.projects())"
      >
        {{ t("design.nav.projects") }}
      </md-button>
    </div>
  </Screen>
</template>
