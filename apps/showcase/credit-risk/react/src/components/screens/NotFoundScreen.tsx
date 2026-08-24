/**
 * No such screen.
 *
 * Reached only by a path that matches none of the six patterns — a typo, or a
 * link into a route this vertical does not have. An unknown *id* on a route
 * that does exist (`/sectors/banana/`) never gets here: those three screens
 * look the id up themselves and render their own empty state, which keeps the
 * breadcrumb trail and the section nav in place.
 *
 * It reuses `Screen`, so the masthead, the nav and the dock are all still
 * there and the reader can leave without the back button. Not one string is
 * written here either — `empty.generic` and `empty.hint` already exist in the
 * kit's dictionary in all three locales, and this build must not need a key
 * the other six do not have.
 */

import { useT } from '@/lib/showcase';
import { route } from '@/lib/routes';
import { Drill, Panel, Screen } from '../Shell';

export function NotFoundScreen() {
  const t = useT();
  return (
    <Screen title={t('empty.generic')} subtitle={t('empty.hint')}>
      <Panel>
        <p className="muted">{t('empty.generic')}</p>
        <Drill href={route.overview()}>{t('nav.overview')}</Drill>
      </Panel>
    </Screen>
  );
}
