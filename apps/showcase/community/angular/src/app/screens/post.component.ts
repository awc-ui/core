/** One post and its whole thread — the SAME CARD as the feed with the
    conversation open. An unknown id is this screen's guard, not the router's. */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { getPersonById, getPostById, resolve } from '@awc-ui/showcase-kit/community';
import { ScreenComponent } from '../components/screen.component';
import { PostSkeletonComponent } from '../components/skeletons.component';
import { PostCardComponent, RightRailComponent } from './parts.component';
import { NotFoundScreen } from './not-found.component';
import { SnackbarComponent, type SnackbarMessage } from './snackbar.component';
import { ShowcaseComponent } from '../lib/screen.base';

@Component({
  selector: 'awc-post-screen',
  standalone: true,
  imports: [
    ScreenComponent,
    PostSkeletonComponent,
    PostCardComponent,
    RightRailComponent,
    NotFoundScreen,
    SnackbarComponent,
  ],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!post || !author) {
      <awc-not-found-screen />
    } @else {
      <awc-screen
        [title]="t('community.screen.post.title')"
        [subtitle]="t('community.screen.post.subtitle', { name: author.displayName })"
        [customSkeleton]="true"
      >
        <awc-post-skeleton skeleton />

        <div class="columns">
          <div class="columns__main">
            <awc-post-card
              [item]="item"
              [showComments]="true"
              (message)="say($event)"
            ></awc-post-card>
          </div>
          <aside class="columns__rail"><awc-right-rail></awc-right-rail></aside>
        </div>

        <awc-snackbar [message]="message" [onClose]="close"></awc-snackbar>
      </awc-screen>
    }
  `,
})
export class PostScreen extends ShowcaseComponent {
  private readonly postId = inject(ActivatedRoute).snapshot.paramMap.get('postId') ?? '';
  protected readonly post = getPostById(this.postId);
  protected readonly author = this.post ? getPersonById(this.post.authorId) : undefined;
  protected readonly item = this.post ? resolve(this.post) : null!;
  protected message: SnackbarMessage | null = null;
  protected say = (event: { key: string | null; params?: Record<string, string | number> }) => {
    this.message = event.key === null ? null : { key: event.key, params: event.params };
  };
  protected close = () => {
    this.message = null;
  };
}
