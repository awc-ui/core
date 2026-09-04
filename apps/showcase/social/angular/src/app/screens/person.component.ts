import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  getPersonByHandle,
  getViewer,
  profileSummary,
  type Person,
} from '@awc-ui/showcase-kit/social';
import { ShowcaseComponent } from '../lib/screen.base';
import { EngagementService } from '../lib/engagement.service';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { PanelSkeletonComponent } from '../components/skeletons.component';
import { CountComponent, FollowButtonComponent } from '../components/bits.component';
import { PostGridComponent, ProfileHeaderComponent } from './parts.component';
import { NotFoundScreen } from './not-found.component';
import { ProfileScreen } from './profile.component';
import { SnackbarComponent, type SnackbarMessage } from './snackbar.component';

/**
 * Somebody else's profile. The second of the two drills.
 *
 * THE SAME HEADER AND GRID AS YOUR OWN, plus a follow button and minus the
 * saved and tagged tabs — which are yours, not theirs.
 *
 * ADDRESSED BY HANDLE, taken from the route parameter. `paramMap` as a signal
 * rather than a subscription, so every derived value re-reads itself and there
 * is nothing to unsubscribe — the same arrangement the banking drills use.
 */
@Component({
  selector: 'awc-person-screen',
  standalone: true,
  imports: [
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    PanelSkeletonComponent,
    CountComponent,
    FollowButtonComponent,
    PostGridComponent,
    ProfileHeaderComponent,
    NotFoundScreen,
    ProfileScreen,
    SnackbarComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  template: `
    @if (!person) {
      <awc-not-found-screen />
    } @else if (isSelf) {
      <!-- THE VIEWER'S OWN HANDLE RENDERS THEIR OWN SCREEN, rather than a
           read-only copy of it. Both URLs resolve, and answering with a page
           offering to follow yourself would be the state followAction.self
           exists to prevent. -->
      <awc-profile-screen />
    } @else if (summary) {
      <awc-screen
        [title]="person.displayName"
        [subtitle]="t('social.screen.person.subtitle')"
        [crumbLabel]="person.displayName"
        [customSkeleton]="true"
      >
        <awc-count aside [value]="summary.posts.length" [exact]="true" />
        <awc-panel-skeleton skeleton height="680px" [lines]="4" />

        <awc-profile-header [summary]="summary" [hasAction]="true">
          <awc-follow-button
            action
            [person]="person"
            [following]="store.isFollowing(person)"
            size="md"
            (toggle)="toggle($event)"
          />
        </awc-profile-header>

        <awc-panel [title]="t('social.panel.posts')">
          <awc-count actions [value]="summary.posts.length" [exact]="true" />
          <awc-post-grid [posts]="summary.posts">
            <div empty><awc-empty-state [message]="t('social.empty.posts')" /></div>
          </awc-post-grid>
        </awc-panel>

        <awc-snackbar [message]="message" [onClose]="close" />
      </awc-screen>
    }
  `,
})
export class PersonScreen extends ShowcaseComponent {
  protected readonly store = inject(EngagementService);

  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected message: SnackbarMessage | null = null;
  protected readonly close = () => {
    this.message = null;
  };

  /* The handle is percent-encoded on the way into the URL; the fixture's are
     plain ASCII today, but decoding is what makes a lookup miss mean "no such
     person" rather than "the handle had a character in it". */
  protected get person(): Person | undefined {
    const handle = this.params()?.get('handle');
    return handle ? getPersonByHandle(decodeURIComponent(handle)) : undefined;
  }
  protected get isSelf() {
    return this.person?.id === getViewer().id;
  }
  protected get summary() {
    const person = this.person;
    return person ? profileSummary(person.id) : null;
  }

  protected toggle(next: boolean) {
    const person = this.person;
    if (!person) return;
    this.store.setFollowing(person, next);
    this.message = {
      key: next ? 'social.msg.followed' : 'social.msg.unfollowed',
      params: { name: person.displayName },
    };
  }
}
