import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  Input,
  OnChanges,
  inject,
} from "@angular/core";
import {
  ADJUSTMENT_ORDER,
  BLEND_ORDER,
  ALIGN_ORDER,
  ancestorIds,
  adjustmentKey,
  alignIcon,
  alignKey,
  blendKey,
  canReparent,
  childrenOf,
  commonValue,
  isContainer,
  layerById,
  layerIcon,
  lockedLayers,
  moveSubtree,
  clampRect,
  visibleLayers,
  getAssets,
  editIcon,
  type Layer,
  type Rect,
  type Asset,
} from "@awc-ui/showcase-kit/design";
import {
  colorOf,
  pictorSearchText,
  componentMarkup,
  DEFAULT_SWATCHES,
  createLayer,
  layerFromAsset,
  LIVE_COMPONENTS,
  ORB_ART,
  WAVE_ART,
  LANDSCAPE_ART,
  treeRows,
} from "@awc-ui/pictor-model";
import { StudioService } from "./lib/studio.service";
import { CONTROLS } from "./controls";
@Component({
  selector: "pictor-inspector",
  standalone: true,
  imports: CONTROLS,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./inspector.html",
})
export class InspectorComponent {
  studio = inject(StudioService);
  get doc() {
    return this.studio.doc;
  }
  get t() {
    return this.studio.t;
  }
  tab = "design";
  copied = false;
  tabs = [
    { value: "design", label: "Design" },
    { value: "code", label: "Handoff" },
  ];
  keys: readonly (keyof Rect)[] = ["x", "y", "w", "h"];
  swatches = DEFAULT_SWATCHES.slice(0, 12);
  aligns = ALIGN_ORDER;
  adjustments = ADJUSTMENT_ORDER;
  alignIcon = alignIcon;
  alignKey = alignKey;
  adjustmentKey = adjustmentKey;
  colorOf = colorOf;
  get selected() {
    return this.doc.layers.filter((l) => this.doc.selection.includes(l.id));
  }
  get first() {
    return this.selected[0];
  }
  get hasImage() {
    return this.selected.some((l) => l.kind === "image");
  }
  get canUngroup() {
    return this.selected.some((l) => l.kind === "group" || l.kind === "frame");
  }
  get blends() {
    return BLEND_ORDER.map((value) => ({
      value,
      label: this.t(blendKey(value)),
    }));
  }
  get name() {
    return this.selected.length === 1
      ? this.first.textKey
        ? this.t(this.first.textKey)
        : this.first.name
      : "";
  }
  get opacity() {
    const v = commonValue(
      this.doc.layers,
      this.doc.selection,
      (l) => l.opacity,
    );
    return typeof v === "number" ? v : 100;
  }
  geometry(key: keyof Rect) {
    const value = commonValue(
      this.doc.layers,
      this.doc.selection,
      (l) => l.rect[key],
    );
    return typeof value === "number" ? value * 20 : null;
  }
  setGeometry(key: keyof Rect, pixels: number | null) {
    if (pixels === null || !Number.isFinite(pixels)) return;
    const value = Math.round(pixels / 20);
    this.doc.commitLayers(
      key === "x" || key === "y" ? "move" : "resize",
      (layers) => {
        let next = layers;
        const ids =
          key === "x" || key === "y"
            ? this.doc.selection.filter(
                (id) =>
                  ![...ancestorIds(layers, id)].some((p) =>
                    this.doc.selection.includes(p),
                  ),
              )
            : this.doc.selection;
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
      },
    );
  }
  rename(name: string) {
    this.doc.restyle({
      name,
      ...(this.first?.kind === "text" ? { textKey: null } : {}),
    });
  }
  fill(value: string) {
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value))
      this.doc.restyle({ fill: value });
  }
  blend(value: string) {
    this.doc.restyle({
      blend: value as Layer["blend"],
      blendKey: blendKey(value as Layer["blend"]),
    });
  }
  adjustment(kind: string) {
    return this.first?.adjustments.find((a) => a.kind === kind)?.value ?? 0;
  }
  reorder(front: boolean) {
    if (this.first)
      this.doc.reorderTo(
        this.first.id,
        this.first.parentId,
        front ? childrenOf(this.doc.layers, this.first.parentId).length - 1 : 0,
      );
  }
  get snippet() {
    const f = this.first;
    return !f
      ? ""
      : f.componentId?.startsWith("awc:")
        ? componentMarkup(f)
        : `.design-element {\n  width: ${f.rect.w * 20}px;\n  height: ${f.rect.h * 20}px;\n  ${f.kind === "text" ? "color" : "background"}: ${colorOf(f.fill)};\n  opacity: ${f.opacity / 100};\n  mix-blend-mode: ${f.blend};\n}`;
  }
  async copy() {
    try {
      await navigator.clipboard.writeText(this.snippet);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.copied = false;
    }
  }
}
@Component({
  selector: "pictor-insert",
  standalone: true,
  imports: CONTROLS,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./insert.html",
})
export class InsertComponent implements OnChanges {
  @Input() category = "components";
  @Input() request = 0;
  studio = inject(StudioService);
  tab = "components";
  query = "";
  tabs = [
    { value: "components", label: "Live UI" },
    { value: "art", label: "Artwork" },
    { value: "color", label: "Color" },
  ];
  ngOnChanges() {
    this.tab = this.category;
    this.query = "";
  }
  get components() {
    return LIVE_COMPONENTS.filter((item) =>
      pictorSearchText(
        item.name +
          " " +
          item.description +
          " " +
          this.studio.t(item.name) +
          " " +
          this.studio.t(item.description),
      ).includes(pictorSearchText(this.query)),
    );
  }
  get art() {
    return [
      { name: "Orbital sculpture", art: ORB_ART },
      { name: "Electric ribbon", art: WAVE_ART },
      { name: "New horizons", art: LANDSCAPE_ART },
    ].filter((item) =>
      pictorSearchText(item.name + " " + this.studio.t(item.name)).includes(
        pictorSearchText(this.query),
      ),
    );
  }
  get assets() {
    return getAssets()
      .filter(
        (asset) =>
          asset.art &&
          pictorSearchText(asset.name).includes(pictorSearchText(this.query)),
      )
      .slice(0, 18);
  }
  get colors() {
    return DEFAULT_SWATCHES.filter((color) =>
      pictorSearchText(color).includes(pictorSearchText(this.query)),
    );
  }
  insert(layer: Layer) {
    this.studio.doc.commitLayers("create", (layers) => [...layers, layer], [
      layer.id,
    ]);
    this.studio.doc.setTool("select");
  }
  component(item: (typeof LIVE_COMPONENTS)[number]) {
    this.insert(
      createLayer(
        "component",
        {
          x: 16,
          y: 12,
          w: item.id === "awc:card" ? 17 : 15,
          h: item.id === "awc:card" ? 14 : 5,
        },
        { name: item.name, componentId: item.id, fill: "#BEE7AA" },
      ),
    );
  }
  image(item: { name: string; art: typeof ORB_ART }) {
    this.insert(
      createLayer(
        "image",
        { x: 14, y: 6, w: 20, h: 20 },
        { name: item.name, art: item.art, fill: null },
      ),
    );
  }
  asset(asset: Asset) {
    this.insert(layerFromAsset(asset));
  }
  color(fill: string) {
    this.insert(
      createLayer("rect", { x: 16, y: 10, w: 16, h: 12 }, { name: fill, fill }),
    );
  }
}
@Component({
  selector: "pictor-history",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<div class="history studio-history" data-history>
    <div class="studio-panel-head">
      <strong>{{ studio.t("Time machine") }}</strong
      ><span>{{
        studio.t("{count} edits", {
          count: studio.t.formatNumber(doc.history.entries.length),
        })
      }}</span>
    </div>
    <p class="studio-tip">
      {{
        studio.t(
          "Revisit any step. Making a new edit replaces the redo branch."
        )
      }}
    </p>
    <button
      class="history__row"
      [attr.data-current]="doc.history.index === 0 ? '' : null"
      (click)="doc.jumpHistory(0)"
    >
      <span class="material-symbols-outlined" aria-hidden="true">flag</span
      ><span
        ><strong>{{ studio.t("Starting canvas") }}</strong
        ><small>{{ studio.t("Your document before these edits") }}</small></span
      >
    </button>
    @for (entry of doc.history.entries; track entry.id; let i = $index) {
      <button
        class="history__row"
        [attr.data-edit]="entry.kind"
        [attr.data-undone]="i >= doc.history.index ? '' : null"
        [attr.data-current]="i === doc.history.index - 1 ? '' : null"
        (click)="doc.jumpHistory(i + 1)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">{{
          editIcon(entry.kind)
        }}</span
        ><span
          ><strong>{{ studio.t(entry.labelKey) }}</strong
          ><small>{{ entryName(entry) }}</small></span
        ><span class="studio-history__number">{{ i + 1 }}</span>
      </button>
    }
    @if (!doc.history.entries.length) {
      <div class="studio-history-empty">
        <span class="material-symbols-outlined" aria-hidden="true"
          >history</span
        >
        <p>
          {{
            studio.t("Your next idea starts here. Every change is reversible.")
          }}
        </p>
      </div>
    }
  </div>`,
})
export class HistoryComponent {
  entryName(entry: (typeof this.doc.history.entries)[number]) {
    return (
      entry.after[0]?.name ?? entry.before[0]?.name ?? this.studio.t("Canvas")
    );
  }
  studio = inject(StudioService);
  get doc() {
    return this.studio.doc;
  }
  editIcon = editIcon;
}
@Component({
  selector: "pictor-layer-tree",
  standalone: true,
  imports: CONTROLS,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./layers.html",
})
export class LayersComponent {
  studio = inject(StudioService);
  get doc() {
    return this.studio.doc;
  }
  query = "";
  collapsed = new Set<string>();
  dragId: string | null = null;
  dropOn: { id: string; side: "before" | "after" | "inside" } | null = null;
  isContainer = isContainer;
  layerIcon = layerIcon;
  get visible() {
    return visibleLayers(this.doc.layers);
  }
  get locked() {
    return lockedLayers(this.doc.layers);
  }
  get rows() {
    return treeRows(this.doc.layers).filter(({ layer }) =>
      this.query
        ? pictorSearchText(layer.name).includes(pictorSearchText(this.query))
        : ![...ancestorIds(this.doc.layers, layer.id)].some((id) =>
            this.collapsed.has(id),
          ),
    );
  }
  toggle(id: string, event: Event) {
    event.stopPropagation();
    this.collapsed.has(id) ? this.collapsed.delete(id) : this.collapsed.add(id);
  }
  select(id: string, event: MouseEvent) {
    if (!this.locked.has(id))
      event.shiftKey || event.metaKey || event.ctrlKey
        ? this.doc.toggleInSelection(id)
        : this.doc.select([id]);
  }
  start(e: DragEvent, id: string) {
    this.dragId = id;
    e.dataTransfer?.setData("text/plain", id);
  }
  over(e: DragEvent, id: string) {
    if (!this.dragId || this.dragId === id) return;
    e.preventDefault();
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect(),
      offset = (e.clientY - box.top) / box.height,
      layer = layerById(this.doc.layers, id);
    this.dropOn = {
      id,
      side:
        layer && isContainer(layer) && offset > 0.25 && offset < 0.75
          ? "inside"
          : offset < 0.5
            ? "before"
            : "after",
    };
  }
  drop(e: DragEvent) {
    e.preventDefault();
    if (this.dragId && this.dropOn) {
      const target = layerById(this.doc.layers, this.dropOn.id);
      if (target) {
        const parentId =
            this.dropOn.side === "inside" ? target.id : target.parentId,
          siblings = childrenOf(this.doc.layers, parentId).filter(
            (l) => l.id !== this.dragId,
          ),
          at =
            this.dropOn.side === "inside"
              ? siblings.length
              : siblings.findIndex((l) => l.id === target.id) +
                (this.dropOn.side === "after" ? 1 : 0);
        if (canReparent(this.doc.layers, this.dragId, parentId))
          this.doc.reorderTo(this.dragId, parentId, Math.max(0, at));
      }
    }
    this.end();
  }
  end() {
    this.dragId = null;
    this.dropOn = null;
  }
  key(e: KeyboardEvent, id: string, index: number) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!this.locked.has(id)) this.doc.select([id]);
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      const rows = (
        e.currentTarget as HTMLElement
      ).parentElement?.querySelectorAll<HTMLElement>('[role="treeitem"]');
      rows?.[
        Math.max(
          0,
          Math.min(
            this.rows.length - 1,
            index + (e.key === "ArrowDown" ? 1 : -1),
          ),
        )
      ]?.focus();
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      e.key === "ArrowLeft"
        ? this.collapsed.add(id)
        : this.collapsed.delete(id);
    }
  }
  visibility(id: string, event: Event) {
    event.stopPropagation();
    this.doc.toggleVisible(id);
  }
  lock(id: string, event: Event) {
    event.stopPropagation();
    this.doc.toggleLocked(id);
  }
}
