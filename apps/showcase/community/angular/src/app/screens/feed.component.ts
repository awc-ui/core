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
import {
  discoveryCopy,
  discoveryCount,
  discoverFeed,
  type DiscoveryFilter,
} from '@awc-ui/showcase-kit/community';
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

      <section class="discovery-hero" [attr.aria-label]="copy.eyebrow">
        <div>
          <span class="discovery-hero__eyebrow">{{ copy.eyebrow }}</span>
          <h2>{{ copy.title }}</h2>
          <p>{{ copy.description }}</p>
        </div>
        <div class="discovery-hero__stat">
          <span class="material-symbols-outlined" aria-hidden="true">diversity_3</span
          ><strong class="discovery-hero__number">{{ t.formatNumber(allItems.length) }}</strong
          ><span class="discovery-hero__caption">{{ copy.stat }}</span>
        </div>
      </section>

      <div class="columns">
        <div class="columns__main">
          <div class="discovery-tools">
            <md-text-field [label]="copy.search" [value]="search" (mdInput)="onSearch($event)"
              ><span slot="leading-icon" class="material-symbols-outlined" aria-hidden="true"
                >search</span
              ></md-text-field
            >
            <div class="discovery-tools__filters" role="group" [attr.aria-label]="copy.eyebrow">
              <md-button
                [variant]="filter === 'all' ? 'tonal' : 'text'"
                size="sm"
                icon="auto_awesome"
                [attr.aria-pressed]="filter === 'all'"
                (mdClick)="setFilter('all')"
                >{{ copy.all }}</md-button
              >
              <md-button
                [variant]="filter === 'friends' ? 'tonal' : 'text'"
                size="sm"
                icon="people"
                [attr.aria-pressed]="filter === 'friends'"
                (mdClick)="setFilter('friends')"
                >{{ copy.second }}</md-button
              >
              <md-button
                [variant]="filter === 'groups' ? 'tonal' : 'text'"
                size="sm"
                icon="groups"
                [attr.aria-pressed]="filter === 'groups'"
                (mdClick)="setFilter('groups')"
                >{{ copy.third }}</md-button
              >
            </div>
            <div class="discovery-tools__row">
              <p class="discovery-tools__count" role="status">
                {{ discoveryCount(items.length, t.locale) }}
              </p>
              <md-button
                class="discovery-tools__reset"
                size="sm"
                variant="text"
                icon="restart_alt"
                [disabled]="!search && filter === 'all'"
                (mdClick)="search = ''; setFilter('all')"
                >{{ copy.clear }}</md-button
              >
            </div>
          </div>
          <awc-panel>
            <awc-composer [viewer]="viewer" (message)="say($event)"></awc-composer>
          </awc-panel>

          @if (items.length === 0) {
            <awc-empty-state [message]="copy.empty" [hint]="copy.hint" />
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
            <div class="feed__end" [hidden]="items.length === 0">
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
  protected readonly discoveryCount = discoveryCount;
  protected readonly viewer = getViewer();
  protected readonly allItems = feedItems();
  protected search = '';
  protected filter: DiscoveryFilter = 'all';
  protected get copy() {
    return discoveryCopy(this.t.locale);
  }
  protected get items() {
    return discoverFeed(this.allItems, this.search, this.filter, this.t);
  }
  protected onSearch(event: Event) {
    this.search = (event as CustomEvent<string>).detail ?? '';
    this.shown = FEED_PAGE;
  }
  protected setFilter(value: DiscoveryFilter) {
    this.filter = value;
    this.shown = FEED_PAGE;
  }
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
