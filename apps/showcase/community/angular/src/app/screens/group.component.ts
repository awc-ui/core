/**
 * One group.
 *
 * A PRIVATE GROUP THE VIEWER IS NOT IN SHOWS ITS ABOUT AND NOTHING ELSE, and
 * SAYS the posts are withheld — an empty feed with no explanation reads as a
 * dead group, and one that showed its posts anyway would make the privacy flag
 * a decoration.
 */
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { getGroupBySlug, groupSummary, joinAction } from '@awc-ui/showcase-kit/community';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { CoverSkeletonComponent } from '../components/skeletons.component';
import {
  AvatarComponent,
  CountComponent,
  DateTextComponent,
  MediaComponent,
  PrivacyChipComponent,
  RoleChipComponent,
} from '../components/bits.component';
import { EventRailRowComponent, TimelineComponent } from './parts.component';
import { NotFoundScreen } from './not-found.component';
import { SnackbarComponent, type SnackbarMessage } from './snackbar.component';
import { EngagementService } from '../lib/engagement.service';
import { ShowcaseComponent } from '../lib/screen.base';

@Component({
  selector: 'awc-group-screen',
  standalone: true,
  imports: [
    RouterLink,
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    CoverSkeletonComponent,
    AvatarComponent,
    CountComponent,
    DateTextComponent,
    MediaComponent,
    PrivacyChipComponent,
    RoleChipComponent,
    EventRailRowComponent,
    TimelineComponent,
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
        [title]="summary.group.name"
        [subtitle]="t('community.screen.group.subtitle')"
        [crumbLabel]="summary.group.name"
        [customSkeleton]="true"
      >
        <awc-cover-skeleton skeleton [timeline]="true" />
        <awc-count aside [value]="summary.group.memberCount" [compact]="true"></awc-count>

        <div class="columns">
          <div class="columns__main">
            <awc-panel>
              <awc-media
                [media]="summary.group.cover"
                className="event-cover"
                [eager]="true"
              ></awc-media>
              <h2 class="profile-head__name">{{ summary.group.name }}</h2>
              <div class="row">
                <awc-privacy-chip [group]="summary.group"></awc-privacy-chip>
                <awc-role-chip [role]="role"></awc-role-chip>
                <span class="person-row__meta">
                  <awc-count [value]="summary.group.memberCount" [compact]="true"></awc-count>
                  {{ membersWord }}
                </span>
                @if (action) {
                  <md-button
                    [attr.variant]="action.variant"
                    [attr.icon]="action.icon"
                    (mdClick)="press()"
                    >{{ t(action.labelKey) }}</md-button
                  >
                }
              </div>
              <p>{{ t(summary.group.descriptionKey) }}</p>
              @if (summary.group.joinedAt) {
                <p class="person-row__meta">
                  {{ joinedLabel
                  }}<awc-date-text
                    [at]="summary.group.joinedAt"
                    format="long"
                  ></awc-date-text>
                </p>
              }
            </awc-panel>

            @if (hidden) {
              <awc-empty-state [message]="t('community.hint.privateGroup')" />
            } @else if (summary.posts.length === 0) {
              <awc-empty-state [message]="t('community.empty.posts')" />
            } @else {
              <awc-timeline [posts]="summary.posts" (message)="say($event)"></awc-timeline>
            }
          </div>

          <aside class="columns__rail">
            @if (summary.events.length > 0) {
              <awc-panel [title]="t('community.panel.groupEvents')">
                <awc-count actions [value]="summary.events.length"></awc-count>
                <div class="rail-block">
                  @for (event of summary.events; track event.id) {
                    <awc-event-rail-row [event]="event"></awc-event-rail-row>
                  }
                </div>
              </awc-panel>
            }

            <awc-panel [title]="t('community.panel.members')">
              <awc-count actions [value]="summary.contributors.length"></awc-count>
              @if (summary.contributors.length === 0) {
                <awc-empty-state [message]="t('community.empty.members')" />
              } @else {
                <div class="rail-block">
                  @for (person of summary.contributors; track person.id) {
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
export class GroupScreen extends ShowcaseComponent {
  private readonly engagement = inject(EngagementService);
  private readonly slug = inject(ActivatedRoute).snapshot.paramMap.get('slug') ?? '';
  private readonly found = getGroupBySlug(this.slug);

  protected readonly summary = this.found ? groupSummary(this.found.id) : null;
  protected message: SnackbarMessage | null = null;

  protected get role() {
    return this.found ? this.engagement.roleFor(this.found) : 'none';
  }
  protected get action() {
    return joinAction[this.role];
  }
  protected get hidden() {
    return (
      this.summary?.group.privacy === 'private' &&
      !['admin', 'moderator', 'member'].includes(this.role)
    );
  }
  protected get membersWord() {
    return this.t('community.count.members').toLocaleLowerCase(this.t.locale);
  }
  protected get joinedLabel() {
    return this.t('community.hint.joinedGroup', { date: '' });
  }

  protected press(): void {
    if (!this.found) return;
    const was = this.role;
    const next =
      was === 'none' ? (this.found.privacy === 'private' ? 'pending' : 'member') : 'none';
    this.engagement.setRole(this.found, next);
    this.message = {
      key:
        next === 'member'
          ? 'community.msg.joined'
          : next === 'pending'
            ? 'community.msg.requested'
            : was === 'pending'
              ? 'community.msg.requestCancelled'
              : 'community.msg.left',
      params: { name: this.found.name },
    };
  }
  protected say = (event: { key: string | null; params?: Record<string, string | number> }) => {
    this.message = event.key === null ? null : { key: event.key, params: event.params };
  };
  protected close = () => {
    this.message = null;
  };
}
