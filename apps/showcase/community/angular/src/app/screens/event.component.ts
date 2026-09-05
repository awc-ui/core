/**
 * One event.
 *
 * A PAST EVENT SAYS SO AND KEEPS NO BUTTONS: there is no answering an event that
 * has happened, so the row is replaced by a line of text rather than by three
 * controls that do nothing. Measured against the REPORTING INSTANT, not the
 * clock, so a past event stays past in every screenshot.
 */
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  REPORTING_INSTANT,
  RSVP_CHOICES,
  eventSummary,
  getEventBySlug,
  rsvpIcon,
  type Rsvp,
} from '@awc-ui/showcase-kit/community';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { CoverSkeletonComponent } from '../components/skeletons.component';
import {
  AvatarComponent,
  CountComponent,
  DateTextComponent,
  MediaComponent,
  RsvpChipComponent,
  TimeTextComponent,
} from '../components/bits.component';
import { NotFoundScreen } from './not-found.component';
import { SnackbarComponent, type SnackbarMessage } from './snackbar.component';
import { EngagementService } from '../lib/engagement.service';
import { ShowcaseComponent } from '../lib/screen.base';

@Component({
  selector: 'awc-event-screen',
  standalone: true,
  imports: [
    RouterLink,
    ScreenComponent,
    PanelComponent,
    CoverSkeletonComponent,
    AvatarComponent,
    CountComponent,
    DateTextComponent,
    MediaComponent,
    RsvpChipComponent,
    TimeTextComponent,
    NotFoundScreen,
    SnackbarComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!summary) {
      <awc-not-found-screen />
    } @else {
      <awc-screen
        [title]="summary.event.name"
        [subtitle]="t('community.screen.event.subtitle')"
        [crumbLabel]="summary.event.name"
        [customSkeleton]="true"
      >
        <awc-cover-skeleton skeleton />
        <awc-rsvp-chip aside [rsvp]="rsvp"></awc-rsvp-chip>

        <div class="columns">
          <div class="columns__main">
            <awc-panel>
              <awc-media
                [media]="summary.event.cover"
                className="event-cover"
                [eager]="true"
              ></awc-media>
              <h2 class="profile-head__name">{{ summary.event.name }}</h2>

              <div class="profile-facts">
                <p class="profile-fact">
                  <span class="material-symbols-outlined" aria-hidden="true">schedule</span
                  ><awc-date-text
                    [at]="summary.event.startsAt"
                    format="long"
                  ></awc-date-text>,
                  <awc-time-text [at]="summary.event.startsAt"></awc-time-text>
                  {{ t('community.common.to') }}
                  <awc-time-text [at]="summary.event.endsAt"></awc-time-text>
                </p>
                <p class="profile-fact">
                  <span class="material-symbols-outlined" aria-hidden="true">{{
                    placeGlyph
                  }}</span
                  >{{ placeText }}
                </p>
                @if (summary.group) {
                  <p class="profile-fact">
                    <span class="material-symbols-outlined" aria-hidden="true">groups</span
                    ><a
                      class="post-card__group"
                      [routerLink]="appPath(route.group(summary.group.slug))"
                      >{{ summary.group.name }}</a
                    >
                  </p>
                }
              </div>

              @if (past) {
                <p class="muted">{{ t('community.hint.eventOver') }}</p>
              } @else {
                <div class="row">
                  @for (choice of choices; track choice) {
                    <md-button
                      [attr.variant]="rsvp === choice ? 'filled' : 'outlined'"
                      [attr.icon]="glyph(choice)"
                      [attr.data-rsvp]="choice"
                      [attr.data-on]="rsvp === choice ? '' : null"
                      (mdClick)="answer(choice)"
                      >{{ t('community.rsvp.' + choice) }}</md-button
                    >
                  }
                </div>
              }

              <p>{{ t(summary.event.descriptionKey) }}</p>
            </awc-panel>
          </div>

          <aside class="columns__rail">
            <awc-panel [title]="t('community.panel.hostedBy')">
              <a class="rail-row" [routerLink]="appPath(route.person(summary.host.handle))">
                <awc-avatar [person]="summary.host" size="medium"></awc-avatar>
                <span class="rail-row__text">
                  <span class="rail-row__name">{{ summary.host.displayName }}</span>
                </span>
              </a>
            </awc-panel>

            <awc-panel [title]="t('community.panel.attendance')">
              <dl class="stat-row">
                <div>
                  <dt>{{ t('community.count.going') }}</dt>
                  <dd><awc-count [value]="summary.event.goingCount"></awc-count></dd>
                </div>
                <div>
                  <dt>{{ t('community.count.interested') }}</dt>
                  <dd><awc-count [value]="summary.event.interestedCount"></awc-count></dd>
                </div>
              </dl>
              @if (summary.friendsGoing.length > 0) {
                <p class="muted">{{ friendsLine }}</p>
                <div class="rail-block">
                  @for (person of summary.friendsGoing; track person.id) {
                    <a class="rail-row" [routerLink]="appPath(route.person(person.handle))">
                      <awc-avatar [person]="person" size="small"></awc-avatar>
                      <span class="rail-row__text">
                        <span class="rail-row__name">{{ person.displayName }}</span>
                      </span>
                    </a>
                  }
                </div>
              }
            </awc-panel>
          </aside>
        </div>

        <awc-snackbar [message]="message" [onClose]="close"></awc-snackbar>
      </awc-screen>
    }
  `,
})
export class EventScreen extends ShowcaseComponent {
  private readonly engagement = inject(EngagementService);
  private readonly slug = inject(ActivatedRoute).snapshot.paramMap.get('slug') ?? '';
  private readonly found = getEventBySlug(this.slug);

  protected readonly summary = this.found ? eventSummary(this.found.id) : null;
  protected readonly choices = RSVP_CHOICES;
  protected message: SnackbarMessage | null = null;
  protected glyph = (choice: Rsvp) => rsvpIcon[choice];

  protected get rsvp(): Rsvp {
    return this.found ? this.engagement.rsvpFor(this.found) : 'none';
  }
  protected get past() {
    return this.found ? Date.parse(this.found.startsAt) < Date.parse(REPORTING_INSTANT) : false;
  }
  protected get placeGlyph() {
    return this.summary?.event.online ? 'videocam' : 'place';
  }
  protected get placeText() {
    if (!this.summary) return '';
    return this.summary.event.online
      ? this.t('community.hint.online')
      : this.t(this.summary.event.placeKey ?? 'community.common.na');
  }
  protected get friendsLine() {
    const n = this.summary?.friendsGoing.length ?? 0;
    return n === 1
      ? this.t('community.hint.friendsGoingOne')
      : this.t('community.hint.friendsGoing', { count: this.t.formatNumber(n) });
  }

  protected answer(choice: Rsvp): void {
    if (!this.found) return;
    const next = this.rsvp === choice ? 'none' : choice;
    this.engagement.setRsvp(this.found, next);
    this.message = {
      key:
        next === 'going'
          ? 'community.msg.rsvpGoing'
          : next === 'interested'
            ? 'community.msg.rsvpInterested'
            : next === 'declined'
              ? 'community.msg.rsvpDeclined'
              : null,
      params: { name: this.found.name },
    } as SnackbarMessage;
  }
  protected close = () => {
    this.message = null;
  };
}
