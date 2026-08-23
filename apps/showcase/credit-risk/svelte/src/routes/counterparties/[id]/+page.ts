/** `/counterparties/[id]/` — 24 pages, one per obligor. */
import { getCounterparties } from '@awc-ui/showcase-kit/data';

export const entries = () => getCounterparties().map((cp) => ({ id: cp.id }));

export const load = ({ params }) => ({ counterpartyId: params.id });
