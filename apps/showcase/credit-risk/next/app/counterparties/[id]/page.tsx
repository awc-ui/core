/** `/counterparties/[id]/` — 24 pages, one per obligor. */

import { getCounterparties } from '@awc-ui/showcase-kit/data';
import { CounterpartyScreen } from '@/components/screens/CounterpartyScreen';

export const dynamicParams = false;

export function generateStaticParams() {
  return getCounterparties().map((counterparty) => ({ id: counterparty.id }));
}

export default function Page({ params }: { params: { id: string } }) {
  return <CounterpartyScreen counterpartyId={params.id} />;
}
