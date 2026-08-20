/*
 * /llm/awc-ui.main-llm.md
 *
 * Serves the hand-written build director from the repo root (main-llm.md).
 *
 * main-llm.md is the single canonical entry point: hand-written, it interviews the
 * reader about scope, density, RTL and translations, then routes to components
 * via its decision matrix. It absorbed the generated llm-main-llm.md, which was
 * retired along with its generator.
 *
 * The docs referenced main-llm.md by name ("read main-llm.md at the repo root")
 * without ever serving it, so a reader outside the repository had no way to
 * fetch the thing they were being told to use. Same ?raw idiom as its
 * siblings: one source of truth, no public/ duplication, no drift.
 */

import type { APIRoute } from "astro";

// @ts-ignore — Vite resolves ?raw at build time.
import mainLlmRaw from "../../../../../main-llm.md?raw";

export const GET: APIRoute = () => {
  return new Response(mainLlmRaw, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
