import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  HostListener,
  OnDestroy,
  AfterViewInit,
  inject,
} from "@angular/core";
import { RouterOutlet } from "@angular/router";
import {
  DESTINATIONS,
  getViewer,
  destinationIndex,
  FRAMEWORKS,
} from "@awc-ui/showcase-kit/design";
import { StudioService, BASE } from "./lib/studio.service";
import { CommandsComponent, LensComponent } from "./workbench";
@Component({
  selector: "awc-root",
  standalone: true,
  imports: [RouterOutlet, CommandsComponent, LensComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: "./app.html",
})
export class AppComponent implements AfterViewInit, OnDestroy {
  studio = inject(StudioService);
  private host = inject(ElementRef<HTMLElement>);
  destinations = DESTINATIONS;
  viewer = getViewer();
  expanded = false;
  compact = innerWidth <= 900;
  frameworks = FRAMEWORKS.join(",");
  get t() {
    return this.studio.t;
  }
  get doc() {
    return this.studio.doc;
  }
  get activeIndex() {
    return destinationIndex(this.studio.router.url.split("?")[0]);
  }
  get savedAt() {
    return this.doc.lastSavedAt
      ? new Date(this.doc.lastSavedAt).toLocaleString(this.t.locale)
      : this.t("Autosaves in this browser");
  }
  href(path: string) {
    return BASE + path;
  }
  @HostListener("window:resize") resize() {
    this.compact = innerWidth <= 900;
  }
  private navigate = (event: MouseEvent) => {
    const tab = event
      .composedPath()
      .find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement &&
          (node.localName === "md-navigation-rail-tab" ||
            node.localName === "md-navigation-tab"),
      );
    if (!tab) return;
    if (
      tab.localName === "md-navigation-rail-tab" &&
      (event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey)
    )
      return;
    const destination = DESTINATIONS.find(
      (d) => d.value === tab.dataset["value"],
    );
    if (destination) {
      event.preventDefault();
      this.studio.go(destination.path);
    }
  };
  ngAfterViewInit() {
    this.host.nativeElement.addEventListener("click", this.navigate, true);
  }
  ngOnDestroy() {
    this.host.nativeElement.removeEventListener("click", this.navigate, true);
  }
}
