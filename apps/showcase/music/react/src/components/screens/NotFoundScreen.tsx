/**
 * The screen for an address nothing answers to.
 *
 * ONE COMPONENT, USED FIVE TIMES. The router renders it for a path that matches
 * nothing, and each of the four drill screens renders it when the id in its own
 * URL does not resolve — a component handed a plain string from a URL must not
 * trust its caller. Written per screen, as it first was here, four of the five
 * were a bare message with NO WAY BACK: a dead end with no control is the one
 * thing worse than a 404, and it was invisible because each guard looked
 * perfectly reasonable on its own.
 */

import { Screen } from '@/components/Shell';
import { EmptyState } from '@/components/screens/EmptyState';
import { useRouter } from '@/lib/router';
import { route } from '@/lib/routes';
import { useT } from '@/lib/showcase';

export function NotFoundScreen() {
  const t = useT();
  const { push } = useRouter();

  return (
    <Screen title={t('music.screen.notFound.title')} subtitle={t('music.screen.notFound.subtitle')}>
      <EmptyState message={t('music.screen.notFound.subtitle')} />
      <div className="row">
        <md-button
          class="notfound__home"
          variant="filled"
          icon="home"
          onClick={() => push(route.home())}
        >
          {t('music.nav.home')}
        </md-button>
      </div>
    </Screen>
  );
}
