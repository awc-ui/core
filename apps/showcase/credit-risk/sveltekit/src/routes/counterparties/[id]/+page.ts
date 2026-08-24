/**
 * `/counterparties/[id]/` — one screen per obligor, 24 of them in the fixture,
 * none of them written ahead of time. See `sectors/[sector]/+page.ts` for why
 * the `entries()` list went and the 404 guard arrived in its place.
 */
import { error } from '@sveltejs/kit';
import { getCounterpartyById } from '@awc-ui/showcase-kit/data';

export const load = ({ params }) => {
  if (!getCounterpartyById(params.id)) throw error(404, `No such counterparty: ${params.id}`);
  return { counterpartyId: params.id };
};
