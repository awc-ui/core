import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  Directive,
  Input,
  inject,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import {
  getFiles,
  getProjects,
  getTotals,
  projectSlug,
  getAssets,
  getViewer,
  recentFiles,
  sharedFiles,
  fileById,
  projectBySlug,
  filesInProject,
  assetById,
  assetUsage,
  editIcon,
  type Layer,
  type DesignFile,
  type Asset,
} from "@awc-ui/showcase-kit/design";
import {
  TEMPLATES,
  pictorSearchText,
  ORB_ART,
  makeTemplate,
  createLayer,
  layerFromAsset,
  LIVE_COMPONENTS,
  colorOf,
} from "@awc-ui/pictor-model";
import { StudioService } from "./lib/studio.service";
import { CONTROLS } from "./controls";
@Directive()
export class ViewBase {
  studio = inject(StudioService);
  get doc() {
    return this.studio.doc;
  }
  get t() {
    return this.studio.t;
  }
  route = this.studio.route;
  projects = getProjects();
  projectSlug = projectSlug;
  colorOf = colorOf;
}
@Component({
  selector: "pictor-file-card",
  standalone: true,
  imports: [RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<md-card class="pictor-file-card" variant="outlined"
    ><a
      [routerLink]="route.file(file.id)"
      class="pictor-file-preview"
      [attr.aria-label]="studio.t('Open {name}', { name: file.name })"
      ><img
        [src]="studio.preview(file.id)"
        [alt]="studio.t('{name} canvas preview', { name: file.name })"
        loading="lazy"
      /><span class="pictor-open-label"
        ><span class="material-symbols-outlined" aria-hidden="true"
          >open_in_new</span
        >
        {{ studio.t("Open canvas") }}</span
      ></a
    >
    <div class="pictor-file-meta">
      <a [routerLink]="route.file(file.id)"
        ><strong>{{ file.name }}</strong
        ><span
          >{{ projectName }} ·
          {{
            studio.t("{count} layers", {
              count: studio.t.formatNumber(doc.layersForFile(file.id).length),
            })
          }}</span
        ></a
      ><ng-content />
    </div>
    <div class="pictor-file-footer">
      <md-chip [label]="t(file.stateKey)" /><span
        ><span class="material-symbols-outlined" aria-hidden="true">group</span
        >{{ file.editorHandles.length }}</span
      >
    </div></md-card
  >`,
})
export class FileCardComponent extends ViewBase {
  @Input({ required: true }) file!: DesignFile;
  get projectName() {
    return this.projects.find((p) => p.id === this.file.projectId)?.name;
  }
}
@Component({
  selector: "pictor-home",
  standalone: true,
  imports: [...CONTROLS, RouterLink, FileCardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./home.html",
})
export class HomeComponent extends ViewBase {
  query = "";
  filter = "all";
  sort = "recent";
  view = "grid";
  template: string | null = null;
  totals = getTotals();
  templates = TEMPLATES;
  orb = ORB_ART;
  favorites: string[] = this.readFavorites();
  layoutOptions = [
    { value: "grid", label: "Grid", icon: "grid_view" },
    { value: "list", label: "List", icon: "view_list" },
  ];
  filterOptions = [
    { value: "all", label: "All files" },
    { value: "favorites", label: "Starred", icon: "star" },
    { value: "shared", label: "Shared", icon: "group" },
  ];
  sortOptions = [
    { value: "recent", label: "Recently edited" },
    { value: "name", label: "Name" },
    { value: "layers", label: "Most layers" },
  ];
  projectIcons = [
    "shapes",
    "photo_camera",
    "auto_awesome",
    "view_quilt",
    "palette",
    "architecture",
  ];
  get files() {
    return getFiles()
      .filter(
        (f) =>
          (!this.query ||
            pictorSearchText(
              f.name +
                " " +
                (this.projects.find((p) => p.id === f.projectId)?.name ?? ""),
            ).includes(pictorSearchText(this.query))) &&
          (this.filter === "all" ||
            (this.filter === "favorites" && this.favorites.includes(f.id)) ||
            (this.filter === "shared" && f.editorHandles.length > 1)),
      )
      .slice()
      .sort((a, b) =>
        this.sort === "name"
          ? a.name.localeCompare(b.name)
          : this.sort === "layers"
            ? this.doc.layersForFile(b.id).length -
              this.doc.layersForFile(a.id).length
            : b.updatedAt.localeCompare(a.updatedAt),
      );
  }
  private templatesById = new Map<string, ReturnType<typeof makeTemplate>>(
    TEMPLATES.map((template) => [template.id, makeTemplate(template.id)]),
  );
  get selectedTemplate() {
    return this.template
      ? (this.templatesById.get(this.template) ?? null)
      : null;
  }
  readFavorites() {
    try {
      const value = JSON.parse(
        localStorage.getItem("pictor:favorites") ?? "[]",
      );
      return Array.isArray(value)
        ? value.filter((item) => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  }
  favorite(id: string) {
    this.favorites = this.favorites.includes(id)
      ? this.favorites.filter((x) => x !== id)
      : [...this.favorites, id];
    try {
      localStorage.setItem("pictor:favorites", JSON.stringify(this.favorites));
    } catch {}
  }
  applyTemplate() {
    const template = this.selectedTemplate;
    if (template) {
      this.doc.replaceCanvas(template.layers);
      this.template = null;
      this.studio.go(this.route.editor());
    }
  }
  scrollTemplates() {
    document
      .getElementById("pictor-templates")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  reset() {
    this.query = "";
    this.filter = "all";
  }
}
@Component({
  selector: "pictor-library",
  standalone: true,
  imports: [...CONTROLS, RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./library.html",
})
export class LibraryComponent extends ViewBase {
  query = "";
  kind = "all";
  limit = 24;
  components = LIVE_COMPONENTS;
  kinds = [
    { value: "all", label: "All assets" },
    { value: "image", label: "Images" },
    { value: "color", label: "Colors" },
    { value: "text-style", label: "Typography" },
    { value: "component", label: "Components" },
  ];
  get assets() {
    return getAssets().filter(
      (asset) =>
        (this.kind === "all" || asset.kind === this.kind) &&
        pictorSearchText(asset.name).includes(pictorSearchText(this.query)),
    );
  }
  insert(layer: Layer) {
    this.doc.commitLayers("create", (layers) => [...layers, layer], [layer.id]);
    this.doc.setTool("select");
    this.studio.go(this.route.editor());
  }
  component(item: (typeof LIVE_COMPONENTS)[number]) {
    this.insert(
      createLayer(
        "component",
        { x: 16, y: 10, w: 17, h: item.id === "awc:card" ? 14 : 5 },
        { name: item.name, componentId: item.id, fill: "#BEE7AA" },
      ),
    );
  }
  asset(asset: Asset) {
    this.insert(layerFromAsset(asset));
  }
}
@Component({
  selector: "pictor-project",
  standalone: true,
  imports: [...CONTROLS, RouterLink, FileCardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `@if (project) {
      <pictor-screen
        [title]="project.name"
        [subtitle]="studio.t('A shared space for your most interesting ideas.')"
        ><md-button
          aside
          variant="tonal"
          icon="arrow_outward"
          (click)="studio.go(route.editor())"
          >{{ studio.t("Enter the studio") }}</md-button
        >
        <div class="pictor-project-banner">
          <div>
            <span class="pictor-eyebrow">{{
              studio.t("A SPACE TO CREATE")
            }}</span>
            <h2>{{ project.name }}</h2>
            <p>{{ t(project.descriptionKey) }}</p>
            <span>{{
              studio.t("{count} design files · Built to be explored", {
                count: studio.t.formatNumber(project.fileIds.length),
              })
            }}</span>
          </div>
          <img [src]="orb.src" alt="" />
        </div>
        <section class="pictor-section">
          <div class="pictor-section__head">
            <h2>{{ studio.t("The work in progress") }}</h2>
            <pictor-text
              [live]="true"
              [label]="studio.t('Search this project')"
              [value]="query"
              (changed)="query = $event"
            />
          </div>
          <div class="pictor-file-grid">
            @for (file of files; track file.id) {
              <pictor-file-card [file]="file" />
            }
          </div>
          @if (!files.length) {
            <div class="pictor-empty">
              <span class="material-symbols-outlined" aria-hidden="true"
                >search_off</span
              >
              <h3>{{ studio.t("No files found") }}</h3>
              <p>{{ studio.t("Try another search.") }}</p>
            </div>
          }
        </section></pictor-screen
      >
    } @else {
      <pictor-screen
        [title]="studio.t('Project not found')"
        [subtitle]="studio.t('Choose another creative space.')"
        ><md-button variant="filled" (click)="studio.go('/')">{{
          studio.t("Back to projects")
        }}</md-button></pictor-screen
      >
    }`,
})
export class ProjectComponent extends ViewBase {
  @Input() slug = "";
  query = "";
  orb = ORB_ART;
  get project() {
    return projectBySlug(this.slug);
  }
  get files() {
    return this.project
      ? filesInProject(this.project.id).filter((file) =>
          pictorSearchText(file.name).includes(pictorSearchText(this.query)),
        )
      : [];
  }
}
@Component({
  selector: "pictor-asset",
  standalone: true,
  imports: [...CONTROLS, RouterLink, FileCardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./asset.html",
})
export class AssetComponent extends ViewBase {
  @Input() assetId = "";
  get asset() {
    return assetById(this.assetId);
  }
  get usage() {
    return this.asset ? assetUsage(this.asset) : [];
  }
  insert() {
    if (!this.asset) return;
    const layer = layerFromAsset(this.asset);
    this.doc.commitLayers("create", (layers) => [...layers, layer], [layer.id]);
    this.doc.setTool("select");
    this.studio.go(this.route.editor());
  }
}
@Component({
  selector: "pictor-profile",
  standalone: true,
  imports: [...CONTROLS, RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./profile.html",
})
export class ProfileComponent extends ViewBase {
  viewer = getViewer();
  totals = getTotals();
  view = "recent";
  query = "";
  editIcon = editIcon;
  views = [
    { value: "recent", label: "Recent" },
    { value: "shared", label: "With others" },
  ];
  get current() {
    return fileById(this.doc.fileId);
  }
  get files() {
    return (this.view === "shared" ? sharedFiles() : recentFiles(12))
      .filter((f) =>
        pictorSearchText(f.name).includes(pictorSearchText(this.query)),
      )
      .slice(0, 8);
  }
  get entries() {
    return this.doc.history.entries
      .slice(0, this.doc.history.index)
      .slice(-4)
      .reverse();
  }
  get metrics() {
    return [
      { label: "Projects", value: this.totals.projects, icon: "folder_open" },
      { label: "Design files", value: this.totals.files, icon: "draft" },
      {
        label: "Layers",
        value: getFiles().reduce(
          (n, f) => n + this.doc.layersForFile(f.id).length,
          0,
        ),
        icon: "layers",
      },
      {
        label: "Components",
        value: this.totals.components,
        icon: "deployed_code",
      },
      { label: "Assets", value: this.totals.assets, icon: "interests" },
    ];
  }
  entryName(entry: (typeof this.doc.history.entries)[number]) {
    return (
      entry.after[0]?.name ?? entry.before[0]?.name ?? this.studio.t("Canvas")
    );
  }
  projectName(id: string) {
    return this.projects.find((p) => p.id === id)?.name;
  }
  save() {
    if (this.doc.saveStatus === "unavailable")
      this.studio.editorAction("pictor:export");
    else this.doc.save();
  }
}
@Component({
  selector: "pictor-not-found",
  standalone: true,
  imports: CONTROLS,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<pictor-screen
    [title]="studio.t('This page isn\\'t here')"
    [subtitle]="studio.t('Let\\'s get you back to your creative workspace.')"
    ><div class="pictor-empty">
      <span class="material-symbols-outlined" aria-hidden="true"
        >search_off</span
      >
      <h3>{{ studio.t("A different direction?") }}</h3>
      <md-button variant="filled" icon="home" (click)="studio.go('/')">{{
        studio.t("Back to projects")
      }}</md-button>
    </div></pictor-screen
  >`,
})
export class NotFoundComponent extends ViewBase {}
