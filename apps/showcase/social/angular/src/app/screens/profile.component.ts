import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { getPosts, getViewer, profileSummary, type Post } from '@awc-ui/showcase-kit/social';
import { ShowcaseComponent } from '../lib/screen.base';
import { EngagementService } from '../lib/engagement.service';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { PanelSkeletonComponent } from '../components/skeletons.component';
import { CountComponent } from '../components/bits.component';
import { PostGridComponent, ProfileHeaderComponent } from './parts.component';

type Tab = 'posts' | 'saved' | 'tagged';

/**
 * Your own profile: posts, saved, tagged.
 *
 * THREE TABS, AND `md-tabs` IS THE RIGHT COMPONENT HERE — the one place in this
 * app it is. The house rule is that destinations are a rail or a bar and never
 * tabs; these are not destinations. They are three views of the SAME thing,
 * inside one screen, with one URL.
 *
 * SAVED IS THE ONLY TAB THAT MOVES. Its contents come from the engagement
 * service rather than the fixture, so a post saved on the feed appears here
 * without a reload.
 */
@Component({
  selector: 'awc-profile-screen',
  standalone: true,
  imports: [
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    PanelSkeletonComponent,
    CountComponent,
    PostGridComponent,
    ProfileHeaderComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  template: `
    <awc-screen
      [title]="t('social.screen.profile.title')"
      [subtitle]="t('social.screen.profile.subtitle')"
      [customSkeleton]="true"
    >
      <awc-count aside [value]="summary.posts.length" [exact]="true" />
      <awc-panel-skeleton skeleton height="680px" [lines]="4" />

      <awc-profile-header [summary]="summary" />

      <awc-panel>
        <md-tabs variant="primary" (mdTabChange)="onTab($any($event))">
          <md-tab value="posts" [attr.label]="t('social.panel.posts')" icon="grid_on"></md-tab>
          <md-tab value="saved" [attr.label]="t('social.panel.saved')" icon="bookmark"></md-tab>
          <md-tab
            value="tagged"
            [attr.label]="t('social.panel.tagged.short')"
            icon="sell"
          ></md-tab>
        </md-tabs>

        <awc-post-grid [posts]="shown">
          <div empty>
            @if (tab === 'saved') {
              <awc-empty-state
                [message]="t('social.empty.saved')"
                [hint]="t('social.empty.savedHint')"
              />
            } @else if (tab === 'tagged') {
              <awc-empty-state [message]="t('social.empty.tagged')" />
            } @else {
              <awc-empty-state [message]="t('social.empty.posts')" />
            }
          </div>
        </awc-post-grid>
      </awc-panel>
    </awc-screen>
  `,
})
export class ProfileScreen extends ShowcaseComponent {
  private readonly store = inject(EngagementService);

  protected readonly summary = profileSummary(getViewer().id);
  private readonly all = getPosts();
  protected tab: Tab = 'posts';

  /* Nothing in the fixture models "tagged in" — inventing a field for one tab
     would be data added to serve a layout. The tab exists because a profile has
     one, and its empty state is the honest answer. */
  private readonly tagged: Post[] = [];

  protected get shown(): Post[] {
    if (this.tab === 'posts') return this.summary.posts;
    if (this.tab === 'tagged') return this.tagged;
    const saved = this.store.savedIds(this.all);
    return this.all.filter((post) => saved.has(post.id));
  }

  protected onTab(event: CustomEvent<{ value?: string }>) {
    this.tab = (event.detail?.value ?? 'posts') as Tab;
  }
}
