/*
 * /components/<slug>/readme.md
 *
 * Serves each component's own readme.md verbatim.
 *
 * WHY THIS EXISTS
 *
 * The prose on a component's docs page was hand-authored FROM its readme, so
 * the two are copies that drift apart the moment either is edited — and they
 * had. This route makes the readme itself reachable from the site, so the
 * canonical text is always one click away and is the file, not a transcription
 * of it.
 *
 * Same ?raw idiom as /llm/awc-ui.main-llm.md: import
 * the source at build time so there is exactly one copy and no sync step. The
 * glob is eager because getStaticPaths has to enumerate every component before
 * the build emits routes.
 *
 * Slug is the tag minus its `md-` prefix (md-table-cell -> table-cell), which
 * is the same mapping the docs pages and generate-docs.mjs already use.
 */

import type { APIRoute, GetStaticPaths } from "astro";

// @ts-ignore — Vite resolves ?raw at build time.
const readmes = import.meta.glob("../../../../../../packages/core/src/components/*/readme.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** `.../components/md-table-cell/readme.md` -> `table-cell` */
function slugFromPath(path: string): string {
  const dir = path.split("/").slice(-2, -1)[0] ?? "";
  return dir.replace(/^md-/, "");
}

export const getStaticPaths: GetStaticPaths = () =>
  Object.entries(readmes).map(([path, source]) => ({
    params: { slug: slugFromPath(path) },
    props: { source },
  }));

export const GET: APIRoute = ({ props }) =>
  new Response((props as { source: string }).source, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
