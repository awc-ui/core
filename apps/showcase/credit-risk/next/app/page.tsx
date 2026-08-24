/**
 * `/` — portfolio overview.
 *
 * Every page in this app is a thin Server Component wrapping one client screen.
 * The split is deliberate: route config and metadata are server concerns, while
 * the screens have to re-render when the dock changes the locale, which only a
 * client component can do. The fixture selectors are pure and synchronous, so
 * the screen renders completely during the server pass — the HTML that leaves
 * the server carries real rows and real numbers, not a loading state.
 *
 * `force-dynamic` is what makes this a RUNTIME render. Without it Next sees a
 * page with no request-dependent input, prerenders it once during `next build`
 * and marks it `○ (Static)` — the static export in all but name. With it the
 * route reports `ƒ (Dynamic) server-rendered on demand` and the tree is rebuilt
 * per request.
 */

export const dynamic = 'force-dynamic';

import { OverviewScreen } from '@/components/screens/OverviewScreen';

export default function Page() {
  return <OverviewScreen />;
}
