/**
 * The third column: birthdays, this week's events, and contacts.
 *
 * IT IS ASIDE CONTENT AND IT SAYS SO. Not part of the feed's reading order, and
 * `app.css` drops it entirely below 1200px rather than stacking it above the
 * feed — a reader who opened the app came for the posts, and 300px of contacts
 * above them on a laptop is 300px in the way.
 *
 * THERE IS NO PRESENCE AND NO "ACTIVE NOW" DOT. Every product of this shape has
 * one and it would be the single dishonest thing in this showcase: nobody is
 * online, there is no socket, and a green dot that is always on says something
 * false about a person. The block is a contact list and is labelled as one.
 */

import { rightRail } from '@awc-ui/showcase-kit/community';
import { Link } from '@/lib/router';
import { route } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { Panel } from '@/components/Shell';
import { Avatar } from '@/components/bits';
import { EventRailRow } from './EventsScreen';

export function RightRail() {
  const t = useT();
  const { birthdays, events, contacts } = rightRail();

  return (
    <>
      {birthdays.length > 0 ? (
        <Panel title={t('community.panel.birthdays')}>
          <div className="rail-block">
            {birthdays.map((person) => (
              <Link key={person.id} className="rail-row" href={route.person(person.handle)}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  cake
                </span>
                <span className="rail-row__text">
                  <span className="rail-row__name">{person.displayName}</span>
                </span>
              </Link>
            ))}
            <span className="rail-row__meta">{t('community.hint.birthdayToday')}</span>
          </div>
        </Panel>
      ) : null}

      {events.length > 0 ? (
        <Panel title={t('community.panel.upcoming')}>
          <div className="rail-block">
            {/* The same row the group page's rail uses. It was written twice
                and the two had already begun to differ. */}
            {events.map((event) => (
              <EventRailRow key={event.id} event={event} />
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title={t('community.panel.contacts')}>
        <div className="rail-block">
          {contacts.map((person) => (
            <Link key={person.id} className="rail-row" href={route.person(person.handle)}>
              <Avatar person={person} size="small" />
              <span className="rail-row__text">
                <span className="rail-row__name">{person.displayName}</span>
              </span>
            </Link>
          ))}
        </div>
      </Panel>
    </>
  );
}
