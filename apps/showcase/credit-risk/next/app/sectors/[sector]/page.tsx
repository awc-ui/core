/**
 * `/sectors/[sector]/` — one page per sector, all seven emitted at export time.
 *
 * `generateStaticParams` reads the fixture directly rather than a hard-coded
 * list, so adding a sector to the kit adds a page here without a second edit.
 * `dynamicParams = false` makes an unknown id a build-time 404 instead of a
 * silent attempt to render on demand, which a static export cannot do anyway.
 */

import { getSectors } from '@awc-ui/showcase-kit/data';
import { SectorScreen } from '@/components/screens/SectorScreen';

export const dynamicParams = false;

export function generateStaticParams() {
  return getSectors().map((sector) => ({ sector: sector.id }));
}

export default function Page({ params }: { params: { sector: string } }) {
  return <SectorScreen sectorId={params.sector} />;
}
