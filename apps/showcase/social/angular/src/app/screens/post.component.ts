import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  engagement,
  getComments,
  getPersonById,
  getPostById,
  type Comment,
  type Person,
} from '@awc-ui/showcase-kit/social';
import { ShowcaseComponent } from '../lib/screen.base';
import { EngagementService } from '../lib/engagement.service';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { PanelSkeletonComponent } from '../components/skeletons.component';
import {
  AvatarComponent,
  CountComponent,
  PersonNameComponent,
  PostActionsComponent,
  PostMediaComponent,
  WhenComponent,
} from '../components/bits.component';
import { NotFoundScreen } from './not-found.component';
import { SnackbarComponent, type SnackbarMessage } from './snackbar.component';

/**
 * One post, and its comments. The first of the two drills.
 *
 * TWO COLUMNS ABOVE 900px, ONE BELOW. The picture takes the space it deserves
 * and the conversation sits beside it; on a phone the picture goes back on top,
 * because a comment thread beside a 390px picture is two narrow columns and
 * neither is readable.
 *
 * THE COMMENTS COME FROM THE KIT IN READING ORDER, not date order: each
 * top-level comment is followed immediately by its replies.
 *
 * AN UNKNOWN ID IS THIS SCREEN'S PROBLEM, not the router's.
 */
@Component({
  selector: 'awc-post-screen',
  standalone: true,
  imports: [
    RouterLink,
    ScreenComponent,
    PanelComponent,
    PanelSkeletonComponent,
    AvatarComponent,
    CountComponent,
    PersonNameComponent,
    PostActionsComponent,
    PostMediaComponent,
    WhenComponent,
    NotFoundScreen,
    SnackbarComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  template: `
    @if (!post || !author || !counts) {
      <awc-not-found-screen />
    } @else {
      <awc-screen
        [title]="t('social.screen.post.title')"
        [subtitle]="t('social.screen.post.subtitle', { name: author.displayName })"
        [customSkeleton]="true"
      >
        <awc-panel-skeleton skeleton height="620px" [lines]="8" />

        <div class="post-detail">
          <div class="post-detail__media"><awc-post-media [post]="post" [eager]="true" /></div>

          <div class="post-detail__side">
            <awc-panel>
              <header class="post-card__head">
                <!-- awc-person-name, not a second link: this row is already
                     one link, and an anchor inside an anchor is invalid. -->
                <a class="post-card__author" [routerLink]="appPath(route.person(author.handle))">
                  <awc-avatar [person]="author" size="small" [ring]="true" />
                  <span class="post-card__names">
                    <awc-person-name [person]="author" [showHandle]="true" />
                    @if (post.locationKey) {
                      <span class="post-card__place">{{ t(post.locationKey) }}</span>
                    }
                  </span>
                </a>
                <awc-when [at]="post.postedAt" />
              </header>

              <p class="post-card__caption">{{ t(post.captionKey) }}</p>

              <div class="row">
                @for (id of post.topics; track id) {
                  <md-chip
                    variant="assist"
                    appearance="outlined"
                    color="secondary"
                    [attr.label]="t('social.topic.' + id)"
                  ></md-chip>
                }
              </div>

              <awc-post-actions
                [liked]="liked"
                [saved]="saved"
                (like)="onLike()"
                (save)="onSave()"
                (share)="message = { key: 'social.msg.linkCopied' }"
              />

              <dl class="stat-row">
                <div>
                  <dt>{{ t('social.count.likes') }}</dt>
                  <dd><awc-count [value]="counts.likeCount" /></dd>
                </div>
                <div>
                  <dt>{{ t('social.count.comments') }}</dt>
                  <dd><awc-count [value]="counts.commentCount + added.length" /></dd>
                </div>
                <div>
                  <dt>{{ t('social.count.shares') }}</dt>
                  <dd><awc-count [value]="counts.shareCount" /></dd>
                </div>
                <div>
                  <dt>{{ t('social.count.saves') }}</dt>
                  <dd><awc-count [value]="counts.saveCount" /></dd>
                </div>
              </dl>
            </awc-panel>

            <awc-panel [title]="t('social.panel.comments')">
              <awc-count actions [value]="comments.length + added.length" />

              @if (post.commentsDisabled) {
                <p class="muted">{{ t('social.hint.commentsOff') }}</p>
              } @else if (comments.length === 0 && added.length === 0) {
                <div class="empty">
                  <p>{{ t('social.empty.comments') }}</p>
                  <p>{{ t('social.empty.commentsHint') }}</p>
                </div>
              } @else {
                <md-list
                  [attr.label]="t('social.panel.comments')"
                  interaction-mode="multi-action"
                  list-style="segmented"
                >
                  <!-- A reply is marked with data-reply and drawn as an elbow
                       by app.css; the word "Reply" rides in the trailing slot
                       as visually-hidden text, because a drawn line tells a
                       screen reader nothing. No overline: it cost a whole line,
                       so a reply stood taller than the comment it answered. -->
                  @for (comment of comments; track comment.id) {
                    <md-list-item
                      [attr.data-reply]="comment.replyToId ? '' : null"
                      [attr.headline]="personOf(comment).displayName"
                      [attr.supporting-text]="t(comment.bodyKey)"
                      lines="2"
                    >
                      <span slot="leading">
                        <awc-avatar [person]="personOf(comment)" size="small" />
                      </span>
                      <span slot="trailing" class="comment-trailing">
                        @if (comment.replyToId) {
                          <span class="visually-hidden">{{ t('social.action.reply') }}</span>
                        }
                        <awc-when [at]="comment.postedAt" />
                        <span class="comment-likes">
                          <span class="material-symbols-outlined" aria-hidden="true">favorite</span>
                          <awc-count [value]="comment.likeCount" />
                          <span class="visually-hidden">{{ t('social.count.likes') }}</span>
                        </span>
                      </span>
                    </md-list-item>
                  }

                  @for (body of added; track $index) {
                    <md-list-item
                      data-mine=""
                      [attr.headline]="t('social.common.you')"
                      [attr.supporting-text]="body"
                      lines="2"
                    ></md-list-item>
                  }
                </md-list>
              }

              @if (!post.commentsDisabled) {
                <div class="comment-compose">
                  <!-- OUTLINED, not the default filled. A filled field reserves
                       a band at the top for its label to float into — 28px
                       against 8px below, measured — and on a single-line box
                       that band is simply empty. -->
                  <md-text-field
                    variant="outlined"
                    [attr.label]="t('social.action.comment')"
                    [attr.value]="draft"
                    multiline="auto-grow"
                    rows="1"
                    full-width
                    (mdInput)="draft = $any($event).detail ?? ''"
                  ></md-text-field>
                  <md-button
                    variant="filled"
                    icon="send"
                    [attr.soft-disabled]="draft.trim() === '' ? '' : null"
                    (mdClick)="submit()"
                  >
                    {{ t('social.action.post') }}
                  </md-button>
                </div>
              }
            </awc-panel>
          </div>
        </div>

        <awc-snackbar [message]="message" [onClose]="close" />
      </awc-screen>
    }
  `,
})
export class PostScreen extends ShowcaseComponent {
  private readonly store = inject(EngagementService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  /* Comments the reader has added this session. They are not in the kit and
     never will be — the fixture is frozen — so they live here and vanish on a
     reload, the same contract every other override in this app has. */
  protected added: string[] = [];
  protected draft = '';

  protected message: SnackbarMessage | null = null;
  protected readonly close = () => {
    this.message = null;
  };

  protected get post() {
    const id = this.params()?.get('id');
    return id ? getPostById(decodeURIComponent(id)) : undefined;
  }
  protected get author(): Person | undefined {
    const post = this.post;
    return post ? getPersonById(post.authorId) : undefined;
  }
  protected get comments() {
    const post = this.post;
    return post ? getComments(post.id) : [];
  }
  protected get liked() {
    const post = this.post;
    return post ? this.store.isLiked(post) : false;
  }
  protected get saved() {
    const post = this.post;
    return post ? this.store.isSaved(post) : false;
  }
  protected get counts() {
    const post = this.post;
    return post ? engagement(post, this.liked, this.saved) : null;
  }

  protected personOf(comment: Comment): Person {
    return getPersonById(comment.authorId)!;
  }

  protected onLike() {
    const post = this.post;
    if (!post) return;
    this.message = this.store.toggleLike(post) ? { key: 'social.msg.liked' } : null;
  }

  protected onSave() {
    const post = this.post;
    if (!post) return;
    this.message = {
      key: this.store.toggleSave(post) ? 'social.msg.saved' : 'social.msg.unsaved',
    };
  }

  protected submit() {
    if (this.draft.trim() === '') return;
    this.added = [...this.added, this.draft.trim()];
    this.draft = '';
    this.message = { key: 'social.msg.posted' };
  }
}
