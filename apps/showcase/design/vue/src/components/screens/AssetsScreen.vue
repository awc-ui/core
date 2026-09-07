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
import { getAssets } from "@awc-ui/showcase-kit/design";
import Screen from "~/components/Screen.vue";
import TextControl from "~/components/editor/TextControl.vue";
import SelectControl from "~/components/editor/SelectControl.vue";
import {
  useDocument,
  useTreeRows,
  useSelectableIds,
} from "~/composables/useDocument";
import {
  colorOf,
  layerFromAsset,
  LIVE_COMPONENTS,
  createLayer,
} from "@awc-ui/pictor-model";
import Link from "~/components/Link.vue";
import { useRouter } from "~/lib/router";
import { route } from "~/lib/routes";
import { useT } from "~/composables/useShowcase";
type Pointer = PointerEvent;

const t = useT();
const doc = useDocument();
const router = useRouter();
const query = ref("");
const setQuery = (
  next:
    typeof query.value | ((current: typeof query.value) => typeof query.value),
) => {
  query.value = typeof next === "function" ? next(query.value) : next;
};
const kind = ref("all");
const setKind = (
  next: typeof kind.value | ((current: typeof kind.value) => typeof kind.value),
) => {
  kind.value = typeof next === "function" ? next(kind.value) : next;
};
const limit = ref(24);
const setLimit = (
  next:
    typeof limit.value | ((current: typeof limit.value) => typeof limit.value),
) => {
  limit.value = typeof next === "function" ? next(limit.value) : next;
};
const assets = computed(() =>
  getAssets().filter(
    (asset) =>
      (kind.value === "all" || asset.kind === kind.value) &&
      asset.name.toLowerCase().includes(query.value.toLowerCase()),
  ),
);
const insert = (layer: ReturnType<typeof createLayer>) => {
  doc.commitLayers("create", (layers) => [...layers, layer], [layer.id]);
  doc.setTool("select");
  router.push(route.editor());
};
</script>
<template>
  <Screen
    :title="t('The possibility library')"
    :subtitle="
      t(
        'Good ideas deserve great ingredients. Add any asset directly to your canvas.',
      )
    "
  >
    <section class="pictor-section">
      <div class="pictor-section__head">
        <div>
          <span class="pictor-eyebrow">{{ t("BUILT WITH AWC") }}</span>
          <h2>{{ t("Components you can actually touch.") }}</h2>
        </div>
        <span class="pictor-muted">{{
          t("Insert, compose, then try them in Present.")
        }}</span>
      </div>
      <div class="pictor-live-library">
        <template v-for="item in LIVE_COMPONENTS" :key="item.id"
          ><md-card variant="outlined"
            ><span class="material-symbols-outlined" aria-hidden="true">{{
              item.icon
            }}</span>
            <h3>{{ t(item.name) }}</h3>
            <p>{{ t(item.description) }}</p>
            <md-button
              variant="tonal"
              icon="add"
              @click="
                () =>
                  insert(
                    createLayer(
                      'component',
                      {
                        x: 16,
                        y: 10,
                        w: 17,
                        h: item.id === 'awc:card' ? 14 : 5,
                      },
                      {
                        name: item.name,
                        componentId: item.id,
                        fill: '#BEE7AA',
                      },
                    ),
                  )
              "
              >{{ t("Add to canvas") }}</md-button
            ></md-card
          ></template
        >
      </div>
    </section>
    <section class="pictor-section" data-asset-library>
      <div class="pictor-section__head">
        <h2>{{ t("Collect a little inspiration") }}</h2>
        <span class="pictor-muted">{{ assets.length }} {{ t("assets") }}</span>
      </div>
      <div class="pictor-library-filters">
        <TextControl
          :live="true"
          :label="t('Search library')"
          :value="query"
          :onValue="
            (value) => {
              setQuery(value);
              setLimit(24);
            }
          "
        ></TextControl
        ><SelectControl
          :label="t('Asset type')"
          :value="kind"
          :onValue="
            (value) => {
              setKind(value);
              setLimit(24);
            }
          "
          :options="[
            { value: 'all', label: t('All assets') },
            { value: 'image', label: t('Images') },
            { value: 'color', label: t('Colors') },
            { value: 'text-style', label: t('Typography') },
            { value: 'component', label: t('Components') },
          ]"
        ></SelectControl>
      </div>
      <div class="pictor-library-grid">
        <template v-for="asset in assets.slice(0, limit)" :key="asset.id"
          ><md-card variant="outlined" class="pictor-library-card"
            ><Link
              :href="route.asset(asset.id)"
              class="pictor-library-preview"
              :aria-label="t('View {name}', { name: asset.name })"
              ><template v-if="asset.art"
                ><img
                  :src="asset.art.src"
                  :alt="t(asset.art.altKey)"
                  loading="lazy" /></template
              ><template v-else
                ><svg viewBox="0 0 300 200" aria-hidden="true">
                  <rect
                    width="300"
                    height="200"
                    :fill="colorOf(asset.color, '#E6EBDC')"
                  ></rect>
                  <template v-if="asset.kind === 'text-style'">
                    <text
                      x="30"
                      y="136"
                      font-size="96"
                      font-family="Georgia,serif"
                      fill="#203D35"
                    >
                      Aa
                    </text>
                  </template>
                  <template v-else></template></svg></template
            ></Link>
            <div class="pictor-library-meta">
              <div>
                <Link :href="route.asset(asset.id)"
                  ><strong>{{ asset.name }}</strong></Link
                ><span>{{ t(asset.kindKey) }}</span>
              </div>
              <md-icon-button
                icon="add_circle"
                :aria-label="t('Add {name} to canvas', { name: asset.name })"
                @click="() => insert(layerFromAsset(asset))"
              ></md-icon-button></div></md-card
        ></template>
      </div>
      <template v-if="!assets.length"
        ><div class="pictor-empty">
          <span class="material-symbols-outlined" aria-hidden="true"
            >search_off</span
          >
          <h3>{{ t("No ingredients found") }}</h3>
          <p>{{ t("Try a different name or asset type.") }}</p>
        </div></template
      ><template v-else
        ><template v-if="assets.length > limit"
          ><div class="pictor-library-more">
            <md-button
              variant="outlined"
              icon="expand_more"
              @click="() => setLimit((value) => value + 24)"
              >{{ t("Explore more assets") }}</md-button
            >
          </div></template
        ><template v-else></template
      ></template>
    </section>
    <template #aside
      ><md-button
        variant="tonal"
        icon="arrow_outward"
        @click="() => router.push(route.editor())"
        >{{ t("Back to studio") }}</md-button
      ></template
    ></Screen
  >
</template>
