/**
 * `/sectors/[sector]/` — one screen per sector, rendered on demand.
 *
 * WHAT REPLACED `generateStaticParams` + `dynamicParams = false`
 *
 * The export enumerated the seven sectors from the fixture at build time and
 * let Next turn anything outside that list into a 404. There is no build-time
 * enumeration any more — the route is rendered per request — but the SECOND
 * half of that contract still has to hold, or `/sectors/banana/` would quietly
 * render a sector screen with nothing in it. So the same selector that fed
 * `generateStaticParams` now guards the render: unknown id, `notFound()`.
 *
 * Same source of truth, same behaviour, decided per request instead of per
 * build — add a sector to the kit and it is reachable with no second edit here,
 * exactly as before.
 */

export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getSectorById } from '@awc-ui/showcase-kit/data';
import { SectorScreen } from '@/components/screens/SectorScreen';

export default function Page({ params }: { params: { sector: string } }) {
  if (!getSectorById(params.sector)) notFound();
  return <SectorScreen sectorId={params.sector} />;
}
