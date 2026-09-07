/**
 * Reads over the fixture — the only way a screen gets data.
 *
 * Every function here takes the fixture as its implicit source and returns
 * plain values. Nothing mutates, nothing caches, and nothing reaches back into
 * `generated.ts` from outside this file: a screen that imports FIXTURE has
 * bypassed every one of these and will be the first thing to break when the
 * fixture's shape moves.
 */

import { FIXTURE } from './generated';
import { LIST_PAGE, type Asset, type ComponentDef, type DesignFile, type DesignTotals, type Layer, type Project, type Viewer } from './types';
import { zOrder } from './derive';

/* ---------------------------------------------------------------- the whole */

export const getViewer = (): Viewer => FIXTURE.viewer;
export const getTotals = (): DesignTotals => FIXTURE.totals;
export const getProjects = (): readonly Project[] => FIXTURE.projects;
export const getFiles = (): readonly DesignFile[] => FIXTURE.files;
export const getAssets = (): readonly Asset[] => FIXTURE.assets;
export const getComponents = (): readonly ComponentDef[] => FIXTURE.components;

/* ------------------------------------------------------------------- slugs */

/**
 * A NAME BECOMES A SLUG THE SAME WAY EVERYWHERE.
 *
 * Written once because the route table and the screen that generates the link
 * must agree exactly: a project addressed as `meridian-rebrand` and linked as
 * `Meridian-Rebrand` is a 404 that only shows up when someone clicks it.
 */
export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const projectSlug = (project: Project): string => slugify(project.name);

export function projectBySlug(slug: string): Project | null {
  return FIXTURE.projects.find((p) => projectSlug(p) === slug) ?? null;
}

export const projectById = (id: string): Project | null => FIXTURE.projects.find((p) => p.id === id) ?? null;
export const fileById = (id: string): DesignFile | null => FIXTURE.files.find((f) => f.id === id) ?? null;
export const assetById = (id: string): Asset | null => FIXTURE.assets.find((a) => a.id === id) ?? null;
export const componentById = (id: string): ComponentDef | null =>
  FIXTURE.components.find((c) => c.id === id) ?? null;

/* ------------------------------------------------------------------ files */

export function filesInProject(projectId: string): readonly DesignFile[] {
  return FIXTURE.files.filter((f) => f.projectId === projectId);
}

/**
 * THE FILE THE EDITOR OPENS WHEN NOTHING SAYS OTHERWISE.
 *
 * The most recently edited one, so `/editor/` is never an empty screen and the
 * choice is defensible rather than arbitrary. Every build calls this, so all
 * five open the same document and parity can compare them.
 */
export function defaultFile(): DesignFile {
  return FIXTURE.files.reduce((latest, f) => (f.updatedAt > latest.updatedAt ? f : latest), FIXTURE.files[0]);
}

/** Most recently edited first — what the Projects screen lists. */
export function recentFiles(limit = LIST_PAGE): readonly DesignFile[] {
  return FIXTURE.files.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

/** Files someone else is also on. Drives the "shared with you" shelf. */
export function sharedFiles(): readonly DesignFile[] {
  return FIXTURE.files.filter((f) => f.editorHandles.length > 1);
}

/* ----------------------------------------------------------------- layers */

/**
 * A FILE'S LAYERS IN PAINT ORDER. The canvas wants this; the layer panel wants
 * it reversed and says so at the call site, because "reversed" is the kind of
 * thing that reads as a bug unless it is written down.
 */
export function paintOrder(file: DesignFile): readonly Layer[] {
  return zOrder(file.layers);
}

/** Every layer across every file — for the totals and the invariant checks. */
export function allLayers(): readonly Layer[] {
  return FIXTURE.files.flatMap((f) => f.layers);
}

/** Which files an asset appears in, resolved from ids to records. */
export function assetUsage(asset: Asset): readonly DesignFile[] {
  return asset.usedByFileIds.map((id) => fileById(id)).filter((f): f is DesignFile => f !== null);
}

/** Instances of a component, with the file each lives in. */
export function componentUsage(component: ComponentDef): readonly { file: DesignFile; layer: Layer }[] {
  const out: { file: DesignFile; layer: Layer }[] = [];
  for (const file of FIXTURE.files) {
    for (const layer of file.layers) {
      if (layer.kind === 'instance' && layer.componentId === component.id) out.push({ file, layer });
    }
  }
  return out;
}

/* ----------------------------------------------------------------- assets */

export function assetsOfKind(kind: Asset['kind']): readonly Asset[] {
  return FIXTURE.assets.filter((a) => a.kind === kind);
}

/* ------------------------------------------------------------------ people */

/**
 * A COLLABORATOR'S HANDLE IS ALL WE HAVE, and that is deliberate: the fixture
 * has one full person in it, the viewer. Inventing three more with names, faces
 * and bios to fill an avatar stack would be three more records to keep
 * consistent for a decoration nobody drills into.
 *
 * The initial comes from the handle, which is enough for an avatar and is
 * honest about what is known.
 */
export const handleInitial = (handle: string): string => handle.charAt(0).toUpperCase();
