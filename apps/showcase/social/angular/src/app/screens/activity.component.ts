import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterLink } from '@angular/router';
import { activityGroups, getTotals } from '@awc-ui/showcase-kit/social';
import { ShowcaseComponent } from '../lib/screen.base';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { PanelSkeletonComponent } from '../components/skeletons.component';
import {
  ActivityIconComponent,
  AvatarComponent,
  CountComponent,
  MediaComponent,
  WhenComponent,
} from '../components/bits.component';

/**
 * Activity — what happened to you, newest first.
 *
 * GROUPED BY AGE, NOT PAGED. Four buckets from the kit, and empty ones are
 * dropped rather than rendered as a heading over nothing.
 *
 * THE SENTENCE IS A TRANSLATED TEMPLATE, not a name concatenated with a verb.
 * `{name} liked your post` is one dictionary entry per kind, so Arabic puts the
 * verb where Arabic puts the verb.
 *
 * READ AND UNREAD ARE BOTH IN THE LIST. Marking everything read is one button
 * and it changes the badge in the rail; filtering the read ones out would make
 * the button look like it deleted them.
 */
@Component({
  selector: 'awc-activity-screen',
  standalone: true,
  imports: [
    RouterLink,
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    PanelSkeletonComponent,
    ActivityIconComponent,
    AvatarComponent,
    CountComponent,
    MediaComponent,
    WhenComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  template: `
    <awc-screen
      [title]="t('social.screen.activity.title')"
      [subtitle]="t('social.screen.activity.subtitle')"
      [hasActions]="unread > 0"
      [customSkeleton]="true"
    >
      <!-- TWO SEPARATE @if BLOCKS, not one holding both.
           Angular only projects a node into a named slot when it is the SOLE
           root of its control-flow block — NG8011 — so a single @if wrapping
           both the aside count and the toolbar button silently drops both into
           the default slot. -->
      @if (unread > 0) {
        <awc-count aside [value]="unread" />
      }
      @if (unread > 0) {
        <md-button actions variant="text" size="sm" icon="done_all" (mdClick)="allRead = true">
          {{ t('social.action.markAllRead') }}
        </md-button>
      }
      <awc-panel-skeleton skeleton height="560px" [lines]="10" />

      @if (groups.length === 0) {
        <awc-empty-state [message]="t('social.empty.activity')" />
      } @else {
        @for (group of groups; track group.bucket) {
          <awc-panel [title]="t(group.labelKey)">
            <awc-count actions [value]="group.rows.length" />
            <md-list
              [attr.label]="t(group.labelKey)"
              interaction-mode="multi-action"
              list-style="segmented"
            >
              @for (row of group.rows; track row.activity.id) {
                <md-list-item
                  [attr.data-unread]="!row.activity.read && !allRead ? '' : null"
                  [attr.headline]="
                    t('social.activity.' + row.activity.kind, { name: row.actor.displayName })
                  "
                  [attr.supporting-text]="'@' + row.actor.handle"
                  lines="2"
                >
                  <span slot="leading" class="activity-leading">
                    <awc-avatar [person]="row.actor" size="small" />
                    <awc-activity-icon [kind]="row.activity.kind" />
                  </span>
                  <span slot="trailing" class="activity-trailing">
                    <awc-when [at]="row.activity.at" />
                    <!-- A follow has no post to show, so the thumbnail slot is
                         genuinely empty rather than filled with a placeholder. -->
                    @if (row.post) {
                      <a class="activity-thumb" [routerLink]="appPath(route.post(row.post.id))">
                        <awc-media [media]="row.post.media[0]" className="activity-thumb__img" />
                      </a>
                    }
                  </span>
                </md-list-item>
              }
            </md-list>
          </awc-panel>
        }
      }
    </awc-screen>
  `,
})
export class ActivityScreen extends ShowcaseComponent {
  private readonly totals = getTotals();
  protected readonly groups = activityGroups();
  /* Read state is this screen's own override, and is NOT hoisted into the
     engagement service — unlike a like, it means nothing anywhere else. */
  protected allRead = false;

  protected get unread() {
    return this.allRead ? 0 : this.totals.unreadActivityCount;
  }
}
