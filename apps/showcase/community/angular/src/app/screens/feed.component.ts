/**
 * The feed — the screen this app is judged on.
 *
 * THREE COLUMNS ON A WIDE SCREEN, this vertical's signature layout and the
 * thing Lyra has no equivalent of. `.columns` in the kit's app.css carries the
 * measurements and the two breakpoints.
 *
 * IT PAGES BY REVEALING, NOT BY FETCHING. A scroll handler that appends on
 * intersection is untestable in a parity check, unreachable from a keyboard,
 * and would make the document height depend on how far the harness scrolled.
 */
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FEED_PAGE, feedItems, getViewer } from '@awc-ui/showcase-kit/community';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { FeedSkeletonComponent } from '../components/skeletons.component';
import { ComposerComponent, PostCardComponent, RightRailComponent } from './parts.component';
import { SnackbarComponent, type SnackbarMessage } from './snackbar.component';
import { ShowcaseComponent } from '../lib/screen.base';

@Component({
  selector: 'awc-feed-screen',
  standalone: true,
  imports: [
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    FeedSkeletonComponent,
    ComposerComponent,
    PostCardComponent,
    RightRailComponent,
    SnackbarComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <awc-screen
      [title]="t('community.screen.feed.title')"
      [subtitle]="t('community.screen.feed.subtitle')"
      [customSkeleton]="true"
    >
      <awc-feed-skeleton skeleton />

      <div class="columns">
        <div class="columns__main">
          <awc-panel>
            <awc-composer [viewer]="viewer" (message)="say($event)"></awc-composer>
          </awc-panel>

          @if (items.length === 0) {
            <awc-empty-state
              [message]="t('community.empty.feed')"
              [hint]="t('community.empty.feedHint')"
            />
          } @else {
            @for (item of visible; track item.post.id) {
              <awc-post-card [item]="item" (message)="say($event)"></awc-post-card>
            }
          }

          @if (shown < items.length) {
            <div class="feed__more">
              <md-button variant="tonal" icon="expand_more" (mdClick)="shown = items.length">{{
                t('community.action.viewAll')
              }}</md-button>
            </div>
          } @else {
            <div class="feed__end">
              <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
              <p class="strong">{{ t('community.common.caughtUp') }}</p>
              <p class="muted">{{ t('community.common.caughtUpHint') }}</p>
            </div>
          }
        </div>

        <aside class="columns__rail" [attr.aria-label]="t('community.panel.contacts')">
          <awc-right-rail></awc-right-rail>
        </aside>
      </div>

      <awc-snackbar [message]="message" [onClose]="close"></awc-snackbar>
    </awc-screen>
  `,
})
export class FeedScreen extends ShowcaseComponent {
  protected readonly viewer = getViewer();
  protected readonly items = feedItems();
  protected shown = FEED_PAGE;
  protected message: SnackbarMessage | null = null;

  protected get visible() {
    return this.items.slice(0, this.shown);
  }
  protected say = (event: { key: string | null; params?: Record<string, string | number> }) => {
    this.message = event.key === null ? null : { key: event.key, params: event.params };
  };
  protected close = () => {
    this.message = null;
  };
}
