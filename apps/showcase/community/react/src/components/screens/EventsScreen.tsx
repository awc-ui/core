/**
 * Events — grouped by age, soonest first, past last.
 *
 * THE BUCKETS COME FROM THE KIT and empty ones are dropped rather than rendered
 * as a heading over nothing. Five of them — today, this week, this month, later
 * and past — and `past` is LAST rather than first: a list read top to bottom
 * should begin with what is about to happen, and putting last month above this
 * evening would be sorting by date rather than by usefulness.
 *
 * THE DATE IS A BLOCK, NOT A LINE OF TEXT, which is the one layout decision on
 * this screen worth defending. A column of events is scanned by date before
 * anything else, and a date inside a paragraph cannot be scanned — the eye has
 * to read each row to find it. Month over day, fixed width, so every row's
 * dates line up vertically down the column.
 */

import {
  RSVP_CHOICES,
  eventGroups,
  getEvents,
  getTotals,
  rsvpIcon,
  type CommunityEvent,
} from '@awc-ui/showcase-kit/community';
import { Link } from '@/lib/router';
import { route } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { useEngagement } from '@/lib/engagement';
import { EmptyState, Panel, Screen } from '@/components/Shell';
import { EventsSkeleton } from '@/components/skeletons';
import { Count, RsvpChip, TimeText } from '@/components/bits';
import { Snackbar, useSnackbar } from './Snackbar';

/** The month/day block. Formatted through the translator, pinned to UTC. */
export function EventDate({ at }: { at: string }) {
  const t = useT();
  const date = new Date(at);
  const month = new Intl.DateTimeFormat(t.locale, { month: 'short', timeZone: 'UTC' }).format(date);
  const day = new Intl.DateTimeFormat(t.locale, { day: 'numeric', timeZone: 'UTC' }).format(date);
  return (
    <time className="event-date" dateTime={at}>
      <span className="event-date__month">{month}</span>
      <span className="event-date__day">{day}</span>
    </time>
  );
}

/** The date as one line, for the rail. The block form above is for the list. */
function EventDateText({ at }: { at: string }) {
  const t = useT();
  return <time dateTime={at}>{t.formatDate(at.slice(0, 10), 'medium')}</time>;
}

export function EventRow({
  event,
  onMessage,
}: {
  event: CommunityEvent;
  onMessage: (key: string | null, params?: Record<string, string | number>) => void;
}) {
  const t = useT();
  const { rsvpFor, setRsvp } = useEngagement();
  const rsvp = rsvpFor(event);
  const past = Date.parse(event.startsAt) < Date.parse(new Date().toISOString());

  return (
    <div className="event-row" data-event={event.id}>
      <EventDate at={event.startsAt} />
      <div className="event-row__text">
        <Link className="event-row__name" href={route.event(event.slug)}>
          {event.name}
        </Link>
        <span className="event-row__meta">
          <TimeText at={event.startsAt} />
          <span aria-hidden="true">·</span>
          <span className="material-symbols-outlined" aria-hidden="true">
            {event.online ? 'videocam' : 'place'}
          </span>
          {event.online ? t('community.hint.online') : t(event.placeKey ?? 'community.common.na')}
        </span>
        {/* `__counts`, not `__meta`: this line is a sentence rather than a row
            of items, so it must not carry the flex gap — see app.css. */}
        <span className="event-row__counts">
          <Count value={event.goingCount} /> {t('community.count.going').toLocaleLowerCase(t.locale)}
          {event.friendsGoingCount > 0
            ? ` · ${
                event.friendsGoingCount === 1
                  ? t('community.hint.friendsGoingOne')
                  : t('community.hint.friendsGoing', {
                      count: t.formatNumber(event.friendsGoingCount),
                    })
              }`
            : ''}
        </span>
        <span className="row">
          <RsvpChip rsvp={rsvp} labelKey={`community.rsvp.${rsvp}`} />
        </span>
      </div>

      {/*
        THREE CHOICES, NOT FOUR. `declined` is reachable — it is the third chip
        — but `invited` is not offered: it is a state somebody else put the
        reader in, not one they can choose. Offering all five would give equal
        weight to an answer nobody is looking for and to one that is not an
        answer at all.
      */}
      <span className="event-row__action row">
        {RSVP_CHOICES.map((choice) => (
          <md-icon-button
            key={choice}
            icon={rsvpIcon[choice]}
            data-rsvp={choice}
            data-on={rsvp === choice ? '' : undefined}
            color={rsvp === choice ? 'primary' : undefined}
            aria-label={t(`community.rsvp.${choice}`)}
            aria-pressed={rsvp === choice}
            onClick={() => {
              const next = rsvp === choice ? 'none' : choice;
              setRsvp(event, next);
              onMessage(
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
          />
        ))}
      </span>
    </div>
  );
}

/**
 * An event in a 300px rail.
 *
 * A SECOND PRESENTATION, NOT A NARROWER FIRST ONE. `EventRow` above is a
 * three-column grid — date block, details, three answer buttons — sized for the
 * 680px feed column. Dropped into the group page's rail it had 300px to divide
 * three ways: every word wrapped, "Autumn Crossing" broke across two lines, and
 * the answer buttons landed on top of the title.
 *
 * Making `EventRow` responsive would mean a container query, because the row
 * cannot see its own column's width from a media query — the rail is 300px on a
 * 1400px screen. But the right answer was never a narrower version of the same
 * row: a rail is REFERENCE material. It says what is coming up; answering it is
 * a decision, and a decision belongs on the event's own page, which is one
 * press away. So this carries no controls at all.
 */
export function EventRailRow({ event }: { event: CommunityEvent }) {
  return (
    <Link className="rail-row" href={route.event(event.slug)}>
      <span className="material-symbols-outlined" aria-hidden="true">
        event
      </span>
      <span className="rail-row__text">
        <span className="rail-row__name">{event.name}</span>
        <span className="rail-row__meta">
          <EventDateText at={event.startsAt} />
        </span>
      </span>
    </Link>
  );
}

export function EventsScreen() {
  const t = useT();
  const totals = getTotals();
  const { message, say, close } = useSnackbar();
  const groups = eventGroups(getEvents());

  return (
    <Screen
      title={t('community.screen.events.title')}
      subtitle={t('community.screen.events.subtitle')}
      aside={<Count value={totals.goingCount} />}
      skeleton={<EventsSkeleton />}
    >
      {groups.length === 0 ? (
        <EmptyState message={t('community.empty.events')} />
      ) : (
        groups.map((group) => (
          <Panel
            key={group.bucket}
            title={t(group.labelKey)}
            actions={<Count value={group.events.length} />}
          >
            {/* `.event-list`, not `.stack`: an event row is taller than the
                12px the shared stack puts between items, so two of them read as
                one block. See app.css. */}
            <div className="event-list">
              {group.events.map((event) => (
                <EventRow key={event.id} event={event} onMessage={say} />
              ))}
            </div>
          </Panel>
        ))
      )}

      <Snackbar message={message} onClose={close} />
    </Screen>
  );
}
