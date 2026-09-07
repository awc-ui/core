<script setup lang="ts">
import { computed } from "vue";
import type { Layer } from "@awc-ui/showcase-kit/design";
import { colorOf, textLayout } from "@awc-ui/pictor-model";
import { useT } from "~/composables/useShowcase";
import LiveControl from "./LiveControl.vue";
import ImageEffects from "./ImageEffects.vue";
const props = withDefaults(
  defineProps<{ layer: Layer; presentation?: boolean }>(),
  { presentation: false },
);
const t = useT();
const fill = computed(() => colorOf(props.layer.fill, "none"));
const label = computed(() =>
  props.layer.textKey ? t(props.layer.textKey) : props.layer.name,
);
const text = computed(() => textLayout(props.layer, label.value));
</script>
<template>
  <div
    v-if="layer.componentId?.startsWith('awc:')"
    class="layer__live"
    :data-live="presentation ? '' : undefined"
  >
    <LiveControl :layer="layer" :presentation="presentation" />
  </div>
  <div v-else-if="layer.art" class="layer__image">
    <ImageEffects :adjustments="layer.adjustments"
      ><img
        :src="layer.art.src"
        :alt="layer.art.altKey ? t(layer.art.altKey) : layer.name"
        :draggable="false"
    /></ImageEffects>
  </div>
  <svg
    v-else-if="layer.kind !== 'group'"
    class="layer__paint"
    :viewBox="`0 0 ${layer.rect.w * 20} ${layer.rect.h * 20}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <text
      v-if="layer.kind === 'text'"
      x="0"
      :y="text.top"
      :fill="fill"
      :font-size="text.size"
      font-family="Arial,sans-serif"
      font-weight="600"
    >
      <tspan
        v-for="(line, i) in text.lines"
        :key="i"
        x="0"
        :dy="i ? text.lineHeight : 0"
      >
        {{ line }}
      </tspan>
    </text>
    <ellipse
      v-else-if="layer.kind === 'ellipse'"
      :cx="layer.rect.w * 10"
      :cy="layer.rect.h * 10"
      :rx="layer.rect.w * 10"
      :ry="layer.rect.h * 10"
      :fill="fill"
    />
    <rect
      v-else
      :width="layer.rect.w * 20"
      :height="layer.rect.h * 20"
      :fill="fill"
    />
  </svg>
</template>
