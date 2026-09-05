/**
 * Groups — the ones you are in, and the ones you might be.
 *
 * TWO SECTIONS AND THE JOIN BUTTON IS THE DIFFERENCE. A group the viewer
 * belongs to shows its role and how busy it is; one they do not shows its size
 * and offers to join. `joinAction` in the kit decides which control each role
 * gets, including the two that offer nothing: an admin cannot leave their own
 * group here (there is no ownership transfer behind it, so the control would be
 * a dead end) and a pending request offers to cancel rather than to join again.
 */

import { getDiscoverGroups, getJoinedGroups, getTotals, joinAction } from '@awc-ui/showcase-kit/community';
import { Link } from '@/lib/router';
import { route } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { useEngagement } from '@/lib/engagement';
import { EmptyState, Panel, Screen } from '@/components/Shell';
import { GroupsSkeleton } from '@/components/skeletons';
import { Count, Media, PrivacyChip, RoleChip } from '@/components/bits';
import { Snackbar, useSnackbar } from './Snackbar';
import type { Group } from '@awc-ui/showcase-kit/community';

function GroupCard({
  group,
  onMessage,
}: {
  group: Group;
  onMessage: (key: string | null, params?: Record<string, string | number>) => void;
}) {
  const t = useT();
  const { roleFor, setRole } = useEngagement();
  const role = roleFor(group);
  const action = joinAction[role];

  return (
    <Panel>
      <div className="group-card" data-group={group.id}>
        <Link href={route.group(group.slug)} aria-label={group.name}>
          <Media media={group.cover} className="group-card__cover" />
        </Link>
        <Link className="group-card__name" href={route.group(group.slug)}>
          {group.name}
        </Link>
        <div className="row">
          <PrivacyChip group={group} />
          <RoleChip group={{ ...group, role, roleKey: `community.role.${role}` }} />
        </div>
        <p className="group-card__about">{t(group.descriptionKey)}</p>
        <p className="person-row__meta">
          <Count value={group.memberCount} compact /> {t('community.count.members').toLocaleLowerCase(t.locale)}
          {/* A SINGULAR FORM, not "{count} posts" with a 1 in it. Two groups in
              the fixture post exactly once a week, and "1 posts this week" is
              the kind of thing that makes a demo look unfinished. Romanian and
              Arabic inflect differently again, which is why this is two
              dictionary entries rather than an "s" appended here. */}
          {group.weeklyPostCount > 0
            ? ` · ${
                group.weeklyPostCount === 1
                  ? t('community.count.weeklyPostsOne')
                  : t('community.count.weeklyPosts', { count: t.formatNumber(group.weeklyPostCount) })
              }`
            : ''}
        </p>
        {action ? (
          <md-button
            variant={action.variant}
            size="sm"
            icon={action.icon}
            onClick={() => {
              /* Where each press goes. Joining a PRIVATE group asks rather than
                 joins — which is the whole point of the privacy flag, and the
                 state `pending` exists to hold. */
              const next =
                role === 'none' ? (group.privacy === 'private' ? 'pending' : 'member') : 'none';
              setRole(group, next);
              onMessage(
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
    </Panel>
  );
}

export function GroupsScreen() {
  const t = useT();
  const totals = getTotals();
  const { message, say, close } = useSnackbar();
  const joined = getJoinedGroups();
  const discover = getDiscoverGroups();

  return (
    <Screen
      title={t('community.screen.groups.title')}
      subtitle={t('community.screen.groups.subtitle')}
      aside={<Count value={totals.groupCount} />}
      skeleton={<GroupsSkeleton />}
    >
      <Panel title={t('community.panel.yourGroups')} actions={<Count value={joined.length} />}>
        {joined.length === 0 ? (
          <EmptyState message={t('community.empty.groups')} hint={t('community.empty.groupsHint')} />
        ) : (
          <div className="card-grid">
            {joined.map((group) => (
              <GroupCard key={group.id} group={group} onMessage={say} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title={t('community.panel.discover')} actions={<Count value={discover.length} />}>
        <div className="card-grid">
          {discover.map((group) => (
            <GroupCard key={group.id} group={group} onMessage={say} />
          ))}
        </div>
      </Panel>

      <Snackbar message={message} onClose={close} />
    </Screen>
  );
}
