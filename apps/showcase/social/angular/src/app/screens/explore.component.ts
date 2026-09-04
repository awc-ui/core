import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  exploreTiles,
  getTotals,
  postKindIcon,
  topicFacets,
  type Post,
} from '@awc-ui/showcase-kit/social';
import { ShowcaseComponent } from '../lib/screen.base';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { PanelSkeletonComponent } from '../components/skeletons.component';
import { CountComponent, MediaComponent, TopicChipComponent } from '../components/bits.component';

/**
 * Explore — everything on Lyra, as a grid.
 *
 * A MASONRY-ISH GRID WITHOUT MASONRY. One in seven tiles spans two columns and
 * two rows, which stops a uniform grid reading as a contact sheet. The span
 * comes from the kit and is derived from the post's INDEX rather than drawn at
 * random, so all five builds lay out identically.
 *
 * EVERY TILE IS SQUARE-CROPPED, whatever the picture's own ratio — the one
 * place this app deliberately throws away an aspect ratio.
 *
 * THE SEARCH MATCHES PEOPLE, NOT CAPTIONS, and the field says so: a selector
 * cannot see the dictionary, so a caption search would work in English and
 * silently return nothing in Arabic.
 */
@Component({
  selector: 'awc-explore-screen',
  standalone: true,
  imports: [
    RouterLink,
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    PanelSkeletonComponent,
    CountComponent,
    MediaComponent,
    TopicChipComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  template: `
    <awc-screen
      [title]="t('social.screen.explore.title')"
      [subtitle]="t('social.screen.explore.subtitle')"
      [customSkeleton]="true"
    >
      <awc-count aside [value]="tiles.length" />
      <awc-panel-skeleton skeleton height="720px" />

      <awc-panel [title]="t('social.panel.topics')">
        <div class="stack">
          <!-- The wrapper is what makes it fill the panel: md-search carries a
               360px minimum and a 720px maximum and centres itself in a wider
               parent, so full-width alone left it marooned in the middle. -->
          <div class="explore-search">
            <md-search
              layout="docked"
              trigger="bar"
              variant="contained"
              full-width
              debounce="250"
              [attr.label]="t('social.action.search')"
              [attr.placeholder]="t('social.count.people')"
              [attr.value]="search"
              (mdSearch)="onSearch($any($event))"
            ></md-search>
          </div>

          <div class="facet-row" (mdSelect)="onFacet($any($event))">
            @for (facet of facets; track facet.id) {
              <awc-topic-chip [id]="facet.id" [selected]="topic === facet.id" />
            }
          </div>

          <div class="row row--between facet-foot">
            <span class="muted">{{
              t('social.common.showing', { shown: tiles.length, total: totals.feedCount })
            }}</span>
            <!-- The reset exists only while there is something to reset. -->
            @if (filtered) {
              <md-button variant="text" size="sm" icon="restart_alt" (mdClick)="clear()">
                {{ t('social.action.clearFilters') }}
              </md-button>
            }
          </div>
        </div>
      </awc-panel>

      @if (tiles.length === 0) {
        <awc-empty-state
          [message]="t('social.empty.explore')"
          [hint]="t('social.empty.exploreHint')"
        />
      } @else {
        <ul class="explore-grid">
          @for (tile of tiles; track tile.post.id) {
            <li class="explore-tile" [attr.data-span]="tile.span === 2 ? '2' : null">
              <!-- The link's accessible name is the picture's alt plus whose it
                   is. A grid of forty links all named "Post" is one a screen
                   reader cannot navigate. -->
              <a
                class="explore-tile__link"
                [routerLink]="appPath(route.post(tile.post.id))"
                [attr.aria-label]="
                  t(tile.post.media[0].altKey) + ' — ' + tile.author.displayName
                "
              >
                <awc-media [media]="tile.post.media[0]" className="explore-tile__img" />
                @if (badge(tile.post)) {
                  <span
                    class="explore-tile__badge on-media material-symbols-outlined"
                    aria-hidden="true"
                    >{{ badge(tile.post) }}</span
                  >
                }
              </a>
            </li>
          }
        </ul>
      }
    </awc-screen>
  `,
})
export class ExploreScreen extends ShowcaseComponent {
  protected readonly totals = getTotals();
  protected topic: string | null = null;
  protected search = '';

  protected get facets() {
    return topicFacets(this.search || undefined);
  }
  protected get tiles() {
    return exploreTiles(this.topic ?? undefined, this.search || undefined);
  }
  protected get filtered() {
    return this.topic !== null || this.search !== '';
  }

  protected badge(post: Post) {
    return postKindIcon[post.kind];
  }

  /* `md-search` carries `{ value }` on every one of its events — unlike
     `md-text-field`, whose `mdInput` detail IS the bare string. `mdSearch`
     rather than `mdInput` because it is debounced and distinct-until-changed. */
  protected onSearch(event: CustomEvent<{ value: string }>) {
    this.search = event.detail?.value ?? '';
  }

  protected onFacet(event: CustomEvent<{ selected: boolean }>) {
    const value = (event.target as HTMLElement | null)?.dataset?.['topic'];
    if (!value) return;
    this.topic = event.detail.selected ? value : null;
  }

  protected clear() {
    this.topic = null;
    this.search = '';
  }
}
