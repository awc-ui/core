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
import {
  ADJUSTMENT_ORDER,
  BLEND_ORDER,
  ancestorIds,
  ALIGN_ORDER,
  adjustmentKey,
  alignIcon,
  alignKey,
  blendKey,
  childrenOf,
  commonValue,
  isMixed,
  layerById,
  moveSubtree,
  clampRect,
  type Layer,
  type Rect,
} from "@awc-ui/showcase-kit/design";
import {
  useDocument,
  useTreeRows,
  useSelectableIds,
} from "~/composables/useDocument";
import {
  colorOf,
  componentMarkup,
  DEFAULT_SWATCHES,
} from "@awc-ui/pictor-model";
import PanelTabs from "~/components/editor/PanelTabs.vue";
import ColorControl from "~/components/editor/ColorControl.vue";
import NumberControl from "~/components/editor/NumberControl.vue";
import RangeControl from "~/components/editor/RangeControl.vue";
import SelectControl from "~/components/editor/SelectControl.vue";
import TextControl from "~/components/editor/TextControl.vue";
import ToggleControl from "~/components/editor/ToggleControl.vue";
import { useT } from "~/composables/useShowcase";
type Pointer = PointerEvent;

const doc = useDocument();
const t = useT();
const tab = ref("design");
const setTab = (
  next: typeof tab.value | ((current: typeof tab.value) => typeof tab.value),
) => {
  tab.value = typeof next === "function" ? next(tab.value) : next;
};
const copied = ref(false);
const setCopied = (
  next:
    | typeof copied.value
    | ((current: typeof copied.value) => typeof copied.value),
) => {
  copied.value = typeof next === "function" ? next(copied.value) : next;
};
const selected = computed(() =>
  doc.layers.filter((layer) => doc.selection.includes(layer.id)),
);
const first = computed(() => selected.value[0]);
const pick = (fn: (layer: Layer) => unknown) =>
  commonValue(doc.layers, doc.selection, fn);
const geometry = (key: keyof Rect) => {
  const value = pick((layer) => layer.rect[key]);
  return typeof value === "number" ? value * 20 : null;
};
const setGeometry = (key: keyof Rect, pixels: number) => {
  const value = Math.round(pixels / 20);
  doc.commitLayers(key === "x" || key === "y" ? "move" : "resize", (layers) => {
    let next = layers;
    const ids =
      key === "x" || key === "y"
        ? doc.selection.filter(
            (id) =>
              ![...ancestorIds(layers, id)].some((parent) =>
                doc.selection.includes(parent),
              ),
          )
        : doc.selection;
    for (const id of ids) {
      const layer = layerById(next, id);
      if (!layer) continue;
      if (key === "x" || key === "y")
        next = moveSubtree(
          next,
          id,
          key === "x" ? value - layer.rect.x : 0,
          key === "y" ? value - layer.rect.y : 0,
        );
      else
        next = next.map((item) =>
          item.id === id
            ? { ...item, rect: clampRect({ ...item.rect, [key]: value }) }
            : item,
        );
    }
    return next;
  });
};
const snippet = computed(() =>
  first.value
    ? first.value.componentId?.startsWith("awc:")
      ? componentMarkup(first.value)
      : `.design-element {\n  width: ${first.value.rect.w * 20}px;\n  height: ${first.value.rect.h * 20}px;\n  ${first.value.kind === "text" ? "color" : "background"}: ${colorOf(first.value.fill)};\n  opacity: ${first.value.opacity / 100};\n  mix-blend-mode: ${first.value.blend};\n}`
    : "",
);
const reorder = (where: "front" | "back") => {
  if (!first.value) return;
  doc.reorderTo(
    first.value.id,
    first.value.parentId,
    where === "front"
      ? childrenOf(doc.layers, first.value.parentId).length - 1
      : 0,
  );
};

const { navigator, window, Event, setTimeout } = globalThis;
</script>
<template>
  <div class="inspector studio-inspector" data-inspector>
    <div class="studio-panel-head">
      <strong>{{ t("Inspector") }}</strong
      ><span
        ><template v-if="selected.length">{{
          t("{count} selected", { count: selected.length })
        }}</template
        ><template v-else>{{ t("Canvas") }}</template></span
      >
    </div>
    <PanelTabs
      :value="tab"
      :onValue="setTab"
      :label="t('Inspector view')"
      :options="[
        { value: 'design', label: t('Design'), icon: 'tune' },
        { value: 'code', label: t('Handoff'), icon: 'code' },
      ]"
    ></PanelTabs>
    <template v-if="!first"
      ><div class="studio-inspector-empty">
        <span class="material-symbols-outlined" aria-hidden="true"
          >interests</span
        >
        <h3>{{ t("Every detail is a possibility.") }}</h3>
        <p>
          {{
            t("Select an object to adjust its geometry, color and appearance.")
          }}
        </p>
        <div class="studio-canvas-spec">
          <span>{{ t("Canvas size") }}</span
          ><strong>960 × 640</strong><span>{{ t("Color profile") }}</span
          ><strong>sRGB</strong><span>{{ t("Editable layers") }}</span
          ><strong>{{ doc.layers.length }}</strong
          ><span>{{ t("Grid") }}</span
          ><strong>{{ t("20px snapping") }}</strong>
        </div>
        <md-button
          variant="tonal"
          icon="add"
          @click="() => window.dispatchEvent(new Event('pictor:insert'))"
          >{{ t("Insert something") }}</md-button
        >
        <p class="studio-tip">
          {{
            t(
              "Try R to draw a rectangle, T for text, or double-click a text layer to edit it.",
            )
          }}
        </p>
      </div></template
    ><template v-else
      ><template v-if="tab === 'code'"
        ><section class="inspector__section">
          <h3 class="inspector__title">
            <template v-if="first.componentId?.startsWith('awc:')">{{
              t("AWC component markup")
            }}</template
            ><template v-else>{{ t("CSS properties") }}</template>
          </h3>
          <p class="studio-tip">
            <template v-if="first.componentId?.startsWith('awc:')">{{
              t(
                "This is a live component. Open Present mode to interact with it.",
              )
            }}</template
            ><template v-else>{{
              t(
                "Measured directly from your selected layer. Position it within your own layout.",
              )
            }}</template>
          </p>
          <pre class="studio-code"><code>{{ snippet }}</code></pre>
          <md-button
            variant="tonal"
            @click="
              async () => {
                try {
                  await navigator.clipboard.writeText(snippet);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }
            "
            v-awc="{
              props: { icon: copied ? 'check' : 'content_copy' },
              on: {},
            }"
            ><template v-if="copied">{{ t("Copied") }}</template
            ><template v-else>{{ t("Copy code") }}</template></md-button
          >
          <div class="studio-canvas-spec">
            <span>{{ t("Layer ID") }}</span
            ><code>{{ first.id }}</code
            ><span>{{ t("Type") }}</span
            ><strong>{{ first.kind }}</strong>
          </div>
        </section></template
      ><template v-else>
        <section class="inspector__section">
          <TextControl
            :label="first.kind === 'text' ? t('Text content') : t('Layer name')"
            :value="
              selected.length === 1
                ? first.textKey
                  ? t(first.textKey)
                  : first.name
                : ''
            "
            :placeholder="
              selected.length > 1 ? t('Rename selected layers') : undefined
            "
            :onValue="
              (name) =>
                doc.restyle({
                  name,
                  ...(first.kind === 'text' ? { textKey: null } : {}),
                })
            "
            :data-name-field="true"
            :multiline="first.kind === 'text' ? 'auto-grow' : undefined"
            :rows="first.kind === 'text' ? 3 : undefined"
          ></TextControl
          ><template v-if="first.kind === 'text'"
            ><p class="studio-tip">
              {{
                t(
                  "Text scales to fit its frame. Add a line break or resize for a new composition.",
                )
              }}
            </p></template
          ><template v-else></template>
        </section>
        <section class="inspector__section">
          <h3 class="inspector__title">
            {{ t("Position & size") }} <span>PX</span>
          </h3>
          <div class="inspector__grid">
            <template v-for="key in ['x', 'y', 'w', 'h'] as const" :key="key"
              ><NumberControl
                :label="key.toUpperCase()"
                :value="geometry(key)"
                :onValue="(value) => setGeometry(key, value)"
                :min="key === 'w' || key === 'h' ? 20 : 0"
                :max="key === 'x' || key === 'w' ? 960 : 640"
                :step="20"
                :data-geometry="key"
                :data-field="`design.label.${key}`"
              ></NumberControl
            ></template>
          </div>
          <p class="studio-tip">
            {{ t("Snaps to 20px. Drag canvas corner handles to resize.") }}
          </p>
        </section>
        <section class="inspector__section">
          <h3 class="inspector__title">{{ t("Fill & appearance") }}</h3>
          <div class="studio-color-row">
            <ColorControl
              :value="colorOf(first.fill, '#203D35')"
              :onValue="(fill) => doc.restyle({ fill })"
            ></ColorControl
            ><TextControl
              :label="t('Color')"
              :value="colorOf(first.fill, '#203D35')"
              :onValue="
                (fill) => {
                  if (
                    /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(
                      fill,
                    )
                  )
                    doc.restyle({ fill });
                }
              "
            ></TextControl>
          </div>
          <div
            class="studio-swatches"
            role="group"
            :aria-label="t('Brand colors')"
          >
            <template v-for="fill in DEFAULT_SWATCHES.slice(0, 12)" :key="fill"
              ><button
                :title="fill"
                :aria-label="t('Set fill to {fill}', { fill: fill })"
                :aria-pressed="colorOf(first.fill) === fill"
                @click="() => doc.restyle({ fill })"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect width="24" height="24" rx="7" :fill="fill"></rect>
                </svg></button
            ></template>
          </div>
          <RangeControl
            :label="t('Opacity')"
            :value="
              typeof pick((l) => l.opacity) === 'number'
                ? Number(pick((l) => l.opacity))
                : 100
            "
            :onValue="(opacity) => doc.restyle({ opacity })"
          ></RangeControl
          ><SelectControl
            :value="isMixed(pick((l) => l.blend) as never) ? '' : first.blend"
            :label="t('Blend mode')"
            :onValue="
              (blend) =>
                doc.restyle({
                  blend: blend as Layer['blend'],
                  blendKey: blendKey(blend as Layer['blend']),
                })
            "
            :options="
              BLEND_ORDER.map((mode) => ({
                value: mode,
                label: t(blendKey(mode)),
              }))
            "
            :data-blend-select="true"
          ></SelectControl>
        </section>
        <section class="inspector__section">
          <h3 class="inspector__title">{{ t("Arrange") }}</h3>
          <div
            class="studio-arrange"
            role="group"
            :aria-label="t('Align selected layers')"
          >
            <template v-for="axis in ALIGN_ORDER" :key="axis"
              ><md-icon-button
                :aria-label="t(alignKey(axis))"
                :data-align="axis"
                @click="() => doc.align(axis)"
                v-awc="{
                  props: {
                    icon: alignIcon(axis),
                    disabled: selected.length < 2 || undefined,
                  },
                  on: {},
                }"
              ></md-icon-button
            ></template>
          </div>
          <div class="studio-arrange">
            <md-icon-button
              icon="horizontal_distribute"
              :aria-label="t('Distribute horizontally')"
              @click="() => doc.distribute('horizontal')"
              v-awc="{
                props: { disabled: selected.length < 3 || undefined },
                on: {},
              }"
            ></md-icon-button
            ><md-icon-button
              icon="vertical_distribute"
              :aria-label="t('Distribute vertically')"
              @click="() => doc.distribute('vertical')"
              v-awc="{
                props: { disabled: selected.length < 3 || undefined },
                on: {},
              }"
            ></md-icon-button
            ><md-icon-button
              icon="flip_to_front"
              :aria-label="t('Bring to front')"
              @click="() => reorder('front')"
            ></md-icon-button
            ><md-icon-button
              icon="flip_to_back"
              :aria-label="t('Send to back')"
              @click="() => reorder('back')"
            ></md-icon-button
            ><md-icon-button
              icon="folder"
              :aria-label="t('Group layers')"
              @click="() => doc.group()"
              v-awc="{
                props: { disabled: selected.length < 2 || undefined },
                on: {},
              }"
            ></md-icon-button
            ><md-icon-button
              icon="folder_off"
              :aria-label="t('Ungroup')"
              @click="() => doc.ungroup()"
              v-awc="{
                props: {
                  disabled:
                    !selected.some(
                      (l) => l.kind === 'group' || l.kind === 'frame',
                    ) || undefined,
                },
                on: {},
              }"
            ></md-icon-button>
          </div>
        </section>
        <template v-if="selected.some((layer) => layer.kind === 'image')"
          ><section class="inspector__section">
            <h3 class="inspector__title">{{ t("Image adjustments") }}</h3>
            <template v-for="kind in ADJUSTMENT_ORDER" :key="kind"
              ><RangeControl
                :label="t(adjustmentKey(kind))"
                :min="-100"
                :max="100"
                :step="20"
                :value="
                  first.adjustments.find((a) => a.kind === kind)?.value ?? 0
                "
                :onValue="(value) => doc.setAdjustment(kind, value)"
              ></RangeControl></template
            ><ToggleControl
              :label="t('Rounded image mask')"
              :selected="first.masked"
              :onValue="(masked) => doc.restyle({ masked })"
            ></ToggleControl></section></template
        ><template v-else></template>
        <section class="inspector__section">
          <md-button
            variant="tonal"
            icon="content_copy"
            @click="() => doc.duplicate()"
            >{{ t("Duplicate selection") }}</md-button
          ><md-button
            variant="text"
            icon="delete"
            @click="() => doc.remove()"
            >{{ t("Delete selection") }}</md-button
          >
        </section>
      </template></template
    >
  </div>
</template>
