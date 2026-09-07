import { Injectable, NgZone, OnDestroy, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { DomSanitizer, type SafeUrl } from "@angular/platform-browser";
import {
  createDocumentStore,
  documentSvg,
  pictorText,
  type DocumentApi,
} from "@awc-ui/pictor-model";
import { createRoutes } from "@awc-ui/showcase-kit/design";
import { ShowcaseService, type T } from "./showcase.service";
import { angularRoutes, normalizeRoute } from "./angular-routes";
export const BASE = createRoutes("angular").basePath;
@Injectable({ providedIn: "root" })
export class StudioService implements OnDestroy {
  private zone = inject(NgZone);
  readonly router = inject(Router);
  readonly showcase = inject(ShowcaseService);
  private sanitizer = inject(DomSanitizer);
  private store = createDocumentStore();
  readonly snapshot = signal<DocumentApi>(this.store.getSnapshot());
  private unsubscribe = this.store.subscribe(() =>
    this.zone.run(() => this.snapshot.set(this.store.getSnapshot())),
  );
  readonly route = angularRoutes;
  get doc() {
    return this.snapshot();
  }
  private sourceTranslator?: T;
  private studioTranslator?: T;
  get t(): T {
    const source = this.showcase.t;
    if (source !== this.sourceTranslator) {
      this.sourceTranslator = source;
      const translate = ((message, params) =>
        message.startsWith("design.")
          ? source(message, params)
          : pictorText(source.locale, message, params)) as T;
      this.studioTranslator = Object.assign(translate, source);
    }
    return this.studioTranslator!;
  }
  go(path: string) {
    void this.router.navigateByUrl(normalizeRoute(path));
  }
  private svgCache = new Map<string, SafeUrl>();
  private safeSvg(markup: string) {
    let value = this.svgCache.get(markup);
    if (!value) {
      value = this.sanitizer.bypassSecurityTrustUrl(
        `data:image/svg+xml,${encodeURIComponent(markup)}`,
      );
      if (this.svgCache.size > 80) this.svgCache.clear();
      this.svgCache.set(markup, value);
    }
    return value;
  }
  preview(id: string) {
    return this.safeSvg(documentSvg(this.doc.layersForFile(id), this.t));
  }
  svg(layers: Parameters<typeof documentSvg>[0], background = false) {
    return this.safeSvg(documentSvg(layers, this.t, { background }));
  }
  emit(name: string) {
    window.dispatchEvent(new Event(name));
  }
  editorAction(name: string) {
    void this.router
      .navigateByUrl(this.route.editor())
      .then(() => this.emit(name));
  }
  ngOnDestroy() {
    this.unsubscribe();
    this.store.dispose();
  }
}
