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
  canRedo,
  canUndo,
  zoomPercent,
  type ToolMode,
} from "@awc-ui/showcase-kit/design";
import {
  useDocument,
  useTreeRows,
  useSelectableIds,
} from "~/composables/useDocument";
type Pointer = PointerEvent;
const TOOLS: {
  tool: ToolMode;
  icon: string;
  label: string;
  shortcut: string;
}[] = [
  { tool: "select", icon: "near_me", label: "Select and move", shortcut: "V" },
  { tool: "frame", icon: "crop_free", label: "Frame", shortcut: "F" },
  { tool: "rect", icon: "rectangle", label: "Rectangle", shortcut: "R" },
  { tool: "ellipse", icon: "circle", label: "Ellipse", shortcut: "O" },
  { tool: "text", icon: "title", label: "Text", shortcut: "T" },
  { tool: "image", icon: "image", label: "Insert artwork", shortcut: "I" },
  { tool: "hand", icon: "pan_tool", label: "Pan", shortcut: "H" },
];
const props = defineProps<{
  onInsert(category?: "components" | "art"): void;
  onExport(): void;
  onPresent(): void;
  onLayers(): void;
  onInspector(): void;
}>();
const onInsert = toRef(props, "onInsert");
const onExport = toRef(props, "onExport");
const onPresent = toRef(props, "onPresent");
const onLayers = toRef(props, "onLayers");
const onInspector = toRef(props, "onInspector");
const doc = useDocument();

const { window, Event } = globalThis;
</script>
<template>
  <md-toolbar
    class="toolbar studio-toolbar"
    variant="floating"
    :aria-label="t('Canvas editing tools')"
    v-awc="{ props: { density: -2 }, on: {} }"
  >
    <div class="toolbar__group">
      <md-icon-button
        icon="left_panel_open"
        :aria-label="t('Toggle layers panel')"
        @click="onLayers"
      ></md-icon-button
      ><md-icon-button
        icon="add_circle"
        :aria-label="t('Insert assets and live components')"
        @click="() => onInsert('components')"
      ></md-icon-button>
    </div>
    <div class="toolbar__group" role="group" :aria-label="t('Drawing tools')">
      <template v-for="{ tool, icon, label, shortcut } in TOOLS" :key="tool"
        ><md-icon-button
          :aria-label="`${t(label)} (${shortcut})`"
          :title="`${t(label)} · ${shortcut}`"
          :aria-pressed="doc.tool === tool"
          :data-tool="tool"
          :data-active="doc.tool === tool ? '' : undefined"
          @click="
            () => {
              doc.setTool(tool);
              if (tool === 'image') onInsert('art');
            }
          "
          v-awc="{ props: { icon: icon }, on: {} }"
        ></md-icon-button
      ></template>
    </div>
    <div class="toolbar__group">
      <md-icon-button
        icon="undo"
        :aria-label="t('Undo (⌘Z)')"
        @click="() => doc.undo()"
        v-awc="{
          props: {
            'data-undo': true,
            disabled: !canUndo(doc.history) || undefined,
          },
          on: {},
        }"
      ></md-icon-button
      ><md-icon-button
        icon="redo"
        :aria-label="t('Redo (⌘⇧Z)')"
        @click="() => doc.redo()"
        v-awc="{
          props: {
            'data-redo': true,
            disabled: !canRedo(doc.history) || undefined,
          },
          on: {},
        }"
      ></md-icon-button>
    </div>
    <span class="toolbar__spacer"></span>
    <div class="toolbar__group toolbar__view">
      <md-icon-button
        icon="grid_4x4"
        :aria-label="t('Toggle grid')"
        :aria-pressed="doc.showGrid"
        @click="() => doc.toggleGrid()"
        v-awc="{ props: { 'data-grid-toggle': true }, on: {} }"
      ></md-icon-button
      ><md-icon-button
        icon="zoom_out"
        :aria-label="t('Zoom out')"
        @click="() => doc.zoomOut()"
        v-awc="{
          props: {
            'data-zoom-out': true,
            disabled: doc.zoomIndex === 0 || undefined,
          },
          on: {},
        }"
      ></md-icon-button
      ><button
        class="studio-zoom"
        :aria-label="t('Fit and center canvas')"
        :title="t('Fit and center canvas')"
        @click="() => window.dispatchEvent(new Event('pictor:fit'))"
      >
        {{ zoomPercent(doc.zoomIndex) }}% <span>⌄</span></button
      ><md-icon-button
        icon="zoom_in"
        :aria-label="t('Zoom in')"
        @click="() => doc.zoomIn()"
        v-awc="{
          props: {
            'data-zoom-in': true,
            disabled: doc.zoomIndex === 4 || undefined,
          },
          on: {},
        }"
      ></md-icon-button>
    </div>
    <div class="toolbar__group">
      <md-icon-button
        icon="right_panel_open"
        :aria-label="t('Toggle inspector')"
        @click="onInspector"
      ></md-icon-button
      ><md-icon-button
        icon="play_arrow"
        :aria-label="t('Present design')"
        @click="onPresent"
        v-awc="{ props: { 'data-present': true }, on: {} }"
      ></md-icon-button
      ><md-button
        variant="filled"
        icon="download"
        @click="onExport"
        v-awc="{ props: { 'data-export': true }, on: {} }"
        >{{ t("Export") }}</md-button
      >
    </div>
  </md-toolbar>
</template>
