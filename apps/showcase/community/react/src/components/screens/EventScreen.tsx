/**
 * One event: when, where, who is hosting it and who is going.
 *
 * THE ANSWER IS THE PRIMARY CONTROL and it is three buttons rather than a
 * toggle, for the same reason the events list is: going, interested and not
 * going are three outcomes, not two positions. `invited` is not offered because
 * it is a state somebody else put the reader in.
 *
 * A PAST EVENT SAYS SO AND KEEPS ITS BUTTONS DISABLED-BY-ABSENCE. There is no
 * answering an event that has happened, so the row is replaced by a line of
 * text rather than by three controls that do nothing.
 */

import {
  RSVP_CHOICES,
  REPORTING_INSTANT,
  eventSummary,
  getEventBySlug,
  rsvpIcon,
} from '@awc-ui/showcase-kit/community';
import { Link } from '@/lib/router';
import { route } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { useEngagement } from '@/lib/engagement';
import { Panel, Screen } from '@/components/Shell';
import { CoverSkeleton } from '@/components/skeletons';
import { Avatar, Count, DateText, Media, RsvpChip, TimeText } from '@/components/bits';
import { NotFoundScreen } from './NotFoundScreen';
import { Snackbar, useSnackbar } from './Snackbar';

export function EventScreen({ slug }: { slug: string }) {
  const t = useT();
  const { rsvpFor, setRsvp } = useEngagement();
  const { message, say, close } = useSnackbar();

  const found = getEventBySlug(slug);
  if (!found) return <NotFoundScreen />;

  const { event, host, group, friendsGoing } = eventSummary(found.id);
  const rsvp = rsvpFor(event);
  /* Measured against the REPORTING INSTANT, not the clock — the same rule every
     timestamp in this app follows, and the reason a past event stays past in
     every screenshot. */
  const past = Date.parse(event.startsAt) < Date.parse(REPORTING_INSTANT);

  return (
    <Screen
      title={event.name}
      subtitle={t('community.screen.event.subtitle')}
      crumbLabel={event.name}
      aside={<RsvpChip rsvp={rsvp} labelKey={`community.rsvp.${rsvp}`} />}
      skeleton={<CoverSkeleton />}
    >
      <div className="columns">
        <div className="columns__main">
          <Panel>
            <Media media={event.cover} className="event-cover" eager />
            <h2 className="profile-head__name">{event.name}</h2>

            <div className="profile-facts">
              <p className="profile-fact">
                <span className="material-symbols-outlined" aria-hidden="true">
                  schedule
                </span>
                <DateText at={event.startsAt} style="long" />
                {', '}
                <TimeText at={event.startsAt} /> {t('community.common.to')}{' '}
                <TimeText at={event.endsAt} />
              </p>
              <p className="profile-fact">
                <span className="material-symbols-outlined" aria-hidden="true">
                  {event.online ? 'videocam' : 'place'}
                </span>
                {event.online ? t('community.hint.online') : t(event.placeKey ?? 'community.common.na')}
              </p>
              {group ? (
                <p className="profile-fact">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    groups
                  </span>
                  <Link className="post-card__group" href={route.group(group.slug)}>
                    {group.name}
                  </Link>
                </p>
              ) : null}
            </div>

            {past ? (
              <p className="muted">{t('community.hint.eventOver')}</p>
            ) : (
              <div className="row">
                {RSVP_CHOICES.map((choice) => (
                  <md-button
                    key={choice}
                    variant={rsvp === choice ? 'filled' : 'outlined'}
                    icon={rsvpIcon[choice]}
                    data-rsvp={choice}
                    data-on={rsvp === choice ? '' : undefined}
                    onClick={() => {
                      const next = rsvp === choice ? 'none' : choice;
                      setRsvp(event, next);
                      say(
                        next === 'going'
                          ? 'community.msg.rsvpGoing'
                          : next === 'interested'
                            ? 'community.msg.rsvpInterested'
                            : next === 'declined'
                              ? 'community.msg.rsvpDeclined'
                              : null,
                        { name: event.name },
                      );
                    }}
                  >
                    {t(`community.rsvp.${choice}`)}
                  </md-button>
                ))}
              </div>
            )}

            <p>{t(event.descriptionKey)}</p>
          </Panel>
        </div>

        <aside className="columns__rail">
          <Panel title={t('community.panel.hostedBy')}>
            <Link className="rail-row" href={route.person(host.handle)}>
              <Avatar person={host} size="medium" />
              <span className="rail-row__text">
                <span className="rail-row__name">{host.displayName}</span>
              </span>
            </Link>
          </Panel>

          {/*
            THE PANEL HAS ITS OWN HEADING RATHER THAN REUSING "Going".

            It was titled `count.going` with the going figure in its actions
            slot, and then repeated both inside the stat row underneath —
            "Going 169" twice, four lines apart, which reads as two different
            numbers that happen to match. The heading now names the panel and
            the figures are stated once.
          */}
          <Panel title={t('community.panel.attendance')}>
            <dl className="stat-row">
              <div>
                <dt>{t('community.count.going')}</dt>
                <dd>
                  <Count value={event.goingCount} />
                </dd>
              </div>
              <div>
                <dt>{t('community.count.interested')}</dt>
                <dd>
                  <Count value={event.interestedCount} />
                </dd>
              </div>
            </dl>
            {friendsGoing.length > 0 ? (
              <>
                <p className="muted">
                  {friendsGoing.length === 1
                    ? t('community.hint.friendsGoingOne')
                    : t('community.hint.friendsGoing', {
                        count: t.formatNumber(friendsGoing.length),
                      })}
                </p>
                <div className="rail-block">
                  {friendsGoing.map((person) => (
                    <Link key={person.id} className="rail-row" href={route.person(person.handle)}>
                      <Avatar person={person} size="small" />
                      <span className="rail-row__text">
                      <span className="rail-row__name">{person.displayName}</span>
                    </span>
                    </Link>
                  ))}
                </div>
              </>
            ) : null}
          </Panel>
        </aside>
      </div>

      <Snackbar message={message} onClose={close} />
    </Screen>
  );
}
