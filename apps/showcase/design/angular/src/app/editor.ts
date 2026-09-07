import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  Input,
  OnChanges,
  OnDestroy,
  inject,
} from "@angular/core";
import {
  fileById,
  canUndo,
  canRedo,
  zoomPercent,
  lockedLayers,
  visibleLayers,
  descendantIds,
  type ToolMode,
} from "@awc-ui/showcase-kit/design";
import { downloadDocument } from "@awc-ui/pictor-model";
import { StudioService } from "./lib/studio.service";
import { CONTROLS } from "./controls";
import { CanvasComponent } from "./canvas";
import {
  InspectorComponent,
  InsertComponent,
  LayersComponent,
  HistoryComponent,
} from "./panels";
@Component({
  selector: "pictor-export",
  standalone: true,
  imports: CONTROLS,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `@if (open) {
    <pictor-dialog
      [title]="studio.t('Made by you. Ready for the world.')"
      (closed)="closed.emit()"
      ><div class="studio-export" data-export-dialog>
        <div class="studio-export__preview">
          <img [src]="preview" [alt]="studio.t('Export preview')" />
        </div>
        <div class="studio-export__settings">
          <md-select
            [noResultsText]="studio.t('No results')"
            [noOptionsText]="studio.t('No options')"
            [clearLabel]="studio.t('Clear selection')"
            [loadingText]="studio.t('Loading…')"
            data-export-format
            [value]="format"
            [label]="studio.t('File format')"
            variant="outlined"
            [density]="-2"
            (mdChange)="format = $any($event).detail; message = ''"
          >
            @for (option of formats; track option.value) {
              <md-select-option
                [value]="option.value"
                [label]="studio.t(option.label)"
              />
            }
          </md-select>
          @if (format !== "json") {
            <pictor-select
              [label]="studio.t('Resolution')"
              [value]="scale"
              [options]="scales"
              (changed)="scale = $event"
            /><label class="studio-toggle"
              ><span>{{ studio.t("Add white background") }}</span
              ><md-switch
                [selected]="background"
                [attr.aria-label]="studio.t('Add white background')"
                (mdChange)="background = $any($event).detail.selected"
            /></label>
          }
          <p class="studio-description">
            {{
              format === "json"
                ? studio.t(
                    "Preserves the complete layer model, including geometry, colors and component references."
                  )
                : studio.t(
                    "Exports visible layers and embedded artwork. Live controls become static vector representations; image adjustments and blend effects are simplified."
                  )
            }}
          </p>
          <div role="status" class="studio-export__message">
            {{ studio.t(message) }}
          </div>
        </div>
      </div>
      <div actions>
        <md-button variant="text" (click)="closed.emit()">{{
          studio.t("Back to canvas")
        }}</md-button
        ><md-button
          variant="filled"
          icon="download"
          data-download
          [disabled]="busy"
          (click)="download()"
          >{{
            busy
              ? studio.t("Preparing…")
              : studio.t("Download {format}", { format: format.toUpperCase() })
          }}</md-button
        >
      </div></pictor-dialog
    >
  }`,
})
export class ExportComponent {
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();
  studio = inject(StudioService);
  format = "svg";
  scale = "1";
  background = false;
  busy = false;
  message = "";
  formats = [
    { value: "svg", label: "SVG · Scalable vector" },
    { value: "png", label: "PNG · Ready to share" },
    { value: "json", label: "JSON · Editable document data" },
  ];
  scales = [
    { value: "1", label: "1× · 960 × 640" },
    { value: "2", label: "2× · 1920 × 1280" },
    { value: "3", label: "3× · 2880 × 1920" },
  ];
  get preview() {
    return this.studio.svg(this.studio.doc.layers, this.background);
  }
  async download() {
    this.busy = true;
    this.message = "";
    try {
      await downloadDocument(
        this.studio.doc.layers,
        this.studio.t,
        this.format as "svg" | "png" | "json",
        fileById(this.studio.doc.fileId)?.name ?? "Pictor design",
        Number(this.scale),
        this.background,
      );
      this.message = "Your file is ready. Check your downloads.";
    } catch (error) {
      this.message =
        error instanceof Error
          ? error.message
          : "Export failed. Please try SVG.";
    } finally {
      this.busy = false;
    }
  }
}
import { Output, EventEmitter } from "@angular/core";
@Component({
  selector: "pictor-editor",
  standalone: true,
  imports: [
    ...CONTROLS,
    CanvasComponent,
    InspectorComponent,
    InsertComponent,
    LayersComponent,
    HistoryComponent,
    ExportComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./editor.html",
})
export class EditorComponent implements OnChanges, OnDestroy {
  @Input() fileId = "";
  studio = inject(StudioService);
  get doc() {
    return this.studio.doc;
  }
  get file() {
    return fileById(this.doc.fileId);
  }
  get valid() {
    return !this.fileId || !!fileById(this.fileId);
  }
  panel = "layers";
  insertCategory = "components";
  insertRequest = 0;
  showLeft = innerWidth > 700;
  showRight = innerWidth > 980;
  exportOpen = false;
  presentOpen = false;
  canUndo = canUndo;
  canRedo = canRedo;
  zoomPercent = zoomPercent;
  panels = [
    { value: "layers", label: "Layers" },
    { value: "insert", label: "Insert" },
    { value: "history", label: "History" },
  ];
  tools: { tool: ToolMode; icon: string; label: string; key: string }[] = [
    { tool: "select", icon: "near_me", label: "Select and move", key: "V" },
    { tool: "frame", icon: "crop_free", label: "Frame", key: "F" },
    { tool: "rect", icon: "rectangle", label: "Rectangle", key: "R" },
    { tool: "ellipse", icon: "circle", label: "Ellipse", key: "O" },
    { tool: "text", icon: "title", label: "Text", key: "T" },
    { tool: "image", icon: "image", label: "Insert artwork", key: "I" },
    { tool: "hand", icon: "pan_tool", label: "Pan", key: "H" },
  ];
  help: Record<ToolMode, [string, string]> = {
    select: [
      "Select",
      "Drag to move · Shift-click to select more · Drag a corner to resize",
    ],
    frame: [
      "Frame",
      "Drag on the canvas to draw a frame, or click for a starting size.",
    ],
    rect: ["Rectangle", "Drag on the canvas to draw · Hold Shift for a square"],
    ellipse: [
      "Ellipse",
      "Drag on the canvas to draw · Hold Shift for a circle",
    ],
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
  private exporting = () => (this.exportOpen = true);
  private presenting = () => (this.presentOpen = true);
  private inserting = () => this.insert();
  constructor() {
    window.addEventListener("pictor:export", this.exporting);
    window.addEventListener("pictor:present", this.presenting);
    window.addEventListener("pictor:insert", this.inserting);
  }
  ngOnChanges() {
    if (this.fileId && this.fileId !== this.doc.fileId)
      this.doc.openFile(this.fileId);
  }
  ngOnDestroy() {
    window.removeEventListener("pictor:export", this.exporting);
    window.removeEventListener("pictor:present", this.presenting);
    window.removeEventListener("pictor:insert", this.inserting);
  }
  insert(category = "components") {
    this.insertCategory = category;
    this.insertRequest++;
    this.panel = "insert";
    this.showLeft = true;
  }
  tool(mode: ToolMode) {
    this.doc.setTool(mode);
    if (mode === "image") this.insert("art");
  }
  keyboard(event: KeyboardEvent) {
    if (this.exportOpen || this.presentOpen) return;
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
      event.shiftKey ? this.doc.redo() : this.doc.undo();
      return;
    }
    if (command && key === "d") {
      event.preventDefault();
      this.doc.duplicate();
      return;
    }
    if (command && key === "a") {
      event.preventDefault();
      const visible = visibleLayers(this.doc.layers),
        locked = lockedLayers(this.doc.layers);
      this.doc.select(
        this.doc.layers
          .filter((layer) => visible.has(layer.id) && !locked.has(layer.id))
          .map((layer) => layer.id),
      );
      return;
    }
    if (command || event.altKey) return;
    if (key === "escape") {
      this.doc.clearSelection();
      this.doc.setTool("select");
      return;
    }
    if (key === "delete" || key === "backspace") {
      if (this.doc.selection.length) {
        event.preventDefault();
        this.doc.remove();
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
      this.tool(modes[key]);
      return;
    }
    if (
      key.startsWith("arrow") &&
      this.doc.selection.length &&
      !(event.target as HTMLElement).closest(
        'button,md-icon-button,md-toolbar,[role="treeitem"]',
      )
    ) {
      event.preventDefault();
      const step = event.shiftKey ? 5 : 1;
      this.doc.commitLayers("move", (layers) => {
        const locked = lockedLayers(layers),
          ids = new Set(this.doc.selection);
        this.doc.selection.forEach((id) =>
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
  }
}
