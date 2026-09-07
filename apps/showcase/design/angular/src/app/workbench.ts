import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnDestroy,
  inject,
} from "@angular/core";
import {
  fileById,
  getAssets,
  getFiles,
  getProjects,
  projectSlug,
} from "@awc-ui/showcase-kit/design";
import { scrollCommandIntoView, pictorSearchText } from "@awc-ui/pictor-model";
import { StudioService } from "./lib/studio.service";
import { CONTROLS } from "./controls";
interface Command {
  id: string;
  label: string;
  detail: string;
  search: string;
  icon: string;
  run(): void;
}
@Component({
  selector: "pictor-commands",
  standalone: true,
  imports: CONTROLS,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./commands.html",
})
export class CommandsComponent implements OnDestroy {
  studio = inject(StudioService);
  open = false;
  query = "";
  active = 0;
  message = "";
  private show = () => {
    this.query = "";
    this.active = 0;
    this.open = true;
  };
  private saveNow = () => this.save();
  private key = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing)
      return;
    const key = event.key.toLowerCase();
    if (key === "k") {
      event.preventDefault();
      this.open ? (this.open = false) : this.show();
    }
    if (key === "s") {
      event.preventDefault();
      this.save();
    }
  };
  constructor() {
    window.addEventListener("keydown", this.key);
    window.addEventListener("pictor:commands", this.show);
    window.addEventListener("pictor:save", this.saveNow);
  }
  ngOnDestroy() {
    window.removeEventListener("keydown", this.key);
    window.removeEventListener("pictor:commands", this.show);
    window.removeEventListener("pictor:save", this.saveNow);
  }
  save() {
    this.message = this.studio.doc.save()
      ? "Saved to this browser. Your files and history are here when you return."
      : "Browser storage is unavailable. Your work is still open; export a copy to keep it.";
  }
  get commands(): Command[] {
    const s = this.studio,
      r = s.route;
    return [
      {
        id: "editor",
        search: "Open canvas",
        label: s.t("Open canvas"),
        detail: fileById(s.doc.fileId)?.name ?? s.t("Continue designing"),
        icon: "draw",
        run: () => s.go(r.editor()),
      },
      {
        id: "projects",
        search: "Browse projects Your workspace",
        label: s.t("Browse projects"),
        detail: s.t("Your workspace"),
        icon: "folder_open",
        run: () => s.go(r.projects()),
      },
      {
        id: "assets",
        search: "Explore assets Images, colors and reusable components",
        label: s.t("Explore assets"),
        detail: s.t("Images, colors and reusable components"),
        icon: "grid_view",
        run: () => s.go(r.assets()),
      },
      {
        id: "save",
        search: "Save in this browser Keep your files, canvas and undo history",
        label: s.t("Save in this browser"),
        detail: s.t("Keep your files, canvas and undo history"),
        icon: "save",
        run: () => this.save(),
      },
      {
        id: "export",
        search: "Export your design Download an SVG or PNG",
        label: s.t("Export your design"),
        detail: s.t("Download an SVG or PNG"),
        icon: "download",
        run: () => s.editorAction("pictor:export"),
      },
      {
        id: "present",
        search: "Present canvas Explore your design without editor panels",
        label: s.t("Present canvas"),
        detail: s.t("Explore your design without editor panels"),
        icon: "play_arrow",
        run: () => s.editorAction("pictor:present"),
      },
      {
        id: "components",
        search:
          "Explore AWC components Inspect the real components powering this screen",
        label: s.t("Explore AWC components"),
        detail: s.t("Inspect the real components powering this screen"),
        icon: "widgets",
        run: () => s.emit("pictor:components"),
      },
      ...getFiles().map((f) => ({
        id: "file:" + f.id,
        search: "Design file",
        label: f.name,
        detail: s.t("Design file"),
        icon: "draft",
        run: () => {
          s.doc.openFile(f.id);
          s.go(r.file(f.id));
        },
      })),
      ...getProjects().map((p) => ({
        id: "project:" + p.id,
        search: "Project",
        label: p.name,
        detail: s.t("Project"),
        icon: "folder",
        run: () => s.go(r.project(projectSlug(p))),
      })),
      ...getAssets().map((a) => ({
        id: "asset:" + a.id,
        search: "Asset " + a.kind,
        label: a.name,
        detail: s.t("Asset · {kind}", { kind: s.t(a.kindKey) }),
        icon: "interests",
        run: () => s.go(r.asset(a.id)),
      })),
    ];
  }
  get results() {
    const q = pictorSearchText(this.query);
    return this.commands
      .filter((c) =>
        pictorSearchText(c.label + " " + c.detail + " " + c.search).includes(q),
      )
      .slice(0, 12);
  }
  get selected() {
    return Math.min(this.active, Math.max(0, this.results.length - 1));
  }
  choose(command?: Command) {
    if (command) {
      this.open = false;
      command.run();
    }
  }
  private revealSelected() {
    requestAnimationFrame(() => {
      if (this.open)
        scrollCommandIntoView(
          document.getElementById("pictor-command-results"),
          this.selected,
        );
    });
  }
  keyboard(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.active = Math.max(
        0,
        Math.min(this.results.length - 1, this.active + 1),
      );
      this.revealSelected();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.active = Math.max(0, this.active - 1);
      this.revealSelected();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      this.choose(this.results[this.selected]);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      this.open = false;
    }
  }
}
interface Entry {
  tag: string;
  count: number;
  markup: string;
}
@Component({
  selector: "pictor-lens",
  standalone: true,
  imports: CONTROLS,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./lens.html",
})
export class LensComponent implements OnDestroy {
  studio = inject(StudioService);
  open = false;
  entries: Entry[] = [];
  query = "";
  selected = "";
  copyStatus = "";
  install = "npm i @awc-ui/core";
  private reveal = () => {
    const entries = new Map<string, Entry>();
    for (const element of Array.from(document.querySelectorAll(".shell *"))) {
      if (
        !element.localName.startsWith("md-") ||
        !customElements.get(element.localName)
      )
        continue;
      const existing = entries.get(element.localName);
      if (existing) {
        existing.count++;
        continue;
      }
      const clone = element.cloneNode(true) as HTMLElement;
      for (const node of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
        for (const attribute of Array.from(node.attributes)) {
          if (
            /^(class|id|style|data-.+|s-.+|c-id|hydrated|_ng.+)$/.test(
              attribute.name,
            )
          )
            node.removeAttribute(attribute.name);
        }
      }
      entries.set(element.localName, {
        tag: element.localName,
        count: 1,
        markup: clone.outerHTML,
      });
    }
    this.entries = [...entries.values()].sort((a, b) =>
      a.tag.localeCompare(b.tag),
    );
    this.selected =
      this.entries.find((e) => e.tag === "md-button")?.tag ??
      this.entries[0]?.tag ??
      "";
    this.query = "";
    this.copyStatus = "";
    this.open = true;
  };
  constructor() {
    window.addEventListener("pictor:components", this.reveal);
  }
  ngOnDestroy() {
    window.removeEventListener("pictor:components", this.reveal);
  }
  get current() {
    return this.entries.find((e) => e.tag === this.selected);
  }
  get filtered() {
    const query = pictorSearchText(this.query);
    return this.entries.filter((entry) => {
      const words = entry.tag.replace(/^md-/, "").replace(/-/g, " ");
      const name = words.charAt(0).toUpperCase() + words.slice(1);
      return pictorSearchText(
        entry.tag + " " + name + " " + this.studio.t(name),
      ).includes(query);
    });
  }
  async copy() {
    if (!this.current) return;
    try {
      await navigator.clipboard.writeText(this.current.markup);
      this.copyStatus = "Markup copied";
    } catch {
      this.copyStatus = "Clipboard unavailable. Select and copy the preview.";
    }
  }
}
