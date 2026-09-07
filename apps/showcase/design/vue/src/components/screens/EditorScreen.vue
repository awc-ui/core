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
  fileById,
  lockedLayers,
  visibleLayers,
  descendantIds,
  type ToolMode,
} from "@awc-ui/showcase-kit/design";
import Canvas from "~/components/editor/Canvas.vue";
import HistoryPanel from "~/components/editor/HistoryPanel.vue";
import Inspector from "~/components/editor/Inspector.vue";
import LayerTree from "~/components/editor/LayerTree.vue";
import Toolbar from "~/components/editor/Toolbar.vue";
import InsertPanel from "~/components/editor/InsertPanel.vue";
import ExportDialog from "~/components/editor/ExportDialog.vue";
import PanelTabs from "~/components/editor/PanelTabs.vue";
import StudioDialog from "~/components/editor/StudioDialog.vue";
import Screen from "~/components/Screen.vue";
import NotFoundScreen from "~/components/screens/NotFoundScreen.vue";
import {
  useDocument,
  useTreeRows,
  useSelectableIds,
} from "~/composables/useDocument";
type Pointer = PointerEvent;
const toolHelp: Record<ToolMode, readonly [string, string]> = {
  select: [
    "Select",
    "Drag to move · Shift-click to select more · Drag a corner to resize",
  ],
  frame: [
    "Frame",
    "Drag on the canvas to draw a frame, or click for a starting size.",
  ],
  rect: ["Rectangle", "Drag on the canvas to draw · Hold Shift for a square"],
  ellipse: ["Ellipse", "Drag on the canvas to draw · Hold Shift for a circle"],
  text: [
    "Text",
    "Click the canvas to add text. Double-click it to edit in the inspector.",
  ],
  image: [
    "Image",
    "Choose artwork from the library, or drag on the canvas to place an image.",
  ],
  hand: [
    "Pan",
    "Drag anywhere in the workspace to look around. Fit canvas brings it back.",
  ],
};
const props = defineProps<{ fileId?: string }>();
const fileId = toRef(props, "fileId");
const doc = useDocument();
const panel = ref("layers");
const setPanel = (
  next:
    typeof panel.value | ((current: typeof panel.value) => typeof panel.value),
) => {
  panel.value = typeof next === "function" ? next(panel.value) : next;
};
const insertRequest = ref(0);
const setInsertRequest = (
  next:
    | typeof insertRequest.value
    | ((current: typeof insertRequest.value) => typeof insertRequest.value),
) => {
  insertRequest.value =
    typeof next === "function" ? next(insertRequest.value) : next;
};
const insertCategory = ref<"components" | "art">("components");
const setInsertCategory = (
  next:
    | typeof insertCategory.value
    | ((current: typeof insertCategory.value) => typeof insertCategory.value),
) => {
  insertCategory.value =
    typeof next === "function" ? next(insertCategory.value) : next;
};
const showLeft = ref((() => window.innerWidth > 700)());
const setShowLeft = (
  next:
    | typeof showLeft.value
    | ((current: typeof showLeft.value) => typeof showLeft.value),
) => {
  showLeft.value = typeof next === "function" ? next(showLeft.value) : next;
};
const showRight = ref((() => window.innerWidth > 980)());
const setShowRight = (
  next:
    | typeof showRight.value
    | ((current: typeof showRight.value) => typeof showRight.value),
) => {
  showRight.value = typeof next === "function" ? next(showRight.value) : next;
};
const exportOpen = ref(false);
const setExportOpen = (
  next:
    | typeof exportOpen.value
    | ((current: typeof exportOpen.value) => typeof exportOpen.value),
) => {
  exportOpen.value = typeof next === "function" ? next(exportOpen.value) : next;
};
const presentOpen = ref(false);
const setPresentOpen = (
  next:
    | typeof presentOpen.value
    | ((current: typeof presentOpen.value) => typeof presentOpen.value),
) => {
  presentOpen.value =
    typeof next === "function" ? next(presentOpen.value) : next;
};
watchLifecycle(
  () => {
    if (fileId.value && fileId.value !== doc.fileId) doc.openFile(fileId.value);
  },
  () => [fileId.value, doc],
);
const insert = (category: "components" | "art" = "components") => {
  setInsertCategory(category);
  setInsertRequest((value) => value + 1);
  setPanel("insert");
  setShowLeft(true);
};
watchLifecycle(() => {
  const exporting = () => setExportOpen(true),
    presenting = () => setPresentOpen(true),
    inserting = () => insert();
  window.addEventListener("pictor:export", exporting);
  window.addEventListener("pictor:present", presenting);
  window.addEventListener("pictor:insert", inserting);
  return () => {
    window.removeEventListener("pictor:export", exporting);
    window.removeEventListener("pictor:present", presenting);
    window.removeEventListener("pictor:insert", inserting);
  };
}, undefined);
const keyboard = (event: KeyboardEvent) => {
  if (exportOpen.value || presentOpen.value) return;
  if (
    event
      .composedPath()
      .some(
        (target) =>
          target instanceof HTMLElement &&
          (target.matches(
            'input,textarea,select,[contenteditable="true"],md-text-field,md-number-field,md-select,md-color-picker,md-slider',
          ) ||
            target.isContentEditable),
      )
  )
    return;
  const key = event.key.toLowerCase(),
    command = event.metaKey || event.ctrlKey;
  if (command && key === "z") {
    event.preventDefault();
    event.shiftKey ? doc.redo() : doc.undo();
    return;
  }
  if (command && key === "d") {
    event.preventDefault();
    doc.duplicate();
    return;
  }
  if (command && key === "a") {
    event.preventDefault();
    const visible = visibleLayers(doc.layers),
      locked = lockedLayers(doc.layers);
    doc.select(
      doc.layers
        .filter((layer) => visible.has(layer.id) && !locked.has(layer.id))
        .map((layer) => layer.id),
    );
    return;
  }
  if (command || event.altKey) return;
  if (key === "escape") {
    doc.clearSelection();
    doc.setTool("select");
    return;
  }
  if (key === "delete" || key === "backspace") {
    if (doc.selection.length) {
      event.preventDefault();
      doc.remove();
    }
    return;
  }
  const modes: Record<string, ToolMode> = {
    v: "select",
    f: "frame",
    r: "rect",
    o: "ellipse",
    t: "text",
    i: "image",
    h: "hand",
  };
  if (modes[key]) {
    doc.setTool(modes[key]);
    return;
  }
  if (
    key.startsWith("arrow") &&
    doc.selection.length &&
    !(event.target as HTMLElement).closest(
      'button,md-icon-button,md-toolbar,[role="treeitem"]',
    )
  ) {
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    doc.commitLayers("move", (layers) => {
      const locked = lockedLayers(layers);
      const ids = new Set(doc.selection);
      doc.selection.forEach((id) =>
        descendantIds(layers, id).forEach((child) => ids.add(child)),
      );
      const moved = layers.filter(
        (layer) => ids.has(layer.id) && !locked.has(layer.id),
      );
      if (!moved.length) return layers;
      let dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0,
        dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
      dx = Math.max(
        -Math.min(...moved.map((layer) => layer.rect.x)),
        Math.min(
          48 - Math.max(...moved.map((layer) => layer.rect.x + layer.rect.w)),
          dx,
        ),
      );
      dy = Math.max(
        -Math.min(...moved.map((layer) => layer.rect.y)),
        Math.min(
          32 - Math.max(...moved.map((layer) => layer.rect.y + layer.rect.h)),
          dy,
        ),
      );
      return layers.map((layer) =>
        moved.includes(layer)
          ? {
              ...layer,
              rect: {
                ...layer.rect,
                x: layer.rect.x + dx,
                y: layer.rect.y + dy,
              },
            }
          : layer,
      );
    });
  }
};
const file = computed(() => fileById(doc.fileId));
</script>
<template>
  <template v-if="(fileId && !fileById(fileId)) || !file"
    ><NotFoundScreen></NotFoundScreen></template
  ><template v-else
    ><Screen
      :title="file.name"
      :subtitle="
        t('An idea becomes a composition. Make something unmistakably yours.')
      "
      :crumbLabel="file.name"
    >
      <div
        class="editor studio-editor"
        data-editor
        :data-left="showLeft ? 'open' : 'closed'"
        :data-right="showRight ? 'open' : 'closed'"
        @keydown="keyboard"
        :tabindex="-1"
      >
        <div class="editor__toolbar">
          <Toolbar
            :onInsert="insert"
            :onExport="() => setExportOpen(true)"
            :onPresent="() => setPresentOpen(true)"
            :onLayers="() => setShowLeft((value) => !value)"
            :onInspector="() => setShowRight((value) => !value)"
          ></Toolbar>
          <div class="studio-tool-hint" role="status">
            <strong>{{ t(toolHelp[doc.tool][0]) }}</strong
            ><span>{{ t(toolHelp[doc.tool][1]) }}</span>
          </div>
        </div>
        <aside class="editor__tree studio-left-panel">
          <PanelTabs
            :label="t('Studio panels')"
            :value="panel"
            :onValue="setPanel"
            :options="[
              { value: 'layers', label: t('Layers') },
              { value: 'insert', label: t('Insert') },
              { value: 'history', label: t('History') },
            ]"
          ></PanelTabs
          ><template v-if="panel === 'layers'"><LayerTree></LayerTree></template
          ><template v-else
            ><template v-if="panel === 'insert'"
              ><InsertPanel
                :key="insertRequest"
                :category="insertCategory"
              ></InsertPanel></template
            ><template v-else><HistoryPanel></HistoryPanel></template
          ></template>
        </aside>
        <div class="editor__canvas">
          <Canvas :onInspect="() => setShowRight(true)"></Canvas>
        </div>
        <aside class="editor__inspector"><Inspector></Inspector></aside>
        <div class="studio-statusbar">
          <span
            ><span class="pictor-live-dot"></span>
            <template v-if="doc.selection.length">{{
              t("{count} selected", { count: doc.selection.length })
            }}</template
            ><template v-else>{{
              t("Your next move starts here")
            }}</template></span
          ><span
            >{{ doc.layers.length }} {{ t("layers") }}
            <span class="studio-statusbar__separator">·</span> 960 × 640
            <span class="studio-statusbar__separator">·</span>
            {{ t("20 px snap") }}</span
          ><button
            @click="
              () => {
                setPanel('history');
                setShowLeft(true);
              }
            "
          >
            <span class="material-symbols-outlined" aria-hidden="true"
              >history</span
            >
            {{ doc.history.entries.length }} {{ t("edits") }}
          </button>
        </div>
      </div>
      <ExportDialog
        :open="exportOpen"
        :onClose="() => setExportOpen(false)"
      ></ExportDialog>
      <StudioDialog
        :open="presentOpen"
        :onClose="() => setPresentOpen(false)"
        :title="t('Your idea, center stage')"
        :fullscreen="true"
        ><div class="studio-presentation">
          <div class="studio-presentation__intro">
            <span class="pictor-eyebrow">{{ t("THE FINISHED PICTURE") }}</span>
            <p>
              {{
                t(
                  "Live AWC controls are interactive here. Try a button, field or switch.",
                )
              }}
            </p>
          </div>
          <Canvas :presentation="true"></Canvas>
        </div>
        <template #actions
          ><md-button
            variant="filled"
            icon="close"
            @click="() => setPresentOpen(false)"
            v-awc="{ props: { 'data-close-present': true }, on: {} }"
            >{{ t("Back to studio") }}</md-button
          ></template
        ></StudioDialog
      >
      <template #aside
        ><div class="studio-save-status" :data-save-status="doc.saveStatus">
          <span class="material-symbols-outlined" aria-hidden="true"
            ><template v-if="doc.saveStatus === 'saved'">cloud_done</template
            ><template v-else
              ><template v-if="doc.saveStatus === 'unavailable'"
                >cloud_off</template
              ><template v-else>edit</template></template
            ></span
          ><template v-if="doc.saveStatus === 'saved'">{{
            t("Saved on this device")
          }}</template
          ><template v-else
            ><template v-if="doc.saveStatus === 'unavailable'">{{
              t("Device storage unavailable")
            }}</template
            ><template v-else>{{
              t("Saving your changes…")
            }}</template></template
          >
        </div></template
      ></Screen
    ></template
  >
</template>
