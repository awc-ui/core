/**
 * `/counterparties/[id]/` — one screen per obligor (24 in the fixture),
 * rendered on demand. See `app/sectors/[sector]/page.tsx` for why the fixture
 * lookup moved from `generateStaticParams` into a `notFound()` guard.
 */

export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getCounterpartyById } from '@awc-ui/showcase-kit/data';
import { CounterpartyScreen } from '@/components/screens/CounterpartyScreen';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getCounterpartyById(id)) notFound();
  return <CounterpartyScreen counterpartyId={id} />;
}
