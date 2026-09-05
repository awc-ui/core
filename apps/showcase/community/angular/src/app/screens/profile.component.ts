/** Your own profile. NO FRIENDSHIP BUTTON — `friendAction.self` is null. */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { getViewer, profileSummary } from '@awc-ui/showcase-kit/community';
import { ScreenComponent } from '../components/screen.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { ProfileSkeletonComponent } from '../components/skeletons.component';
import { CountComponent } from '../components/bits.component';
import {
  AboutPanelComponent,
  PhotoPanelComponent,
  ProfileHeaderComponent,
  TimelineComponent,
} from './parts.component';
import { SnackbarComponent, type SnackbarMessage } from './snackbar.component';
import { ShowcaseComponent } from '../lib/screen.base';

@Component({
  selector: 'awc-profile-screen',
  standalone: true,
  imports: [
    ScreenComponent,
    EmptyStateComponent,
    ProfileSkeletonComponent,
    CountComponent,
    ProfileHeaderComponent,
    AboutPanelComponent,
    PhotoPanelComponent,
    TimelineComponent,
    SnackbarComponent,
  ],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <awc-screen
      [title]="t('community.screen.profile.title')"
      [subtitle]="t('community.screen.profile.subtitle')"
      [customSkeleton]="true"
    >
      <awc-profile-skeleton skeleton />
      <awc-count aside [value]="summary.posts.length"></awc-count>

      <div class="columns">
        <div class="columns__main">
          <awc-profile-header [summary]="summary"></awc-profile-header>
          <awc-timeline [posts]="summary.posts" (message)="say($event)"></awc-timeline>
        </div>
        <aside class="columns__rail">
          <awc-about-panel [summary]="summary"></awc-about-panel>
          <awc-photo-panel [summary]="summary"></awc-photo-panel>
        </aside>
      </div>

      @if (summary.posts.length === 0) {
        <awc-empty-state [message]="t('community.empty.posts')" />
      }
      <awc-snackbar [message]="message" [onClose]="close"></awc-snackbar>
    </awc-screen>
  `,
})
export class ProfileScreen extends ShowcaseComponent {
  protected readonly summary = profileSummary(getViewer().id);
  protected message: SnackbarMessage | null = null;
  protected say = (event: { key: string | null; params?: Record<string, string | number> }) => {
    this.message = event.key === null ? null : { key: event.key, params: event.params };
  };
  protected close = () => {
    this.message = null;
  };
}
