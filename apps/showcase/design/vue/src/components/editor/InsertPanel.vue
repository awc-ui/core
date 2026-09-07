<script setup lang="ts">
import { pictorSearchText } from "@awc-ui/pictor-model";

const t = useT();
import { useT } from "~/composables/useShowcase";

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
import { getAssets } from "@awc-ui/showcase-kit/design";
import {
  useDocument,
  useTreeRows,
  useSelectableIds,
} from "~/composables/useDocument";
import {
  createLayer,
  layerFromAsset,
  LIVE_COMPONENTS,
  ORB_ART,
  WAVE_ART,
  LANDSCAPE_ART,
  DEFAULT_SWATCHES,
} from "@awc-ui/pictor-model";
import PanelTabs from "~/components/editor/PanelTabs.vue";
import TextControl from "~/components/editor/TextControl.vue";
type Pointer = PointerEvent;

const props = withDefaults(defineProps<{ category?: "components" | "art" }>(), {
  category: "components",
});
const category = toRef(props, "category");
if (category.value === undefined) {
  /* default supplied through defaults below */
}
const doc = useDocument();
const tab = ref<string>(category.value);
const setTab = (
  next: typeof tab.value | ((current: typeof tab.value) => typeof tab.value),
) => {
  tab.value = typeof next === "function" ? next(tab.value) : next;
};
watchLifecycle(
  () => setTab(category.value),
  () => [category.value],
);
const query = ref("");
const setQuery = (
  next:
    typeof query.value | ((current: typeof query.value) => typeof query.value),
) => {
  query.value = typeof next === "function" ? next(query.value) : next;
};
const assets = computed(() =>
  getAssets().filter((asset) =>
    asset.name.toLowerCase().includes(query.value.toLowerCase()),
  ),
);
const insert = (layer: ReturnType<typeof createLayer>) => {
  doc.commitLayers("create", (layers) => [...layers, layer], [layer.id]);
  doc.setTool("select");
};
const searchMetadata = (item: { name: string; description?: string }) =>
  pictorSearchText(
    [
      item.name,
      t(item.name),
      item.description ?? "",
      t(item.description ?? ""),
    ].join(" "),
  ).includes(pictorSearchText(query.value));
</script>
<template>
  <div class="studio-insert" data-insert-panel>
    <div class="studio-panel-heading">
      <span class="material-symbols-outlined" aria-hidden="true"
        >add_circle</span
      >
      <div>
        <h3>{{ t("Your creative toolkit") }}</h3>
        <p>{{ t("Click anything to make it yours.") }}</p>
      </div>
    </div>
    <TextControl
      :live="true"
      :label="t('Search assets')"
      :value="query"
      :onValue="setQuery"
    ></TextControl
    ><PanelTabs
      :label="t('Asset type')"
      :value="tab"
      :onValue="setTab"
      :options="[
        { value: 'components', label: t('Live UI') },
        { value: 'art', label: t('Artwork') },
        { value: 'color', label: t('Color') },
      ]"
    ></PanelTabs>
    <template v-if="tab === 'components'"
      ><div class="studio-callout">
        <span class="material-symbols-outlined" aria-hidden="true"
          >touch_app</span
        >
        <p>
          {{
            t(
              "Real AWC components. Add one, then enter Present to interact with it.",
            )
          }}
        </p>
      </div>
      <div class="studio-insert-grid">
        <template
          v-for="item in LIVE_COMPONENTS.filter(searchMetadata)"
          :key="item.id"
          ><button
            class="studio-insert-item"
            :data-insert-component="item.id"
            @click="
              () =>
                insert(
                  createLayer(
                    'component',
                    {
                      x: 16,
                      y: 12,
                      w: item.id === 'awc:card' ? 17 : 15,
                      h: item.id === 'awc:card' ? 14 : 5,
                    },
                    { name: item.name, componentId: item.id, fill: '#BEE7AA' },
                  ),
                )
            "
          >
            <span
              class="studio-insert-item__icon material-symbols-outlined"
              aria-hidden="true"
              >{{ item.icon }}</span
            ><strong>{{ t(item.name) }}</strong
            ><span>{{ t(item.description) }}</span
            ><span
              class="studio-insert-item__plus material-symbols-outlined"
              aria-hidden="true"
              >add</span
            >
          </button></template
        >
      </div></template
    ><template v-else
      ><template v-if="tab === 'art'"
        ><div class="studio-art-grid">
          <template
            v-for="item in [
              { name: 'Orbital sculpture', art: ORB_ART },
              { name: 'Electric ribbon', art: WAVE_ART },
              { name: 'New horizons', art: LANDSCAPE_ART },
            ].filter(searchMetadata)"
            :key="item.name"
            ><button
              @click="
                () =>
                  insert(
                    createLayer(
                      'image',
                      { x: 14, y: 6, w: 20, h: 20 },
                      { name: item.name, art: item.art, fill: null },
                    ),
                  )
              "
            >
              <img :src="item.art.src" alt="" /><span>{{ t(item.name) }}</span>
            </button></template
          >
        </div>
        <p class="studio-label">{{ t("FROM YOUR LIBRARY") }}</p>
        <div class="studio-art-grid">
          <template
            v-for="asset in assets.filter((asset) => asset.art).slice(0, 18)"
            :key="asset.id"
            ><button @click="() => insert(layerFromAsset(asset))">
              <img :src="asset.art!.src" alt="" loading="lazy" /><span>{{
                asset.name
              }}</span>
            </button></template
          >
        </div></template
      ><template v-else
        ><p class="studio-description">
          {{
            t(
              "A curated palette for your next composition. Add a color shape, then make it your own in the inspector.",
            )
          }}
        </p>
        <div class="studio-color-grid">
          <template
            v-for="color in DEFAULT_SWATCHES.filter((color) =>
              color.toLowerCase().includes(query.toLowerCase()),
            )"
            :key="color"
            ><button
              :aria-label="t('Insert {color} rectangle', { color: color })"
              @click="
                () =>
                  insert(
                    createLayer(
                      'rect',
                      { x: 16, y: 10, w: 16, h: 12 },
                      { name: color, fill: color },
                    ),
                  )
              "
            >
              <svg viewBox="0 0 80 64" aria-hidden="true">
                <rect width="80" height="64" rx="10" :fill="color"></rect></svg
              ><span>{{ color }}</span>
            </button></template
          >
        </div></template
      ></template
    >
  </div>
</template>
