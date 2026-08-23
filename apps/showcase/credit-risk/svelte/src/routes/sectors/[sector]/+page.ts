/**
 * `/sectors/[sector]/` — one page per sector, all seven emitted at build time.
 *
 * `entries` reads the fixture directly rather than a hard-coded list, so adding
 * a sector to the kit adds a page here without a second edit. SvelteKit would
 * also find these by crawling the links on the overview, but declaring them
 * means a sector with no inbound link still gets a page — and means the build
 * fails loudly rather than silently emitting 94 routes instead of 95.
 */
import { getSectors } from '@awc-ui/showcase-kit/data';

export const entries = () => getSectors().map((sector) => ({ sector: sector.id }));

export const load = ({ params }) => ({ sectorId: params.sector });
