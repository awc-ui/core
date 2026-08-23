/** `/facilities/[id]/` — 61 pages, one per committed line. */
import { getFacilities } from '@awc-ui/showcase-kit/data';

export const entries = () => getFacilities().map((facility) => ({ id: facility.id }));

export const load = ({ params }) => ({ facilityId: params.id });
