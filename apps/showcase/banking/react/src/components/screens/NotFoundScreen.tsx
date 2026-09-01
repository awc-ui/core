/**
 * Nothing is served at this address.
 *
 * Reachable in a client-routed app in a way it is not in a static export: any
 * path under the mount lands here rather than 404ing at the host, so it has to
 * offer a way back rather than being a dead end. The rail and the bar are still
 * rendered by `Screen`, so every destination is one click away — the button is
 * for the reader who is looking for one.
 */

import { useT } from '@/lib/showcase';
import { route, withBase } from '@/lib/routes';
import { EmptyState, Screen } from '../Shell';

export function NotFoundScreen() {
  const t = useT();
  return (
    <Screen
      title={t('banking.screen.notFound.title')}
      subtitle={t('banking.screen.notFound.body')}
      aside={
        // `href` on the component, never a component inside an `<a>` (§7.3).
        <md-button variant="tonal" size="sm" icon="account_balance_wallet" href={withBase(route.home())}>
          {t('banking.nav.home')}
        </md-button>
      }
    >
      <EmptyState message={t('banking.screen.notFound.body')} />
    </Screen>
  );
}
