/**
 * `/` — portfolio overview.
 *
 * Every page in this app is a thin Server Component wrapping one client screen.
 * The split is deliberate: `generateStaticParams` and route metadata are server
 * concerns, while the screens have to re-render when the dock changes the locale,
 * which only a client component can do. The fixture selectors are pure and
 * synchronous, so the screen still renders completely during the export — the
 * static HTML carries real rows and real numbers, not a loading state.
 */

import { OverviewScreen } from '@/components/screens/OverviewScreen';

export default function Page() {
  return <OverviewScreen />;
}
