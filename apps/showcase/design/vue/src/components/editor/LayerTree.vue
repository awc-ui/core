<script setup lang="ts">
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
import {
  ancestorIds,
  canReparent,
  childrenOf,
  isContainer,
  layerById,
  layerIcon,
  lockedLayers,
  visibleLayers,
} from "@awc-ui/showcase-kit/design";
import {
  useDocument,
  useTreeRows,
  useSelectableIds,
} from "~/composables/useDocument";
import TextControl from "~/components/editor/TextControl.vue";
type Pointer = PointerEvent;
type DropSide = "before" | "after" | "inside";
const doc = useDocument();
const rows = computed(() => useTreeRows());
const visible = computed(() => visibleLayers(doc.layers));
const locked = computed(() => lockedLayers(doc.layers));
const query = ref("");
const setQuery = (
  next:
    typeof query.value | ((current: typeof query.value) => typeof query.value),
) => {
  query.value = typeof next === "function" ? next(query.value) : next;
};
const collapsed = ref<string[]>([]);
const setCollapsed = (
  next:
    | typeof collapsed.value
    | ((current: typeof collapsed.value) => typeof collapsed.value),
) => {
  collapsed.value = typeof next === "function" ? next(collapsed.value) : next;
};
const dragId = ref<string | null>(null);
const setDragId = (
  next:
    | typeof dragId.value
    | ((current: typeof dragId.value) => typeof dragId.value),
) => {
  dragId.value = typeof next === "function" ? next(dragId.value) : next;
};
const dropOn = ref<{ id: string; side: DropSide } | null>(null);
const setDropOn = (
  next:
    | typeof dropOn.value
    | ((current: typeof dropOn.value) => typeof dropOn.value),
) => {
  dropOn.value = typeof next === "function" ? next(dropOn.value) : next;
};
const tree = shallowRef<HTMLDivElement | null>(null);
const shown = computed(() =>
  rows.value.filter(({ layer }) =>
    query.value
      ? layer.name.toLowerCase().includes(query.value.toLowerCase())
      : ![...ancestorIds(doc.layers, layer.id)].some((id) =>
          collapsed.value.includes(id),
        ),
  ),
);
const toggle = (id: string) =>
  setCollapsed((current) =>
    current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id],
  );
const over = (event: DragEvent, id: string) => {
  if (!dragId.value || dragId.value === id) return;
  event.preventDefault();
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const offset = (event.clientY - box.top) / box.height;
  const layer = layerById(doc.layers, id);
  setDropOn({
    id,
    side:
      layer && isContainer(layer) && offset > 0.25 && offset < 0.75
        ? "inside"
        : offset < 0.5
          ? "before"
          : "after",
  });
};
const drop = (event: DragEvent) => {
  event.preventDefault();
  if (dragId.value && dropOn.value) {
    const target = layerById(doc.layers, dropOn.value.id);
    if (target) {
      const parentId =
        dropOn.value.side === "inside" ? target.id : target.parentId;
      const siblings = childrenOf(doc.layers, parentId).filter(
        (layer) => layer.id !== dragId.value,
      );
      const at =
        dropOn.value.side === "inside"
          ? siblings.length
          : siblings.findIndex((layer) => layer.id === target.id) +
            (dropOn.value.side === "after" ? 1 : 0);
      if (canReparent(doc.layers, dragId.value, parentId))
        doc.reorderTo(dragId.value, parentId, Math.max(0, at));
    }
  }
  setDragId(null);
  setDropOn(null);
};

const { window, Event } = globalThis;
</script>
<template>
  <div class="studio-layers">
    <div class="studio-panel-heading">
      <div>
        <h3>
          {{ t("Layers") }} <span>{{ doc.layers.length }}</span>
        </h3>
        <p>{{ t("Your composition, piece by piece.") }}</p>
      </div>
      <md-icon-button
        icon="add"
        :aria-label="t('Insert a layer')"
        @click="() => window.dispatchEvent(new Event('pictor:insert'))"
      ></md-icon-button>
    </div>
    <TextControl
      :live="true"
      :label="t('Find a layer')"
      :value="query"
      :onValue="setQuery"
    ></TextControl>
    <div
      ref="tree"
      class="tree"
      role="tree"
      :aria-label="t('Canvas layers')"
      data-layer-tree
    >
      <template v-for="({ layer, level }, index) in shown" :key="layer.id"
        ><div
          class="tree__row"
          role="treeitem"
          :aria-level="level + 1"
          :aria-expanded="
            isContainer(layer) ? !collapsed.includes(layer.id) : undefined
          "
          :aria-selected="doc.selection.includes(layer.id)"
          :tabindex="0"
          :data-layer="layer.id"
          :data-level="level"
          :data-selected="doc.selection.includes(layer.id) ? '' : undefined"
          :data-tone="
            !visible.has(layer.id)
              ? 'hidden'
              : locked.has(layer.id)
                ? 'locked'
                : undefined
          "
          :data-drop="dropOn?.id === layer.id ? dropOn.side : undefined"
          :draggable="!locked.has(layer.id)"
          @dragstart="
            (event) => {
              setDragId(layer.id);
              event.dataTransfer!.setData('text/plain', layer.id);
              event.dataTransfer!.effectAllowed = 'move';
            }
          "
          @dragover="(event) => over(event, layer.id)"
          @drop="drop"
          @dragend="
            () => {
              setDragId(null);
              setDropOn(null);
            }
          "
          @click="
            (event) => {
              if (!locked.has(layer.id))
                event.shiftKey || event.metaKey || event.ctrlKey
                  ? doc.toggleInSelection(layer.id)
                  : doc.select([layer.id]);
            }
          "
          @keydown="
            (event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (!locked.has(layer.id)) doc.select([layer.id]);
              }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                const next = Math.max(
                  0,
                  Math.min(
                    shown.length - 1,
                    index + (event.key === 'ArrowDown' ? 1 : -1),
                  ),
                );
                tree
                  ?.querySelectorAll<HTMLElement>('[role=&quot;treeitem&quot;]')
                  [next]?.focus();
              }
              if (
                (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
                isContainer(layer)
              ) {
                event.preventDefault();
                event.stopPropagation();
                setCollapsed((current) =>
                  event.key === 'ArrowLeft'
                    ? [...new Set([...current, layer.id])]
                    : current.filter((id) => id !== layer.id),
                );
              }
            }
          "
        >
          <template v-if="isContainer(layer)"
            ><button
              class="tree__expand"
              :aria-label="`${collapsed.includes(layer.id) ? t('Expand') : t('Collapse')} ${layer.name}`"
              @click="
                (event) => {
                  event.stopPropagation();
                  toggle(layer.id);
                }
              "
            >
              <span class="material-symbols-outlined" aria-hidden="true"
                ><template v-if="collapsed.includes(layer.id)"
                  >chevron_right</template
                ><template v-else>expand_more</template></span
              >
            </button></template
          ><template v-else><span class="tree__expand-spacer"></span></template
          ><span
            class="material-symbols-outlined tree__icon"
            aria-hidden="true"
            >{{ layerIcon(layer.kind) }}</span
          ><span class="tree__name" :title="layer.name">{{ layer.name }}</span
          ><md-icon-button
            class="tree__toggle"
            size="x-small"
            :aria-label="`${layer.visible ? t('Hide') : t('Show')} ${layer.name}`"
            :data-visibility="layer.id"
            @click="
              (event: MouseEvent) => {
                event.stopPropagation();
                doc.toggleVisible(layer.id);
              }
            "
            v-awc="{
              props: { icon: layer.visible ? 'visibility' : 'visibility_off' },
              on: {},
            }"
          ></md-icon-button
          ><md-icon-button
            class="tree__toggle"
            size="x-small"
            :aria-label="`${layer.locked ? t('Unlock') : t('Lock')} ${layer.name}`"
            :data-lock="layer.id"
            @click="
              (event: MouseEvent) => {
                event.stopPropagation();
                doc.toggleLocked(layer.id);
              }
            "
            v-awc="{
              props: { icon: layer.locked ? 'lock' : 'lock_open' },
              on: {},
            }"
          ></md-icon-button></div
      ></template>
    </div>
    <template v-if="shown.length === 0"
      ><p class="studio-description">
        {{ t("No matching layers. Try another name.") }}
      </p></template
    ><template v-else></template>
    <p class="studio-panel-footnote">
      {{ t("Shift-click to select more. Drag rows to reorder or nest.") }}
    </p>
  </div>
</template>
