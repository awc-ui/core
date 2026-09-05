/**
 * One group: its cover, what it is for, its feed, its events and who posts in
 * it.
 *
 * A PRIVATE GROUP THE VIEWER IS NOT IN SHOWS ITS ABOUT AND NOTHING ELSE, which
 * is the whole reason `GroupPrivacy` exists as data rather than as a chip. The
 * posts are withheld and the screen SAYS they are withheld — an empty feed with
 * no explanation reads as a dead group, and a private group that showed its
 * posts anyway would make the flag a decoration.
 */

import { getGroupBySlug, groupSummary, joinAction } from '@awc-ui/showcase-kit/community';
import { Link } from '@/lib/router';
import { route } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { useEngagement } from '@/lib/engagement';
import { EmptyState, Panel, Screen } from '@/components/Shell';
import { CoverSkeleton } from '@/components/skeletons';
import { Avatar, Count, DateText, Media, PrivacyChip, RoleChip } from '@/components/bits';
import { Timeline } from './Timeline';
import { EventRailRow } from './EventsScreen';
import { NotFoundScreen } from './NotFoundScreen';
import { Snackbar, useSnackbar } from './Snackbar';

export function GroupScreen({ slug }: { slug: string }) {
  const t = useT();
  const { roleFor, setRole } = useEngagement();
  const { message, say, close } = useSnackbar();

  const found = getGroupBySlug(slug);
  if (!found) return <NotFoundScreen />;

  const summary = groupSummary(found.id);
  const { group, posts, events, contributors } = summary;
  const role = roleFor(group);
  const action = joinAction[role];
  const member = role === 'admin' || role === 'moderator' || role === 'member';
  const hidden = group.privacy === 'private' && !member;

  return (
    <Screen
      title={group.name}
      subtitle={t('community.screen.group.subtitle')}
      crumbLabel={group.name}
      aside={<Count value={group.memberCount} compact />}
      skeleton={<CoverSkeleton timeline />}
    >
      <div className="columns">
        <div className="columns__main">
          <Panel>
            <Media media={group.cover} className="event-cover" eager />
            <h2 className="profile-head__name">{group.name}</h2>
            <div className="row">
              <PrivacyChip group={group} />
              <RoleChip group={{ ...group, role, roleKey: `community.role.${role}` }} />
              <span className="person-row__meta">
                <Count value={group.memberCount} compact />{' '}
                {t('community.count.members').toLocaleLowerCase(t.locale)}
              </span>
              {action ? (
                <md-button
                  variant={action.variant}
                  icon={action.icon}
                  onClick={() => {
                    const next =
                      role === 'none' ? (group.privacy === 'private' ? 'pending' : 'member') : 'none';
                    setRole(group, next);
                    say(
                      next === 'member'
                        ? 'community.msg.joined'
                        : next === 'pending'
                          ? 'community.msg.requested'
                          : role === 'pending'
                            ? 'community.msg.requestCancelled'
                            : 'community.msg.left',
                      { name: group.name },
                    );
                  }}
                >
                  {t(action.labelKey)}
                </md-button>
              ) : null}
            </div>
            <p>{t(group.descriptionKey)}</p>
            {group.joinedAt ? (
              <p className="person-row__meta">
                {t('community.hint.joinedGroup', { date: '' })}
                <DateText at={group.joinedAt} style="long" />
              </p>
            ) : null}
          </Panel>

          {hidden ? (
            <EmptyState message={t('community.hint.privateGroup')} />
          ) : posts.length === 0 ? (
            <EmptyState message={t('community.empty.posts')} />
          ) : (
            <Timeline posts={posts} onMessage={say} />
          )}
        </div>

        <aside className="columns__rail">
          {events.length > 0 ? (
            <Panel title={t('community.panel.groupEvents')} actions={<Count value={events.length} />}>
              {/* The RAIL variant — a 300px column cannot hold the list row's
                  three tracks, and a rail states what is coming up rather than
                  offering to answer it. See EventsScreen. */}
              <div className="rail-block">
                {events.map((event) => (
                  <EventRailRow key={event.id} event={event} />
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel title={t('community.panel.members')} actions={<Count value={contributors.length} />}>
            {contributors.length === 0 ? (
              <EmptyState message={t('community.empty.members')} />
            ) : (
              <div className="rail-block">
                {contributors.map((person) => (
                  <Link key={person.id} className="rail-row" href={route.person(person.handle)}>
                    <Avatar person={person} size="small" />
                    <span className="rail-row__text">
                      <span className="rail-row__name">{person.displayName}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </aside>
      </div>

      <Snackbar message={message} onClose={close} />
    </Screen>
  );
}
