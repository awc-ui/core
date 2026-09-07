<script setup lang="ts">
const t = useT();

import LayerPaint from "./LayerPaint.vue";
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
  CANVAS_COLS,
  CANVAS_ROWS,
  clampRect,
  descendantIds,
  getAssets,
  lockedLayers,
  marqueeHits,
  visibleLayers,
  zOrder,
  zoomPercent,
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
  createLayer,
  ORB_ART,
  textLayout,
} from "@awc-ui/pictor-model";
import { useT } from "~/composables/useShowcase";
type Pointer = PointerEvent;
type Gesture = {
  mode: "move" | "resize" | "draw" | "marquee" | "pan";
  pointerId: number;
  startX: number;
  startY: number;
  origin: Rect;
  ids: string[];
  rects?: Record<string, Rect>;
  corner?: string;
  layer?: Layer;
  scrollX?: number;
  scrollY?: number;
  moved?: boolean;
};
const attrs = (rect: Rect) => ({
  "data-x": String(rect.x),
  "data-y": String(rect.y),
  "data-w": String(rect.w),
  "data-h": String(rect.h),
});
const props = withDefaults(
  defineProps<{ presentation?: boolean; onInspect?: () => void }>(),
  { presentation: false },
);
const presentation = toRef(props, "presentation");
const onInspect = toRef(props, "onInspect");
if (presentation.value === undefined) {
  /* default supplied through defaults below */
}
const doc = useDocument();
const board = shallowRef<HTMLDivElement | null>(null);
const viewport = shallowRef<HTMLDivElement | null>(null);
const gesture = shallowRef<Gesture | null | null>(null);
const previewRef = shallowRef<Record<string, Rect>>({});
const preview = ref<Record<string, Rect>>({});
const setPreview = (
  next:
    | typeof preview.value
    | ((current: typeof preview.value) => typeof preview.value),
) => {
  preview.value = typeof next === "function" ? next(preview.value) : next;
};
const box = ref<Rect | null>(null);
const setBox = (
  next: typeof box.value | ((current: typeof box.value) => typeof box.value),
) => {
  box.value = typeof next === "function" ? next(box.value) : next;
};
const drawing = ref<Layer | null>(null);
const setDrawing = (
  next:
    | typeof drawing.value
    | ((current: typeof drawing.value) => typeof drawing.value),
) => {
  drawing.value = typeof next === "function" ? next(drawing.value) : next;
};
const position = ref({ x: 0, y: 0 });
const setPosition = (
  next:
    | typeof position.value
    | ((current: typeof position.value) => typeof position.value),
) => {
  position.value = typeof next === "function" ? next(position.value) : next;
};
const visible = computed(() => visibleLayers(doc.layers));
const locked = computed(() => lockedLayers(doc.layers));
const painted = computed(() => zOrder(doc.layers));
const updatePreview = (next: Record<string, Rect>) => {
  previewRef.value = next;
  setPreview(next);
};
const cellAt = (event: { clientX: number; clientY: number }) => {
  const rect = board.value?.getBoundingClientRect();
  const cell = rect ? rect.width / 48 : 14;
  return {
    x: Math.max(
      0,
      Math.min(47, Math.floor((event.clientX - (rect?.left ?? 0)) / cell)),
    ),
    y: Math.max(
      0,
      Math.min(31, Math.floor((event.clientY - (rect?.top ?? 0)) / cell)),
    ),
  };
};
const clearGesture = () => {
  const active = gesture.value;
  gesture.value = null;
  setDrawing(null);
  setBox(null);
  updatePreview({});
  if (active && viewport.value?.hasPointerCapture(active.pointerId))
    viewport.value.releasePointerCapture(active.pointerId);
};
const capture = (event: Pointer, next: Omit<Gesture, "pointerId">) => {
  updatePreview({});
  gesture.value = { ...next, pointerId: event.pointerId };
  viewport.value?.setPointerCapture(event.pointerId);
  event.preventDefault();
};
const down = (event: Pointer, layer?: Layer, corner?: string) => {
  if (
    presentation.value ||
    gesture.value ||
    (event.button !== 0 && event.button !== 1)
  )
    return;
  board.value?.focus({ preventScroll: true });
  const at = cellAt(event);
  if (doc.tool === "hand" || event.button === 1) {
    event.stopPropagation();
    capture(event, {
      mode: "pan",
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...at, w: 1, h: 1 },
      ids: [],
      scrollX: viewport.value?.scrollLeft ?? 0,
      scrollY: viewport.value?.scrollTop ?? 0,
    });
    return;
  }
  if (layer && doc.tool === "select") {
    event.stopPropagation();
    if (locked.value.has(layer.id)) {
      if (layer.rect.w === 48 && layer.rect.h === 32) down(event);
      return;
    }
    // Dragging a member of an already-selected group moves that group.
    // Shift still targets the member so it can join a separate selection.
    if (!corner && !event.shiftKey && !doc.selection.includes(layer.id)) {
      const memberId = layer.id;
      const selectedGroup = doc.layers.find(
        (item) =>
          item.kind === "group" &&
          doc.selection.includes(item.id) &&
          descendantIds(doc.layers, item.id).has(memberId),
      );
      if (selectedGroup) layer = selectedGroup;
    }
    if (event.shiftKey && !corner && doc.selection.includes(layer.id)) {
      doc.toggleInSelection(layer.id);
      event.preventDefault();
      return;
    }
    const ids = event.shiftKey
      ? [...new Set([...doc.selection, layer.id])]
      : doc.selection.includes(layer.id)
        ? [...doc.selection]
        : [layer.id];
    doc.select(ids);
    const moved = new Set(ids);
    ids.forEach((id) =>
      descendantIds(doc.layers, id).forEach((child) => moved.add(child)),
    );
    const affected = corner
      ? layer.kind === "group"
        ? [layer.id, ...descendantIds(doc.layers, layer.id)].filter(
            (id) => !locked.value.has(id),
          )
        : [layer.id]
      : [...moved].filter((id) => !locked.value.has(id));
    capture(event, {
      mode: corner ? "resize" : "move",
      startX: event.clientX,
      startY: event.clientY,
      origin: layer.rect,
      ids: affected,
      rects: Object.fromEntries(
        doc.layers
          .filter((item) => affected.includes(item.id))
          .map((item) => [item.id, item.rect]),
      ),
      corner,
    });
    return;
  }
  if (layer) return;
  if (!event.shiftKey || doc.tool !== "select") doc.clearSelection();
  if (doc.tool === "select") {
    capture(event, {
      mode: "marquee",
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...at, w: 1, h: 1 },
      ids: event.shiftKey ? [...doc.selection] : [],
    });
    setBox({ ...at, w: 1, h: 1 });
  } else {
    const kind = doc.tool;
    const art =
      kind === "image"
        ? (getAssets().find((asset) => asset.kind === "image")?.art ?? ORB_ART)
        : null;
    const layer = createLayer(
      kind,
      { ...at, w: 1, h: 1 },
      {
        art,
        name:
          kind === "text"
            ? "Your next big idea"
            : kind === "image"
              ? "Image"
              : `${kind[0].toUpperCase()}${kind.slice(1)} ${doc.layers.length + 1}`,
      },
    );
    capture(event, {
      mode: "draw",
      startX: event.clientX,
      startY: event.clientY,
      origin: layer.rect,
      ids: [],
      layer,
    });
    setDrawing(layer);
  }
};
const move = (event: Pointer) => {
  if (presentation.value) return;
  const at = cellAt(event);
  setPosition(at);
  const active = gesture.value;
  if (!active || event.pointerId !== active.pointerId) return;
  if (active.mode === "pan") {
    if (viewport.value) {
      viewport.value.scrollLeft =
        (active.scrollX ?? 0) - event.clientX + active.startX;
      viewport.value.scrollTop =
        (active.scrollY ?? 0) - event.clientY + active.startY;
    }
    return;
  }
  if (
    !active.moved &&
    Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < 3
  )
    return;
  active.moved = true;
  const cell = (board.value?.getBoundingClientRect().width ?? 672) / 48;
  let dx = Math.round((event.clientX - active.startX) / cell),
    dy = Math.round((event.clientY - active.startY) / cell);
  if (active.mode === "move") {
    const members = Object.entries(active.rects ?? {}).map(([id, rect]) => ({
      id,
      rect,
    }));
    if (!members.length) return;
    dx = Math.max(
      -Math.min(...members.map((l) => l.rect.x)),
      Math.min(48 - Math.max(...members.map((l) => l.rect.x + l.rect.w)), dx),
    );
    dy = Math.max(
      -Math.min(...members.map((l) => l.rect.y)),
      Math.min(32 - Math.max(...members.map((l) => l.rect.y + l.rect.h)), dy),
    );
    updatePreview(
      Object.fromEntries(
        members.map((layer) => [
          layer.id,
          { ...layer.rect, x: layer.rect.x + dx, y: layer.rect.y + dy },
        ]),
      ),
    );
  } else if (active.mode === "resize") {
    const r = active.origin;
    const west = active.corner?.includes("w"),
      north = active.corner?.includes("n");
    const x = west ? Math.max(0, Math.min(r.x + r.w - 1, r.x + dx)) : r.x;
    const y = north ? Math.max(0, Math.min(r.y + r.h - 1, r.y + dy)) : r.y;
    const w = west ? r.x + r.w - x : Math.max(1, Math.min(48 - x, r.w + dx));
    const h = north ? r.y + r.h - y : Math.max(1, Math.min(32 - y, r.h + dy));
    let resized = clampRect({ x, y, w, h });
    if (event.shiftKey) {
      const changeX = (west ? -dx : dx) / r.w,
        changeY = (north ? -dy : dy) / r.h;
      const scale = Math.max(
        Math.max(1 / r.w, 1 / r.h),
        Math.min(
          1 + (Math.abs(changeX) >= Math.abs(changeY) ? changeX : changeY),
          (west ? r.x + r.w : CANVAS_COLS - r.x) / r.w,
          (north ? r.y + r.h : CANVAS_ROWS - r.y) / r.h,
        ),
      );
      const width = Math.max(1, Math.round(r.w * scale)),
        height = Math.max(1, Math.round(r.h * scale));
      resized = clampRect({
        x: west ? r.x + r.w - width : r.x,
        y: north ? r.y + r.h - height : r.y,
        w: width,
        h: height,
      });
    }
    updatePreview(
      Object.fromEntries(
        active.ids.map((id) => {
          const origin = active.rects?.[id] ?? r;
          return [
            id,
            id === active.ids[0]
              ? resized
              : clampRect({
                  x: resized.x + ((origin.x - r.x) * resized.w) / r.w,
                  y: resized.y + ((origin.y - r.y) * resized.h) / r.h,
                  w: (origin.w * resized.w) / r.w,
                  h: (origin.h * resized.h) / r.h,
                }),
          ];
        }),
      ),
    );
  } else {
    let w = Math.abs(at.x - active.origin.x) + 1,
      h = Math.abs(at.y - active.origin.y) + 1;
    if (event.shiftKey && active.mode === "draw") w = h = Math.min(w, h);
    const rect = clampRect({
      x: at.x < active.origin.x ? active.origin.x - w + 1 : active.origin.x,
      y: at.y < active.origin.y ? active.origin.y - h + 1 : active.origin.y,
      w,
      h,
    });
    setBox(rect);
    previewRef.value = { marquee: rect };
    if (active.layer) setDrawing({ ...active.layer, rect });
  }
};
const up = (event: Pointer, cancel = false) => {
  const active = gesture.value;
  if (!active || event.pointerId !== active.pointerId) return;
  if (!cancel && active.mode === "draw" && active.layer) {
    const raw = previewRef.value.marquee;
    const rect =
      raw ??
      clampRect({
        ...active.origin,
        w: active.layer.kind === "text" ? 18 : 12,
        h: active.layer.kind === "text" ? 4 : 10,
      });
    const layer = { ...active.layer, rect };
    doc.commitLayers("create", (layers) => [...layers, layer], [layer.id]);
    doc.setTool("select");
  } else if (!cancel && active.mode === "marquee" && previewRef.value.marquee) {
    doc.select([
      ...new Set([
        ...active.ids,
        ...marqueeHits(doc.layers, previewRef.value.marquee),
      ]),
    ]);
  } else if (!cancel && (active.mode === "move" || active.mode === "resize")) {
    const next = previewRef.value;
    if (Object.keys(next).length)
      doc.commitLayers(active.mode, (layers) =>
        layers.map((layer) =>
          next[layer.id] &&
          JSON.stringify(next[layer.id]) !== JSON.stringify(layer.rect)
            ? { ...layer, rect: next[layer.id] }
            : layer,
        ),
      );
  }
  clearGesture();
};
watchLifecycle(
  () => {
    if (presentation.value) return;
    const fit = () => {
      clearGesture();
      const rect = viewport.value?.getBoundingClientRect();
      if (!rect) return;
      const values = [50, 75, 100, 150, 200];
      const suitable = values.reduce(
        (best, scale, i) =>
          (672 * scale) / 100 < rect.width - 65 &&
          (448 * scale) / 100 < rect.height - 70
            ? i
            : best,
        0,
      );
      const diff = suitable - doc.zoomIndex;
      for (let i = 0; i < Math.abs(diff); i++)
        diff > 0 ? doc.zoomIn() : doc.zoomOut();
      requestAnimationFrame(() => {
        const scroller = viewport.value;
        if (!scroller) return;
        scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
        scroller.scrollTop =
          (scroller.scrollHeight - scroller.clientHeight) / 2;
      });
    };
    window.addEventListener("pictor:fit", fit);
    return () => window.removeEventListener("pictor:fit", fit);
  },
  () => [doc, presentation.value],
);
watchLifecycle(
  () => {
    if (presentation.value) return;
    const frame = requestAnimationFrame(() =>
      window.dispatchEvent(new Event("pictor:fit")),
    );
    return () => cancelAnimationFrame(frame);
  },
  () => [presentation.value, doc.fileId],
);
watchLifecycle(
  () => {
    clearGesture();
  },
  () => [doc.tool, doc.fileId, doc.zoomIndex],
);
const inspectAt = (event: MouseEvent) => {
  if (presentation.value || doc.tool !== "select") return;
  // Pointer capture makes the viewport the click target. Hit-test model layers
  // against the artboard rather than relying on a per-layer dblclick listener.
  const bounds = board.value?.getBoundingClientRect();
  if (
    !bounds?.width ||
    !bounds.height ||
    event.clientX < bounds.left ||
    event.clientY < bounds.top ||
    event.clientX >= bounds.left + bounds.width ||
    event.clientY >= bounds.top + bounds.height
  )
    return;
  const x = ((event.clientX - bounds.left) * CANVAS_COLS) / bounds.width;
  const y = ((event.clientY - bounds.top) * CANVAS_ROWS) / bounds.height;
  const hit = [...painted.value]
    .reverse()
    .find(
      (layer) =>
        visible.value.has(layer.id) &&
        layer.kind !== "group" &&
        x >= layer.rect.x &&
        y >= layer.rect.y &&
        x < layer.rect.x + layer.rect.w &&
        y < layer.rect.y + layer.rect.h,
    );
  if (hit?.kind === "text" && !locked.value.has(hit.id)) {
    doc.select([hit.id]);
    onInspect.value?.();
  }
};
const cornerLabel = (corner: string) =>
  t(
    (
      {
        nw: "Top left",
        ne: "Top right",
        sw: "Bottom left",
        se: "Bottom right",
      } as Record<string, string>
    )[corner] ?? corner,
  );
</script>
<template>
  <div class="pictor-canvas" :data-presentation="presentation || undefined">
    <div class="pictor-canvas__label">
      <span
        ><span class="pictor-live-dot"></span
        ><template v-if="presentation">{{ t("INTERACTIVE PREVIEW") }}</template
        ><template v-else>{{ t("ARTBOARD 01") }}</template></span
      ><span>{{ t("960 × 640 · RGB") }}</span>
    </div>
    <div
      ref="viewport"
      class="canvas-scroll"
      :data-pan-active="gesture?.mode === 'pan' || undefined"
      @pointerdown="
        (event) => {
          if (doc.tool === 'hand' || event.button === 1) down(event);
        }
      "
      @dblclick="inspectAt"
      @pointermove="move"
      @pointerup="(event) => up(event)"
      @pointercancel="(event) => up(event, true)"
      @lostpointercapture="(event) => up(event, true)"
      @keydown="
        (event) => {
          if (event.key === 'Escape' && gesture) {
            clearGesture();
            event.stopPropagation();
          }
        }
      "
    >
      <div class="canvas-workspace">
        <div
          class="canvas-frame"
          :data-zoom="String(zoomPercent(doc.zoomIndex))"
        >
          <div class="ruler ruler--x" aria-hidden="true">
            <template v-for="(_, i) in Array.from({ length: 12 })" :key="i"
              ><span>{{ i * 80 }}</span></template
            >
          </div>
          <div
            ref="board"
            class="artboard"
            :tabindex="presentation ? undefined : 0"
            data-artboard
            :data-zoom="String(presentation ? 100 : zoomPercent(doc.zoomIndex))"
            :data-grid="!presentation && doc.showGrid ? '' : undefined"
            :data-tool="doc.tool"
            :role="presentation ? 'region' : 'application'"
            :aria-label="
              presentation
                ? t('Interactive design preview')
                : t(
                    'Design canvas. Select a tool or layer, drag to draw or move, use corner handles to resize.',
                  )
            "
            @pointerdown="(event) => down(event)"
          >
            <template
              v-for="{ layer, shown } in painted
                .filter((layer) => visible.has(layer.id))
                .map((layer) => {
                  const shown = preview[layer.id]
                    ? { ...layer, rect: preview[layer.id] }
                    : layer;
                  return { layer, shown };
                })
                .filter(
                  (item): item is NonNullable<typeof item> => item != null,
                )"
              :key="layer.id"
              ><div
                class="layer"
                v-bind="attrs(shown.rect)"
                :data-layer="layer.id"
                :data-kind="layer.kind"
                :data-opacity="String(layer.opacity)"
                :data-blend="layer.blend"
                :data-masked="layer.masked ? '' : undefined"
                :data-locked="locked.has(layer.id) || undefined"
                :data-selected="
                  !presentation && doc.selection.includes(layer.id)
                    ? ''
                    : undefined
                "
                :aria-label="layer.name"
                @pointerdown="(event) => down(event, layer)"
              >
                <LayerPaint
                  :layer="shown"
                  :presentation="presentation"
                ></LayerPaint></div
            ></template>
            <template v-if="!presentation && drawing"
              ><div
                class="layer layer--drawing"
                v-bind="attrs(drawing.rect)"
                :data-kind="drawing.kind"
              >
                <LayerPaint :layer="drawing"></LayerPaint></div></template
            ><template v-else></template>
            <template v-if="!presentation && box && !drawing"
              ><div class="marquee" v-bind="attrs(box)"></div></template
            ><template v-else></template>
            <template v-if="!presentation"
              ><template
                v-for="{ id, layer, rect } in doc.selection
                  .map((id) => {
                    const layer = doc.layers.find((l) => l.id === id);
                    if (!layer || !visible.has(id) || locked.has(id))
                      return null;
                    const rect = preview[id] ?? layer.rect;
                    return { id, layer, rect };
                  })
                  .filter(
                    (item): item is NonNullable<typeof item> => item != null,
                  )"
                :key="id"
                ><div class="selection-box" v-bind="attrs(rect)">
                  <span class="selection-box__size"
                    >{{ rect.w * 20 }} × {{ rect.h * 20 }}</span
                  ><template v-if="doc.selection.length === 1"
                    ><template
                      v-for="corner in ['nw', 'ne', 'sw', 'se']"
                      :key="corner"
                      ><button
                        class="resize-handle"
                        :data-corner="corner"
                        :aria-label="
                          t('Resize {name} from {corner}', {
                            name: layer.name,
                            corner: cornerLabel(corner),
                          })
                        "
                        @pointerdown="
                          (event) => {
                            event.stopPropagation();
                            down(event, layer, corner);
                          }
                        "
                      ></button></template></template
                  ><template v-else></template></div></template
            ></template>
          </div>
        </div>
      </div>
    </div>
    <template v-if="!presentation"
      ><div class="pictor-canvas__foot">
        <span
          ><template v-if="doc.tool === 'select'">{{
            t(
              "Drag to move · Shift-click to add/remove · Corners to resize · Shift-resize keeps proportions",
            )
          }}</template
          ><template v-else
            ><template v-if="doc.tool === 'hand'">{{
              t("Drag anywhere to pan · Fit recenters the artboard")
            }}</template
            ><template v-else
              ><template v-if="doc.tool === 'image'">{{
                t("Choose Artwork in Insert, or drag to place a sample image")
              }}</template
              ><template v-else>{{
                t(
                  "Click to add a {tool}, or drag to size it · Shift for equal sides",
                  { tool: t("design.tool." + doc.tool) },
                )
              }}</template></template
            ></template
          ></span
        ><span>X {{ position.x * 20 }} · Y {{ position.y * 20 }}</span>
      </div></template
    ><template v-else></template>
  </div>
</template>
