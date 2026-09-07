import {
  discoveryCopy,
  discoveryCount,
  discoverFeed,
  type DiscoveryFilter,
} from '@awc-ui/showcase-kit/social';
import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FEED_PAGE,
  feedItems,
  storyRail,
  suggestedPeople,
  type Person,
} from '@awc-ui/showcase-kit/social';
import { ShowcaseComponent } from '../lib/screen.base';
import { EngagementService } from '../lib/engagement.service';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { PanelSkeletonComponent } from '../components/skeletons.component';
import {
  AvatarComponent,
  CountComponent,
  FollowButtonComponent,
} from '../components/bits.component';
import { PostCardComponent, StoryRailComponent } from './parts.component';
import { SnackbarComponent, type SnackbarMessage } from './snackbar.component';

/**
 * The feed — the screen this app is judged on.
 *
 * POSTS FROM PEOPLE YOU FOLLOW, NEWEST FIRST, and the selection rule is the
 * kit's `getFeed()`: someone who follows YOU does not thereby appear here, and
 * that asymmetry is the whole reason `Relationship` has four values instead of
 * a boolean.
 *
 * ONE COLUMN, CAPPED. A feed is a column of pictures read at one width.
 *
 * IT PAGES BY REVEALING, NOT BY FETCHING. There is no infinite scroll: a scroll
 * handler that appends on intersection is untestable in a parity check,
 * unreachable from a keyboard, and would make the document height — which
 * `verify-showcase-parity` compares across builds — depend on how far the
 * harness happened to scroll.
 */
@Component({
  selector: 'awc-feed-screen',
  standalone: true,
  imports: [
    RouterLink,
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    PanelSkeletonComponent,
    AvatarComponent,
    CountComponent,
    FollowButtonComponent,
    PostCardComponent,
    StoryRailComponent,
    SnackbarComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  template: `
    <awc-screen
      [title]="t('social.screen.feed.title')"
      [subtitle]="t('social.screen.feed.subtitle')"
      [customSkeleton]="true"
    >
      <awc-panel-skeleton skeleton height="640px" [lines]="6" />

      <section class="discovery-hero" [attr.aria-label]="copy.eyebrow">
        <div>
          <span class="discovery-hero__eyebrow">{{ copy.eyebrow }}</span>
          <h2>{{ copy.title }}</h2>
          <p>{{ copy.description }}</p>
        </div>
        <div class="discovery-hero__stat">
          <span class="material-symbols-outlined" aria-hidden="true">camera</span
          ><strong class="discovery-hero__number">{{ t.formatNumber(allItems.length) }}</strong
          ><span class="discovery-hero__caption">{{ copy.stat }}</span>
        </div>
      </section>

      <awc-story-rail [rings]="rail" />

      <div class="feed-layout">
        <div class="feed">
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
                [variant]="filter === 'saved' ? 'tonal' : 'text'"
                size="sm"
                icon="bookmark"
                [attr.aria-pressed]="filter === 'saved'"
                (mdClick)="setFilter('saved')"
                >{{ copy.second }}</md-button
              >
              <md-button
                [variant]="filter === 'carousel' ? 'tonal' : 'text'"
                size="sm"
                icon="view_carousel"
                [attr.aria-pressed]="filter === 'carousel'"
                (mdClick)="setFilter('carousel')"
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
          @if (visible.length === 0) {
            <awc-empty-state [message]="copy.empty" [hint]="copy.hint" />
          } @else {
            <!-- Only the first decodes eagerly. Everything below the fold is
                 lazy, which keeps forty images off the first paint. -->
            @for (item of visible; track item.post.id; let i = $index) {
              <awc-post-card [item]="item" [eager]="i === 0" (message)="say($event)" />
            }
          }

          @if (shown < items.length) {
            <div class="feed__more">
              <md-button variant="tonal" icon="expand_more" (mdClick)="showAll()">
                {{ t('social.action.viewAll') }}
              </md-button>
            </div>
          } @else {
            <div class="feed__end" [hidden]="items.length === 0">
              <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
              <p class="strong">{{ t('social.common.caughtUp') }}</p>
              <p class="muted">{{ t('social.common.caughtUpHint') }}</p>
            </div>
          }
        </div>

        <!-- ASIDE CONTENT, AND IT SAYS SO. app.css moves it below the column
             on a phone rather than above it: a reader who opened the app came
             for the posts. -->
        <aside class="feed-aside">
          <awc-panel [title]="t('social.panel.suggested')">
            <awc-count actions [value]="suggestions.length" />
            <!-- PLAIN ROWS, NOT md-list-item. Four text slots and a trailing
                 action do not fit in a 340px aside. -->
            <div class="stack">
              @for (person of suggestions; track person.id) {
                <div class="suggest-row">
                  <awc-avatar [person]="person" size="small" />
                  <span class="suggest-row__text">
                    <a
                      class="suggest-row__name"
                      [routerLink]="appPath(route.person(person.handle))"
                      >{{ person.displayName }}</a
                    >
                    <span class="suggest-row__meta">{{ t(person.relationshipKey) }}</span>
                  </span>
                  <awc-follow-button
                    [person]="person"
                    [following]="store.isFollowing(person)"
                    (toggle)="follow(person, $event)"
                  />
                </div>
              }
            </div>
          </awc-panel>
        </aside>
      </div>

      <awc-snackbar [message]="message" [onClose]="close" />
    </awc-screen>
  `,
})
export class FeedScreen extends ShowcaseComponent {
  protected readonly discoveryCount = discoveryCount;
  protected readonly store = inject(EngagementService);

  protected readonly allItems = feedItems();
  protected search = '';
  protected filter: DiscoveryFilter = 'all';
  protected get copy() {
    return discoveryCopy(this.t.locale);
  }
  protected get items() {
    return discoverFeed(this.allItems, this.search, this.filter, this.t, (item) =>
      this.store.isSaved(item.post),
    );
  }
  protected onSearch(event: Event) {
    this.search = (event as CustomEvent<string>).detail ?? '';
    this.shown = FEED_PAGE;
  }
  protected setFilter(value: DiscoveryFilter) {
    this.filter = value;
    this.shown = FEED_PAGE;
  }
  protected readonly rail = storyRail();
  protected readonly suggestions = suggestedPeople(5);
  protected shown = FEED_PAGE;

  protected message: SnackbarMessage | null = null;
  protected readonly close = () => {
    this.message = null;
  };

  protected get visible() {
    return this.items.slice(0, this.shown);
  }

  protected showAll() {
    this.shown = this.items.length;
  }

  protected say(event: { key: string | null; params?: Record<string, string | number> }) {
    this.message = event.key === null ? null : { key: event.key, params: event.params };
  }

  protected follow(person: Person, next: boolean) {
    this.store.setFollowing(person, next);
    this.say({
      key: next ? 'social.msg.followed' : 'social.msg.unfollowed',
      params: { name: person.displayName },
    });
  }
}
