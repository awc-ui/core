import { Injectable } from '@angular/core';
import { DefaultUrlSerializer, type UrlTree } from '@angular/router';
import { route } from '@awc-ui/showcase-kit/design';

/** Angular client routing must not receive a terminal empty path segment.
 * Keep the kit's directory URLs at the static hosting boundary and preserve
 * query/fragment state when adapting them to the Angular router. */
export function normalizeRoute(url: string): string {
  const boundary = url.search(/[?#]/);
  const path = boundary < 0 ? url : url.slice(0, boundary);
  const suffix = boundary < 0 ? '' : url.slice(boundary);
  return (path.replace(/\/+$/, '') || '/') + suffix;
}

export const angularRoutes = {
  projects: () => normalizeRoute(route.projects()),
  editor: () => normalizeRoute(route.editor()),
  assets: () => normalizeRoute(route.assets()),
  profile: () => normalizeRoute(route.profile()),
  project: (slug: string) => normalizeRoute(route.project(slug)),
  file: (id: string) => normalizeRoute(route.file(id)),
  asset: (id: string) => normalizeRoute(route.asset(id)),
};

@Injectable()
export class PictorUrlSerializer extends DefaultUrlSerializer {
  override parse(url: string): UrlTree {
    return super.parse(normalizeRoute(url));
  }
}
