/**
 * `/sectors/[sector]/` — one screen per sector, rendered when it is asked for.
 *
 * WHAT THE STATIC BUILD NEEDED AND THIS ONE DOES NOT. There used to be an
 * `entries()` export here listing every sector, because the prerenderer has to
 * be told which pages to write. Nothing is written ahead of time now, so the
 * list is gone — the fixture is enumerated in exactly one place again.
 *
 * WHAT IT NEEDS INSTEAD. A prerendered route only ever existed for a real
 * sector; a live route matches ANY segment, and `SectorScreen` reads
 * `getSectorById(...)` as a `Sector`. So the id is checked here and an unknown
 * one becomes a 404 — the same answer the static host gave by having no file,
 * rather than a 500 from a screen dereferencing `undefined`.
 *
 * The load stays UNIVERSAL rather than `+page.server.ts`: it only forwards a
 * param, and a universal load also runs in the browser, so drilling into a
 * sector costs no round trip while a cold request still renders on the server.
 */
import { error } from '@sveltejs/kit';
import { getSectorById } from '@awc-ui/showcase-kit/data';

export const load = ({ params }) => {
  if (!getSectorById(params.sector)) throw error(404, `No such sector: ${params.sector}`);
  return { sectorId: params.sector };
};
