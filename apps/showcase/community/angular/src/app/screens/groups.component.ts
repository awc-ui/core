/**
 * Groups — the ones you are in, and the ones you might be.
 *
 * TWO SECTIONS AND THE JOIN BUTTON IS THE DIFFERENCE. `joinAction` in the kit
 * decides which control each role gets, including the two that offer nothing:
 * an admin cannot leave their own group here, because there is no
 * ownership-transfer flow behind it and the control would be a dead end.
 */
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  getDiscoverGroups,
  getJoinedGroups,
  getTotals,
  joinAction,
  type Group,
} from '@awc-ui/showcase-kit/community';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { GroupsSkeletonComponent } from '../components/skeletons.component';
import {
  CountComponent,
  MediaComponent,
  PrivacyChipComponent,
  RoleChipComponent,
} from '../components/bits.component';
import { SnackbarComponent, type SnackbarMessage } from './snackbar.component';
import { EngagementService } from '../lib/engagement.service';
import { ShowcaseComponent } from '../lib/screen.base';

@Component({
  selector: 'awc-group-card',
  standalone: true,
  imports: [
    RouterLink,
    PanelComponent,
    CountComponent,
    MediaComponent,
    PrivacyChipComponent,
    RoleChipComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <awc-panel>
      <div class="group-card" [attr.data-group]="group.id">
        <a [routerLink]="path" [attr.aria-label]="group.name">
          <awc-media [media]="group.cover" className="group-card__cover"></awc-media>
        </a>
        <a class="group-card__name" [routerLink]="path">{{ group.name }}</a>
        <div class="row">
          <awc-privacy-chip [group]="group"></awc-privacy-chip>
          <awc-role-chip [role]="role"></awc-role-chip>
        </div>
        <p class="group-card__about">{{ t(group.descriptionKey) }}</p>
        <p class="person-row__meta">
          <awc-count [value]="group.memberCount" [compact]="true"></awc-count>
          {{ membersWord }}{{ weeklyText }}
        </p>
        @if (action) {
          <md-button
            [attr.variant]="action.variant"
            size="sm"
            [attr.icon]="action.icon"
            (mdClick)="press()"
            >{{ t(action.labelKey) }}</md-button
          >
        }
      </div>
    </awc-panel>
  `,
})
export class GroupCardComponent extends ShowcaseComponent {
  private readonly engagement = inject(EngagementService);
  @Input({ required: true }) group!: Group;
  @Input() onMessage: (m: SnackbarMessage | null) => void = () => {};

  protected get role() {
    return this.engagement.roleFor(this.group);
  }
  protected get action() {
    return joinAction[this.role];
  }
  protected get path() {
    return this.appPath(this.route.group(this.group.slug));
  }
  protected get membersWord() {
    return this.t('community.count.members').toLocaleLowerCase(this.t.locale);
  }
  protected get weeklyText() {
    if (this.group.weeklyPostCount === 0) return '';
    return (
      ' · ' +
      (this.group.weeklyPostCount === 1
        ? this.t('community.count.weeklyPostsOne')
        : this.t('community.count.weeklyPosts', {
            count: this.t.formatNumber(this.group.weeklyPostCount),
          }))
    );
  }

  protected press(): void {
    /* Joining a PRIVATE group asks rather than joins — the whole point of the
       privacy flag, and the state `pending` exists to hold. */
    const was = this.role;
    const next =
      was === 'none' ? (this.group.privacy === 'private' ? 'pending' : 'member') : 'none';
    this.engagement.setRole(this.group, next);
    this.onMessage({
      key:
        next === 'member'
          ? 'community.msg.joined'
          : next === 'pending'
            ? 'community.msg.requested'
            : was === 'pending'
              ? 'community.msg.requestCancelled'
              : 'community.msg.left',
      params: { name: this.group.name },
    });
  }
}

@Component({
  selector: 'awc-groups-screen',
  standalone: true,
  imports: [
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    GroupsSkeletonComponent,
    CountComponent,
    GroupCardComponent,
    SnackbarComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <awc-screen
      [title]="t('community.screen.groups.title')"
      [subtitle]="t('community.screen.groups.subtitle')"
      [customSkeleton]="true"
    >
      <awc-groups-skeleton skeleton />
      <awc-count aside [value]="totals.groupCount"></awc-count>

      <awc-panel [title]="t('community.panel.yourGroups')">
        <awc-count actions [value]="joined.length"></awc-count>
        @if (joined.length === 0) {
          <awc-empty-state
            [message]="t('community.empty.groups')"
            [hint]="t('community.empty.groupsHint')"
          />
        } @else {
          <div class="card-grid">
            @for (group of joined; track group.id) {
              <awc-group-card [group]="group" [onMessage]="say"></awc-group-card>
            }
          </div>
        }
      </awc-panel>

      <awc-panel [title]="t('community.panel.discover')">
        <awc-count actions [value]="discover.length"></awc-count>
        <div class="card-grid">
          @for (group of discover; track group.id) {
            <awc-group-card [group]="group" [onMessage]="say"></awc-group-card>
          }
        </div>
      </awc-panel>

      <awc-snackbar [message]="message" [onClose]="close"></awc-snackbar>
    </awc-screen>
  `,
})
export class GroupsScreen extends ShowcaseComponent {
  protected readonly totals = getTotals();
  protected readonly joined = getJoinedGroups();
  protected readonly discover = getDiscoverGroups();
  protected message: SnackbarMessage | null = null;
  protected say = (m: SnackbarMessage | null) => {
    this.message = m;
  };
  protected close = () => {
    this.message = null;
  };
}
