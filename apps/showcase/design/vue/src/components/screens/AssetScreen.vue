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
import { assetById, assetUsage } from "@awc-ui/showcase-kit/design";
import Screen from "~/components/Screen.vue";
import NotFoundScreen from "~/components/screens/NotFoundScreen.vue";
import {
  useDocument,
  useTreeRows,
  useSelectableIds,
} from "~/composables/useDocument";
import Link from "~/components/Link.vue";
import { useRouter } from "~/lib/router";
import { route } from "~/lib/routes";
import { colorOf, documentSvg, layerFromAsset } from "@awc-ui/pictor-model";
import { useT } from "~/composables/useShowcase";
type Pointer = PointerEvent;

const props = defineProps<{ assetId: string }>();
const assetId = toRef(props, "assetId");
const t = useT();
const doc = useDocument();
const router = useRouter();
const asset = computed(() => assetById(assetId.value));
const usage = computed(() => (asset.value ? assetUsage(asset.value) : []));
const insert = () => {
  if (!asset.value) return;
  const layer = layerFromAsset(asset.value);
  doc.commitLayers("create", (layers) => [...layers, layer], [layer.id]);
  doc.setTool("select");
  router.push(route.editor());
};
</script>
<template>
  <template v-if="!asset"><NotFoundScreen></NotFoundScreen></template
  ><template v-else
    ><Screen
      :title="asset.name"
      :subtitle="t('One ingredient. Endless possible compositions.')"
      :crumbLabel="asset.name"
      ><div class="pictor-asset-detail">
        <div class="pictor-asset-detail__art">
          <template v-if="asset.art"
            ><img :src="asset.art.src" :alt="t(asset.art.altKey)" /></template
          ><template v-else
            ><svg viewBox="0 0 600 400" :aria-label="asset.name">
              <rect
                width="600"
                height="400"
                :fill="colorOf(asset.color, '#E6EBDC')"
              ></rect>
              <template v-if="asset.kind === 'text-style'">
                <text
                  x="70"
                  y="270"
                  font-size="210"
                  font-family="Georgia,serif"
                  fill="#203D35"
                >
                  Aa
                </text>
              </template>
              <template v-else></template></svg
          ></template>
        </div>
        <div class="pictor-asset-detail__copy">
          <span class="pictor-eyebrow">{{
            t("YOUR CREATIVE INGREDIENT")
          }}</span>
          <h2>{{ asset.name }}</h2>
          <md-chip
            v-awc="{ props: { label: t(asset.kindKey) }, on: {} }"
          ></md-chip>
          <p>
            {{
              t(
                "Add this asset as an editable layer in your current design. Move it, resize it, and make it part of something new.",
              )
            }}
          </p>
          <template v-if="asset.color"
            ><code>{{ colorOf(asset.color) }}</code></template
          ><template v-else></template
          ><md-button variant="filled" icon="add" @click="insert">{{
            t("Use in my design")
          }}</md-button
          ><md-button
            variant="text"
            icon="arrow_back"
            @click="() => router.push(route.assets())"
            >{{ t("Explore the library") }}</md-button
          >
        </div>
      </div>
      <section class="pictor-section">
        <div class="pictor-section__head">
          <h2>{{ t("Related designs") }}</h2>
          <span class="pictor-muted"
            >{{ usage.length }} {{ t("design files") }}</span
          >
        </div>
        <div class="pictor-file-grid">
          <template v-for="file in usage" :key="file.id"
            ><md-card class="pictor-file-card" variant="outlined"
              ><Link :href="route.file(file.id)" class="pictor-file-preview"
                ><img
                  :src="`data:image/svg+xml,${encodeURIComponent(documentSvg(doc.layersForFile(file.id), t))}`"
                  :alt="t('{name} design', { name: file.name })"
              /></Link>
              <div class="pictor-file-meta">
                <Link :href="route.file(file.id)"
                  ><strong>{{ file.name }}</strong
                  ><span
                    >{{ doc.layersForFile(file.id).length }}
                    {{ t("editable layers") }}</span
                  ></Link
                ><span class="material-symbols-outlined" aria-hidden="true"
                  >arrow_outward</span
                >
              </div></md-card
            ></template
          >
        </div>
        <template v-if="!usage.length"
          ><p class="studio-description">
            {{
              t(
                "Be the first to put this asset to work in your current canvas.",
              )
            }}
          </p></template
        ><template v-else></template>
      </section>
      <template #aside
        ><md-button variant="filled" icon="add" @click="insert">{{
          t("Add to canvas")
        }}</md-button></template
      ></Screen
    ></template
  >
</template>
