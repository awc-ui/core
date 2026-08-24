/** `/facilities/[id]/` — 61 pages, one per committed line. */

import { getFacilities } from '@awc-ui/showcase-kit/data';
import { FacilityScreen } from '@/components/screens/FacilityScreen';

export const dynamicParams = false;

export function generateStaticParams() {
  return getFacilities().map((facility) => ({ id: facility.id }));
}

export default function Page({ params }: { params: { id: string } }) {
  return <FacilityScreen facilityId={params.id} />;
}
