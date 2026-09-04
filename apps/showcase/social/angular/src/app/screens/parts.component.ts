import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  inject,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  engagement,
  getPersonById,
  postKindIcon,
  type FeedItem,
  type Post,
  type ProfileSummary,
  type StoryRing,
} from '@awc-ui/showcase-kit/social';
import { ShowcaseComponent } from '../lib/screen.base';
import { EngagementService } from '../lib/engagement.service';
import { PanelComponent } from '../components/panel.component';
import {
  AccountKindChipComponent,
  AvatarComponent,
  CountComponent,
  MediaComponent,
  PersonNameComponent,
  PostActionsComponent,
  PostMediaComponent,
  VerifiedComponent,
  WhenComponent,
} from '../components/bits.component';

/**
 * The pieces more than one screen renders: the story rail, a feed card, the
 * profile header and the post grid.
 */

/* ------------------------------------------------------------- story rail */

/**
 * The story rail, and the two buttons that move it.
 *
 * NO SCROLLBAR. A horizontal scrollbar under a row of ten circles is OS
 * furniture in the middle of the page. It is hidden, and the two chevrons take
 * over its job.
 *
 * THE SCROLLER IS STILL A REAL SCROLLER, which is the part that matters. Hiding
 * the bar changes nothing about the element: trackpad, touch drag, shift-wheel
 * and — the one people forget — TAB, which scrolls a focused ring into view on
 * its own, all still work.
 *
 * RTL IS A SIGN, NOT A SPECIAL CASE. `scrollLeft` runs negative in a
 * right-to-left container, so "toward the end" is a different sign each way —
 * but the DISTANCE from each end is `Math.abs(scrollLeft)` either way, so the
 * two disabled states need no branch at all.
 */
@Component({
  selector: 'awc-story-rail',
  standalone: true,
  imports: [AvatarComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  template: `
    <section class="story-rail" [attr.aria-label]="t('social.panel.stories')">
      <md-icon-button
        class="story-rail__nav story-rail__nav--prev"
        icon="chevron_left"
        [attr.aria-label]="t('social.action.previous')"
        [attr.soft-disabled]="atStart ? '' : null"
        (mdClick)="page(false)"
      ></md-icon-button>

      <div #scroller class="story-rail__scroller" (scroll)="measure()">
        @for (ring of rings; track ring.person.id) {
          <div class="story">
            <awc-avatar [person]="ring.person" size="medium" [ring]="!ring.self" />
            <span class="story__name">{{
              ring.self ? t('social.hint.yourStory') : ring.person.handle
            }}</span>
          </div>
        }
      </div>

      <md-icon-button
        class="story-rail__nav story-rail__nav--next"
        icon="chevron_right"
        [attr.aria-label]="t('social.action.next')"
        [attr.soft-disabled]="atEnd ? '' : null"
        (mdClick)="page(true)"
      ></md-icon-button>
    </section>
  `,
})
export class StoryRailComponent extends ShowcaseComponent {
  @Input({ required: true }) rings!: StoryRing[];

  /** How far one press moves the rail: a little under a viewport of it. */
  private static readonly PAGE_FRACTION = 0.8;

  protected atStart = true;
  protected atEnd = false;

  private el(): HTMLElement | null {
    return document.querySelector('.story-rail__scroller');
  }

  /* The 2px slack is not superstition: a scroller whose content is a fractional
     number of pixels wide never reports `scrollLeft + clientWidth === scrollWidth`
     exactly, so an exact comparison leaves the forward button live at the end
     forever. */
  protected measure(): void {
    const el = this.el();
    if (!el) return;
    const offset = Math.abs(el.scrollLeft);
    this.atStart = offset < 2;
    this.atEnd = offset + el.clientWidth >= el.scrollWidth - 2;
  }

  protected page(towardEnd: boolean): void {
    const el = this.el();
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    /* The only place direction is consulted: which way "the end" is. */
    const sign = towardEnd === rtl ? -1 : 1;
    el.scrollBy({
      left: el.clientWidth * StoryRailComponent.PAGE_FRACTION * sign,
      behavior: 'smooth',
    });
  }
}

/* ------------------------------------------------------------- post card */

/**
 * One post in the feed. The most-repeated component in the app.
 *
 * THE HEADER, THE PICTURE, THE ACTIONS, THE CAPTION, THE COMMENTS — in that
 * order: the picture is the content, so nothing but a name goes above it; the
 * actions sit directly under it because that is where the thumb is after
 * looking; and the caption comes after the actions because prose that pushed
 * the actions down would move the target every time a caption ran long.
 *
 * THE WHOLE CARD IS NOT A LINK. Only the name, the picture and the comment
 * count navigate. Wrapping the card would swallow the four action buttons — a
 * control inside a link is reachable but announces the link's name, and
 * pressing it with a keyboard fires both.
 */
@Component({
  selector: 'awc-post-card',
  standalone: true,
  imports: [
    RouterLink,
    AvatarComponent,
    CountComponent,
    PersonNameComponent,
    PostActionsComponent,
    PostMediaComponent,
    WhenComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  template: `
    <article class="post-card">
      <header class="post-card__head">
        <!-- ONE link around the avatar and the name, with awc-person-name
             inside it rather than a second link — an anchor inside an anchor is
             invalid HTML that a framework builds without complaint and a screen
             reader reads as two overlapping links. -->
        <a class="post-card__author" [routerLink]="appPath(route.person(item.author.handle))">
          <awc-avatar [person]="item.author" size="small" [ring]="true" />
          <span class="post-card__names">
            <awc-person-name [person]="item.author" />
            @if (item.post.locationKey) {
              <span class="post-card__place">{{ t(item.post.locationKey) }}</span>
            }
          </span>
        </a>
        <awc-when [at]="item.post.postedAt" />
      </header>

      <!-- The href goes INTO awc-post-media, which puts the anchor around the
           image only. Wrapping the whole thing put the pager buttons inside the
           link, so paging navigated to the post. -->
      <awc-post-media
        [post]="item.post"
        [eager]="eager"
        [href]="appPath(route.post(item.post.id))"
      />

      <awc-post-actions
        [liked]="liked"
        [saved]="saved"
        (like)="onLike()"
        (save)="onSave()"
        (share)="message.emit({ key: 'social.msg.linkCopied' })"
      />

      <div class="post-card__body">
        <p class="post-card__counts">
          <awc-count [value]="counts.likeCount" /> {{ likesWord }}
        </p>

        <p class="post-card__caption">
          <a
            class="post-card__handle"
            [routerLink]="appPath(route.person(item.author.handle))"
            >{{ item.author.handle }}</a
          >
          {{ t(item.post.captionKey) }}
        </p>

        @if (item.post.commentsDisabled) {
          <p class="post-card__muted">{{ t('social.hint.commentsOff') }}</p>
        } @else {
          @if (item.hiddenComments > 0) {
            <a class="post-card__more" [routerLink]="appPath(route.post(item.post.id))">{{
              t('social.action.viewComments', { count: t.formatNumber(item.post.commentCount) })
            }}</a>
          }
          @for (comment of item.preview; track comment.id) {
            <p class="post-card__comment">
              <!-- The record carries an author ID, not a handle — resolving it
                   here is what stops per-07 appearing where a name belongs. -->
              <a
                class="post-card__handle"
                [routerLink]="appPath(route.person(handleOf(comment.authorId)))"
                >{{ handleOf(comment.authorId) }}</a
              >
              {{ t(comment.bodyKey) }}
            </p>
          }
        }
      </div>
    </article>
  `,
})
export class PostCardComponent extends ShowcaseComponent {
  @Input({ required: true }) item!: FeedItem;
  @Input() eager = false;
  @Output() message = new EventEmitter<{
    key: string | null;
    params?: Record<string, string | number>;
  }>();

  /* `store`, not `engagement`: the kit exports a function of that name and this
     file imports it. */
  private readonly store = inject(EngagementService);

  protected get liked() {
    return this.store.isLiked(this.item.post);
  }
  protected get saved() {
    return this.store.isSaved(this.item.post);
  }
  /* The kit does the arithmetic of turning an override plus a shipped count
     into the number on screen — five builds must not each write
     `likeCount + (liked && !post.liked ? 1 : 0)` slightly differently. */
  protected get counts() {
    return engagement(this.item.post, this.liked, this.saved);
  }
  protected get likesWord() {
    return this.t('social.count.likes').toLocaleLowerCase(this.t.locale);
  }

  protected handleOf(id: string): string {
    return getPersonById(id)?.handle ?? id;
  }

  /* Liking announces; UNliking does not. A snackbar is for something the reader
     may want to undo or verify, and taking a like back is already its own
     confirmation — the heart empties. Saving is the other way round. */
  protected onLike() {
    const next = this.store.toggleLike(this.item.post);
    this.message.emit({ key: next ? 'social.msg.liked' : null });
  }

  protected onSave() {
    const next = this.store.toggleSave(this.item.post);
    this.message.emit({ key: next ? 'social.msg.saved' : 'social.msg.unsaved' });
  }
}

/* ---------------------------------------------------------- profile parts */

/**
 * The header, shared by the two profile screens.
 *
 * THE THREE COUNTS ARE EXACT, not compact. A follower total is a number people
 * check — "1.2K followers" on an account with 1,180 is a figure its owner would
 * dispute — which is the distinction `countOptions` draws.
 */
@Component({
  selector: 'awc-profile-header',
  standalone: true,
  imports: [
    PanelComponent,
    AccountKindChipComponent,
    AvatarComponent,
    CountComponent,
    VerifiedComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  template: `
    <awc-panel>
      <div class="profile-head">
        <awc-avatar [person]="summary.person" size="large" [ring]="true" />

        <div class="profile-head__text">
          <div class="profile-head__names">
            <h2 class="profile-head__name">
              {{ summary.person.displayName }}
              <awc-verified [person]="summary.person" />
            </h2>
            <span class="profile-head__handle">&#64;{{ summary.person.handle }}</span>
            <awc-account-kind-chip [person]="summary.person" />
          </div>

          <dl class="stat-row">
            <div>
              <dt>{{ t('social.count.posts') }}</dt>
              <dd><awc-count [value]="summary.posts.length" [exact]="true" /></dd>
            </div>
            <div>
              <dt>{{ t('social.count.followers') }}</dt>
              <dd><awc-count [value]="summary.person.followerCount" [exact]="true" /></dd>
            </div>
            <div>
              <dt>{{ t('social.count.following') }}</dt>
              <dd><awc-count [value]="summary.person.followingCount" [exact]="true" /></dd>
            </div>
            <div>
              <dt>{{ t('social.count.likes') }}</dt>
              <dd><awc-count [value]="summary.likes" /></dd>
            </div>
          </dl>

          <p class="profile-head__bio">{{ t(summary.person.bioKey) }}</p>
          @if (summary.person.locationKey) {
            <p class="muted profile-head__place">
              <span class="material-symbols-outlined" aria-hidden="true">place</span>
              {{ t(summary.person.locationKey) }}
            </p>
          }
        </div>

        @if (hasAction) {
          <div class="profile-head__action"><ng-content select="[action]" /></div>
        }
      </div>

      @if (summary.topTopics.length > 0) {
        <div class="row">
          <span class="muted">{{ t('social.panel.topics') }}</span>
          @for (topic of summary.topTopics; track topic.id) {
            <md-chip
              variant="assist"
              appearance="outlined"
              color="secondary"
              [attr.icon]="topic.icon"
              [attr.label]="t(topic.labelKey)"
            ></md-chip>
          }
        </div>
      }
    </awc-panel>
  `,
})
export class ProfileHeaderComponent extends ShowcaseComponent {
  @Input({ required: true }) summary!: ProfileSummary;
  /* Angular cannot detect whether projected content exists, so the caller says
     so — the same explicit-input trick the banking port's panels use. */
  @Input() hasAction = false;
}

/**
 * A square grid of posts, three across.
 *
 * PINNED POSTS LEAD, and they say so with a badge — otherwise a grid ordered by
 * anything but date looks like a grid that has lost its order.
 */
@Component({
  selector: 'awc-post-grid',
  standalone: true,
  imports: [RouterLink, MediaComponent],
  styles: ':host { display: contents; }',
  template: `
    @if (posts.length === 0) {
      <ng-content select="[empty]" />
    } @else {
      <ul class="post-grid">
        @for (post of posts; track post.id) {
          <li class="post-grid__cell">
            <a
              class="post-grid__link"
              [routerLink]="appPath(route.post(post.id))"
              [attr.aria-label]="t(post.media[0].altKey)"
            >
              <awc-media [media]="post.media[0]" className="post-grid__img" />
              @if (post.pinned) {
                <span class="post-grid__pin on-media">
                  <span class="material-symbols-outlined" aria-hidden="true">push_pin</span>
                  {{ t('social.hint.gridSpan') }}
                </span>
              }
              @if (badge(post)) {
                <span class="post-grid__badge on-media material-symbols-outlined" aria-hidden="true">{{
                  badge(post)
                }}</span>
              }
            </a>
          </li>
        }
      </ul>
    }
  `,
})
export class PostGridComponent extends ShowcaseComponent {
  @Input({ required: true }) posts!: Post[];
  protected badge(post: Post) {
    return postKindIcon[post.kind];
  }
}
