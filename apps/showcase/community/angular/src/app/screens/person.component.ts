/**
 * Somebody else's profile.
 *
 * THE VIEWER'S OWN HANDLE RENDERS THEIR OWN SCREEN rather than a read-only copy
 * of it: both URLs resolve, and offering to befriend yourself is the state
 * `friendAction.self` exists to prevent.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  getPersonByHandle,
  getViewer,
  profileSummary,
  type Friendship,
} from '@awc-ui/showcase-kit/community';
import { ScreenComponent } from '../components/screen.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { ProfileSkeletonComponent } from '../components/skeletons.component';
import { CountComponent, FriendButtonComponent } from '../components/bits.component';
import {
  AboutPanelComponent,
  PhotoPanelComponent,
  ProfileHeaderComponent,
  TimelineComponent,
} from './parts.component';
import { NotFoundScreen } from './not-found.component';
import { ProfileScreen } from './profile.component';
import { SnackbarComponent, type SnackbarMessage } from './snackbar.component';
import { EngagementService } from '../lib/engagement.service';
import { ShowcaseComponent } from '../lib/screen.base';

@Component({
  selector: 'awc-person-screen',
  standalone: true,
  imports: [
    ScreenComponent,
    EmptyStateComponent,
    ProfileSkeletonComponent,
    CountComponent,
    FriendButtonComponent,
    ProfileHeaderComponent,
    AboutPanelComponent,
    PhotoPanelComponent,
    TimelineComponent,
    NotFoundScreen,
    ProfileScreen,
    SnackbarComponent,
  ],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!person) {
      <awc-not-found-screen />
    } @else if (isSelf) {
      <awc-profile-screen />
    } @else if (summary) {
      <awc-screen
        [title]="person.displayName"
        [subtitle]="t('community.screen.person.subtitle')"
        [crumbLabel]="person.displayName"
        [customSkeleton]="true"
      >
        <awc-profile-skeleton skeleton />
        <awc-count aside [value]="summary.posts.length"></awc-count>

        <div class="columns">
          <div class="columns__main">
            <awc-profile-header [summary]="summary">
              <awc-friend-button
                action
                [person]="person"
                [state]="state"
                size="md"
                (act)="act($event)"
              ></awc-friend-button>
            </awc-profile-header>
            @if (summary.posts.length === 0) {
              <awc-empty-state [message]="t('community.empty.posts')" />
            } @else {
              <awc-timeline [posts]="summary.posts" (message)="say($event)"></awc-timeline>
            }
          </div>
          <aside class="columns__rail">
            <awc-about-panel [summary]="summary"></awc-about-panel>
            <awc-photo-panel [summary]="summary"></awc-photo-panel>
          </aside>
        </div>

        <awc-snackbar [message]="message" [onClose]="close"></awc-snackbar>
      </awc-screen>
    }
  `,
})
export class PersonScreen extends ShowcaseComponent {
  private readonly engagement = inject(EngagementService);
  private readonly handle = inject(ActivatedRoute).snapshot.paramMap.get('handle') ?? '';

  protected readonly person = getPersonByHandle(this.handle);
  protected readonly isSelf = this.person?.id === getViewer().id;
  protected readonly summary =
    this.person && !this.isSelf ? profileSummary(this.person.id) : null;
  protected message: SnackbarMessage | null = null;

  protected get state(): Friendship {
    return this.person ? this.engagement.friendshipFor(this.person) : 'none';
  }
  protected act(next: Friendship): void {
    if (!this.person) return;
    const was = this.state;
    this.engagement.setFriendship(this.person, next);
    this.message = {
      key:
        next === 'outgoing'
          ? 'community.msg.friendRequested'
          : next === 'friend'
            ? 'community.msg.friendAccepted'
            : was === 'friend'
              ? 'community.msg.friendRemoved'
              : 'community.msg.requestCancelled',
      params: { name: this.person.displayName },
    };
  }
  protected say = (event: { key: string | null; params?: Record<string, string | number> }) => {
    this.message = event.key === null ? null : { key: event.key, params: event.params };
  };
  protected close = () => {
    this.message = null;
  };
}
