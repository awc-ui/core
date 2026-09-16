/**
 * `/facilities/[id]/` — one screen per committed line (61 in the fixture),
 * rendered on demand. See `app/sectors/[sector]/page.tsx` for why the fixture
 * lookup moved from `generateStaticParams` into a `notFound()` guard.
 */

export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getFacilityById } from '@awc-ui/showcase-kit/data';
import { FacilityScreen } from '@/components/screens/FacilityScreen';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getFacilityById(id)) notFound();
  return <FacilityScreen facilityId={id} />;
}
