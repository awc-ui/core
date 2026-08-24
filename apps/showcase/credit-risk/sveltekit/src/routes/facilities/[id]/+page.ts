/**
 * `/facilities/[id]/` — one screen per committed line, 61 of them in the
 * fixture, none of them written ahead of time. See `sectors/[sector]/+page.ts`
 * for why the `entries()` list went and the 404 guard arrived in its place.
 */
import { error } from '@sveltejs/kit';
import { getFacilityById } from '@awc-ui/showcase-kit/data';

export const load = ({ params }) => {
  if (!getFacilityById(params.id)) throw error(404, `No such facility: ${params.id}`);
  return { facilityId: params.id };
};
