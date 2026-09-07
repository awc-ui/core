import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  inject,
  AfterViewInit,
  OnDestroy,
  DoCheck,
} from "@angular/core";
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
  colorOf,
  createLayer,
  ORB_ART,
  textLayout,
} from "@awc-ui/pictor-model";
import { StudioService } from "./lib/studio.service";
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
@Component({
  selector: "pictor-paint",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./paint.html",
})
export class PaintComponent {
  @Input({ required: true }) layer!: Layer;
  @Input() presentation = false;
  activated = false;
  studio = inject(StudioService);
  get fill() {
    return colorOf(this.layer.fill, "none");
  }
  get width() {
    return this.layer.rect.w * 20;
  }
  get height() {
    return this.layer.rect.h * 20;
  }
  get text() {
    return textLayout(
      this.layer,
      this.layer.textKey ? this.studio.t(this.layer.textKey) : this.layer.name,
    );
  }
  adjustment(kind: string) {
    return this.layer.adjustments.find((a) => a.kind === kind)?.value ?? 0;
  }
  activate() {
    if (this.presentation) this.activated = !this.activated;
  }
}
@Component({
  selector: "pictor-canvas",
  standalone: true,
  imports: [PaintComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./canvas.html",
})
export class CanvasComponent implements AfterViewInit, OnDestroy, DoCheck {
  @Input() presentation = false;
  @Output() inspect = new EventEmitter<void>();
  @ViewChild("board") board?: ElementRef<HTMLDivElement>;
  @ViewChild("viewport") viewport?: ElementRef<HTMLDivElement>;
  studio = inject(StudioService);
  get doc() {
    return this.studio.doc;
  }
  get locked() {
    return lockedLayers(this.doc.layers);
  }
  get visible() {
    return visibleLayers(this.doc.layers);
  }
  get painted() {
    return zOrder(this.doc.layers).filter((layer) =>
      this.visible.has(layer.id),
    );
  }
  gesture: Gesture | null = null;
  preview: Record<string, Rect> = {};
  box: Rect | null = null;
  drawing: Layer | null = null;
  position = { x: 0, y: 0 };
  ticks = Array.from({ length: 12 }, (_, i) => i * 80);
  corners = ["nw", "ne", "sw", "se"];
  zoomPercent = zoomPercent;
  private key = "";
  private frame = 0;
  updatePreview = (next: Record<string, Rect>) => {
    this.preview = next;
  };
  setDrawing = (next: Layer | null) => {
    this.drawing = next;
  };
  setBox = (next: Rect | null) => {
    this.box = next;
  };
  setPosition = (next: { x: number; y: number }) => {
    this.position = next;
  };
  shown(layer: Layer) {
    return this.preview[layer.id]
      ? { ...layer, rect: this.preview[layer.id] }
      : layer;
  }
  get selected() {
    return this.doc.layers
      .filter(
        (layer) =>
          this.doc.selection.includes(layer.id) &&
          this.visible.has(layer.id) &&
          !this.locked.has(layer.id),
      )
      .map((layer) => this.shown(layer));
  }
  doubleClick(event: MouseEvent) {
    if (this.presentation || this.doc.tool !== 'select') return;
    // Capture retargets dblclick to the viewport. Hit-test the painted layers
    // so the visually frontmost object, rather than an ancestor, receives it.
    const bounds = this.board?.nativeElement.getBoundingClientRect();
    if (!bounds?.width || !bounds.height || event.clientX < bounds.left || event.clientY < bounds.top || event.clientX >= bounds.right || event.clientY >= bounds.bottom) return;
    const x = (event.clientX - bounds.left) * CANVAS_COLS / bounds.width;
    const y = (event.clientY - bounds.top) * CANVAS_ROWS / bounds.height;
    const visible = this.visible;
    const hit = [...zOrder(this.doc.layers)].reverse().find(layer => visible.has(layer.id) && layer.kind !== 'group' && x >= layer.rect.x && y >= layer.rect.y && x < layer.rect.x + layer.rect.w && y < layer.rect.y + layer.rect.h);
    if (hit?.kind === 'text' && !this.locked.has(hit.id)) {
      this.doc.select([hit.id]);
      this.inspect.emit();
    }
  }
  viewportDown(event: PointerEvent) {
    if (this.doc.tool === "hand" || event.button === 1) this.down(event);
  }
  resize(event: PointerEvent, layer: Layer, corner: string) {
    event.stopPropagation();
    this.down(event, layer, corner);
  }
  escape(event: KeyboardEvent) {
    if (event.key === "Escape" && this.gesture) {
      this.clearGesture();
      event.stopPropagation();
    }
  }
  cellAt = (event: { clientX: number; clientY: number }) => {
    const rect = this.board?.nativeElement?.getBoundingClientRect();
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
  clearGesture = () => {
    const active = this.gesture;
    this.gesture = null;
    this.setDrawing(null);
    this.setBox(null);
    this.updatePreview({});
    if (
      active &&
      this.viewport?.nativeElement?.hasPointerCapture(active.pointerId)
    )
      this.viewport?.nativeElement.releasePointerCapture(active.pointerId);
  };
  capture = (event: Pointer, next: Omit<Gesture, "pointerId">) => {
    this.updatePreview({});
    this.gesture = { ...next, pointerId: event.pointerId };
    this.viewport?.nativeElement?.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  down = (event: Pointer, layer?: Layer, corner?: string) => {
    if (
      this.presentation ||
      this.gesture ||
      (event.button !== 0 && event.button !== 1)
    )
      return;
    this.board?.nativeElement?.focus({ preventScroll: true });
    const at = this.cellAt(event);
    if (this.doc.tool === "hand" || event.button === 1) {
      event.stopPropagation();
      this.capture(event, {
        mode: "pan",
        startX: event.clientX,
        startY: event.clientY,
        origin: { ...at, w: 1, h: 1 },
        ids: [],
        scrollX: this.viewport?.nativeElement?.scrollLeft ?? 0,
        scrollY: this.viewport?.nativeElement?.scrollTop ?? 0,
      });
      return;
    }
    if (layer && this.doc.tool === "select") {
      event.stopPropagation();
      if (this.locked.has(layer.id)) {
        if (layer.rect.w === 48 && layer.rect.h === 32) this.down(event);
        return;
      }
      // Dragging a member of an already-selected group moves that group.
      // Shift still targets the member so it can join a separate selection.
      if (
        !corner &&
        !event.shiftKey &&
        !this.doc.selection.includes(layer.id)
      ) {
        const memberId = layer.id;
        const selectedGroup = this.doc.layers.find(
          (item) =>
            item.kind === "group" &&
            this.doc.selection.includes(item.id) &&
            descendantIds(this.doc.layers, item.id).has(memberId),
        );
        if (selectedGroup) layer = selectedGroup;
      }
      if (event.shiftKey && !corner && this.doc.selection.includes(layer.id)) {
        this.doc.toggleInSelection(layer.id);
        event.preventDefault();
        return;
      }
      const ids = event.shiftKey
        ? [...new Set([...this.doc.selection, layer.id])]
        : this.doc.selection.includes(layer.id)
          ? [...this.doc.selection]
          : [layer.id];
      this.doc.select(ids);
      const moved = new Set(ids);
      ids.forEach((id) =>
        descendantIds(this.doc.layers, id).forEach((child) => moved.add(child)),
      );
      const affected = corner
        ? layer.kind === "group"
          ? [layer.id, ...descendantIds(this.doc.layers, layer.id)].filter(
              (id) => !this.locked.has(id),
            )
          : [layer.id]
        : [...moved].filter((id) => !this.locked.has(id));
      this.capture(event, {
        mode: corner ? "resize" : "move",
        startX: event.clientX,
        startY: event.clientY,
        origin: layer.rect,
        ids: affected,
        rects: Object.fromEntries(
          this.doc.layers
            .filter((item) => affected.includes(item.id))
            .map((item) => [item.id, item.rect]),
        ),
        corner,
      });
      return;
    }
    if (layer) return;
    if (!event.shiftKey || this.doc.tool !== "select")
      this.doc.clearSelection();
    if (this.doc.tool === "select") {
      this.capture(event, {
        mode: "marquee",
        startX: event.clientX,
        startY: event.clientY,
        origin: { ...at, w: 1, h: 1 },
        ids: event.shiftKey ? [...this.doc.selection] : [],
      });
      this.setBox({ ...at, w: 1, h: 1 });
    } else {
      const kind = this.doc.tool;
      const art =
        kind === "image"
          ? (getAssets().find((asset) => asset.kind === "image")?.art ??
            ORB_ART)
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
                : `${kind[0].toUpperCase()}${kind.slice(1)} ${this.doc.layers.length + 1}`,
        },
      );
      this.capture(event, {
        mode: "draw",
        startX: event.clientX,
        startY: event.clientY,
        origin: layer.rect,
        ids: [],
        layer,
      });
      this.setDrawing(layer);
    }
  };
  move = (event: Pointer) => {
    if (this.presentation) return;
    const at = this.cellAt(event);
    this.setPosition(at);
    const active = this.gesture;
    if (!active || event.pointerId !== active.pointerId) return;
    if (active.mode === "pan") {
      if (this.viewport?.nativeElement) {
        this.viewport.nativeElement.scrollLeft =
          (active.scrollX ?? 0) - event.clientX + active.startX;
        this.viewport.nativeElement.scrollTop =
          (active.scrollY ?? 0) - event.clientY + active.startY;
      }
      return;
    }
    if (
      !active.moved &&
      Math.hypot(event.clientX - active.startX, event.clientY - active.startY) <
        3
    )
      return;
    active.moved = true;
    const cell =
      (this.board?.nativeElement?.getBoundingClientRect().width ?? 672) / 48;
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
      this.updatePreview(
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
      this.updatePreview(
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
      this.setBox(rect);
      this.preview = { marquee: rect };
      if (active.layer) this.setDrawing({ ...active.layer, rect });
    }
  };
  up = (event: Pointer, cancel = false) => {
    const active = this.gesture;
    if (!active || event.pointerId !== active.pointerId) return;
    if (!cancel && active.mode === "draw" && active.layer) {
      const raw = this.preview.marquee;
      const rect =
        raw ??
        clampRect({
          ...active.origin,
          w: active.layer.kind === "text" ? 18 : 12,
          h: active.layer.kind === "text" ? 4 : 10,
        });
      const layer = { ...active.layer, rect };
      this.doc.commitLayers("create", (layers) => [...layers, layer], [
        layer.id,
      ]);
      this.doc.setTool("select");
    } else if (!cancel && active.mode === "marquee" && this.preview.marquee) {
      this.doc.select([
        ...new Set([
          ...active.ids,
          ...marqueeHits(this.doc.layers, this.preview.marquee),
        ]),
      ]);
    } else if (
      !cancel &&
      (active.mode === "move" || active.mode === "resize")
    ) {
      const next = this.preview;
      if (Object.keys(next).length)
        this.doc.commitLayers(active.mode, (layers) =>
          layers.map((layer) =>
            next[layer.id] &&
            JSON.stringify(next[layer.id]) !== JSON.stringify(layer.rect)
              ? { ...layer, rect: next[layer.id] }
              : layer,
          ),
        );
    }
    this.clearGesture();
  };

  fit = () => {
    if (this.presentation) return;
    this.clearGesture();
    const rect = this.viewport?.nativeElement.getBoundingClientRect();
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
    const diff = suitable - this.doc.zoomIndex;
    for (let i = 0; i < Math.abs(diff); i++)
      diff > 0 ? this.doc.zoomIn() : this.doc.zoomOut();
    requestAnimationFrame(() => {
      const scroller = this.viewport?.nativeElement;
      if (scroller) {
        scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
        scroller.scrollTop =
          (scroller.scrollHeight - scroller.clientHeight) / 2;
      }
    });
  };
  ngAfterViewInit() {
    if (!this.presentation) {
      window.addEventListener("pictor:fit", this.fit);
      this.frame = requestAnimationFrame(this.fit);
    }
  }
  ngDoCheck() {
    const key = this.doc.tool + this.doc.fileId + this.doc.zoomIndex;
    if (this.key !== key) {
      const newFile = !this.key.includes(this.doc.fileId);
      this.key = key;
      this.clearGesture();
      if (newFile && !this.presentation)
        this.frame = requestAnimationFrame(this.fit);
    }
  }
  ngOnDestroy() {
    window.removeEventListener("pictor:fit", this.fit);
    cancelAnimationFrame(this.frame);
    this.clearGesture();
  }
}
