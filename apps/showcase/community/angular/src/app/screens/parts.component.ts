/**
 * The pieces more than one screen needs: a post's byline, its body, its
 * attachment, the comment thread, the right rail and the composer.
 *
 * ALL IN ONE FILE because they are one another's dependencies — the attachment
 * renders a byline and a body for a shared post, and splitting them across
 * files would be five imports describing one idea.
 */
import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AUDIENCES,
  REPLY_PAGE,
  RSVP_CHOICES,
  audienceIcon,
  commentTree,
  reactionSummary,
  resolve,
  rightRail,
  rsvpIcon,
  subtreeSize,
  type Audience,
  type CommunityEvent,
  type FeedItem,
  type Person,
  type Group,
  type Post,
  type ProfileSummary,
  type ReactionKind,
  type Rsvp,
  type ThreadNode,
} from '@awc-ui/showcase-kit/community';
import {
  AudienceMarkComponent,
  AvatarComponent,
  CountComponent,
  DateTextComponent,
  MediaComponent,
  ReactButtonComponent,
  ReactionSummaryComponent,
  RsvpChipComponent,
  TimeTextComponent,
  VerifiedComponent,
  WhenComponent,
} from '../components/bits.component';
import { PanelComponent } from '../components/panel.component';
import { EngagementService } from '../lib/engagement.service';
import { appPath, route } from '../lib/routes';
import { ShowcaseService } from '../lib/showcase.service';

/* ---------------------------------------------------------------- byline */

@Component({
  selector: 'awc-byline',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [RouterLink, AvatarComponent, VerifiedComponent, WhenComponent, AudienceMarkComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="post-card__head">
      <a class="post-card__author" [routerLink]="personPath">
        <awc-avatar [person]="item.author" [size]="compact ? 'small' : 'medium'"></awc-avatar>
      </a>
      <div class="post-card__names">
        <span class="post-card__in">
          <a class="post-card__author" [routerLink]="personPath">
            <span class="person-row__name">{{ item.author.displayName }}</span>
            <awc-verified [person]="item.author"></awc-verified>
          </a>
          @if (item.group) {
            <span aria-hidden="true">&rsaquo;</span>
            <a
              class="post-card__group"
              [routerLink]="groupPath"
              [attr.aria-label]="groupLabel"
              >{{ item.group.name }}</a
            >
          }
        </span>
        <span class="post-card__meta">
          <a class="when" [routerLink]="postPath">
            <awc-when [at]="item.post.postedAt"></awc-when>
          </a>
          <span aria-hidden="true">&middot;</span>
          <awc-audience-mark
            [audience]="item.post.audience"
            [labelKey]="item.post.audienceKey"
          ></awc-audience-mark>
          @if (item.post.pinned) {
            <span aria-hidden="true">&middot;</span>
            <span>{{ pinned }}</span>
          }
        </span>
      </div>
    </header>
  `,
})
export class BylineComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) item!: FeedItem;
  @Input() compact = false;

  protected get personPath() {
    return appPath(route.person(this.item.author.handle));
  }
  protected get groupPath() {
    return this.item.group ? appPath(route.group(this.item.group.slug)) : null;
  }
  protected get postPath() {
    return appPath(route.post(this.item.post.id));
  }
  protected get groupLabel() {
    return this.item.group
      ? this.showcase.t('community.hint.postedIn', { group: this.item.group.name })
      : null;
  }
  protected get pinned() {
    return this.showcase.t('community.hint.pinned');
  }
}

/* ------------------------------------------------------------------ body */

@Component({
  selector: 'awc-post-body',
  standalone: true,
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="post-card__body" [attr.data-clamped]="long && !expanded ? '' : null">{{ text }}</p>
    @if (long) {
      <button type="button" class="post-card__more" (click)="expanded = !expanded">
        {{ moreLabel }}
      </button>
    }
  `,
})
export class PostBodyComponent {
  /* Only decides whether to RENDER the control — the clamp itself is CSS, four
     lines of whatever this column holds. Deliberately generous: a button on an
     unclipped post is a small oddity, a missing one hides somebody's writing. */
  private static readonly LONG = 180;
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) post!: Post;
  protected expanded = false;

  protected get text() {
    return this.showcase.t(this.post.bodyKey);
  }
  protected get long() {
    return this.text.length > PostBodyComponent.LONG;
  }
  protected get moreLabel() {
    return this.showcase.t(
      this.expanded ? 'community.action.seeLess' : 'community.action.seeMore',
    );
  }
}

/* ------------------------------------------------------------ attachment */

@Component({
  selector: 'awc-post-attachment',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [RouterLink, MediaComponent, BylineComponent, PostBodyComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (item.post.media.length > 0) {
      <div class="post-photos" [attr.data-count]="item.post.media.length">
        @for (media of item.post.media; track media.id; let i = $index) {
          <a class="post-photos__cell" [routerLink]="postPath" [attr.aria-label]="alt(media.altKey)">
            <awc-media [media]="media" [eager]="!nested && i === 0"></awc-media>
          </a>
        }
      </div>
    } @else if (item.post.link) {
      <md-tooltip [attr.text]="notReal">
        <div class="link-card">
          <awc-media [media]="item.post.link.image" className="link-card__image"></awc-media>
          <div class="link-card__text">
            <span class="link-card__domain">{{ item.post.link.domain }}</span>
            <p class="link-card__title">{{ alt(item.post.link.titleKey) }}</p>
            <p class="link-card__about">{{ alt(item.post.link.descriptionKey) }}</p>
          </div>
        </div>
      </md-tooltip>
    } @else if (inner) {
      <div class="shared-post">
        <awc-byline [item]="inner" [compact]="true"></awc-byline>
        <awc-post-body [post]="inner.post"></awc-post-body>
        <awc-post-attachment [item]="inner" [nested]="true"></awc-post-attachment>
      </div>
    }
  `,
})
export class PostAttachmentComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) item!: FeedItem;
  @Input() nested = false;

  protected alt = (key: string) => this.showcase.t(key);
  protected get notReal() {
    return this.showcase.t('community.hint.linkNotReal');
  }
  protected get postPath() {
    return appPath(route.post(this.item.post.id));
  }
  /* The inner post shaped as a feed item so the same components render it. It
     NEVER carries actions or comments: those belong to the original. */
  protected get inner(): FeedItem | null {
    return this.item.shared
      ? {
          post: this.item.shared.post,
          author: this.item.shared.author,
          group: this.item.shared.group,
          shared: null,
          preview: [],
          hiddenComments: 0,
        }
      : null;
  }
}

/* ---------------------------------------------------------------- thread */

@Component({
  selector: 'awc-thread-branch',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [RouterLink, AvatarComponent, CountComponent, WhenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="thread__branch">
      <div
        class="comment"
        [attr.data-comment]="node.comment.id"
        [attr.data-depth]="node.comment.depth"
      >
        <a class="comment__avatar" [routerLink]="selfPath">
          <awc-avatar [person]="node.author" size="small"></awc-avatar>
        </a>

        <div>
          <div class="comment__bubble">
            @if (node.comment.depth === 2 && node.replyingTo) {
              <span class="comment__replying">{{ replyingTo }}</span>
            }
            <a class="comment__author" [routerLink]="selfPath">{{ node.author.displayName }}</a>
            <p class="comment__body">{{ body }}</p>
          </div>

          <div class="comment__foot">
            <awc-when [at]="node.comment.postedAt"></awc-when>
            <button
              type="button"
              class="comment__act"
              [attr.data-on]="mine ? '' : null"
              [attr.aria-pressed]="mine !== null"
              (click)="toggle()"
            >
              {{ likeLabel }}
            </button>
            @if (summary.total > 0) {
              <span class="comment__likes">
                <span class="material-symbols-outlined" aria-hidden="true">thumb_up</span>
                <awc-count [value]="summary.total"></awc-count>
                <span class="visually-hidden">{{ reactionsLabel }}</span>
              </span>
            }
          </div>
        </div>
      </div>

      @if (node.children.length > 0) {
        <div class="thread__children">
          @for (child of shown; track child.comment.id) {
            <awc-thread-branch [node]="child"></awc-thread-branch>
          }
          @if (expanded) {
            <button type="button" class="thread__toggle" (click)="expanded = false">
              {{ hideLabel }}
            </button>
          } @else if (hiddenCount > 0) {
            <button type="button" class="thread__toggle" (click)="expanded = true">
              {{ moreLabel }}
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ThreadBranchComponent {
  private readonly showcase = inject(ShowcaseService);
  private readonly engagement = inject(EngagementService);
  @Input({ required: true }) node!: ThreadNode;
  protected expanded = false;

  protected get mine() {
    return this.engagement.commentReactionFor(this.node.comment);
  }
  protected get summary() {
    return reactionSummary(
      this.node.comment.reactions,
      this.node.comment.viewerReaction,
      this.mine,
    );
  }
  protected get shown() {
    return this.expanded ? this.node.children : this.node.children.slice(0, REPLY_PAGE);
  }
  /* The WHOLE subtree, not the direct children: "3 more replies" that reveals
     three rows and then two more nested under them has undercounted. */
  protected get hiddenCount() {
    return this.node.children
      .slice(REPLY_PAGE)
      .reduce((total, child) => total + 1 + subtreeSize(child), 0);
  }
  protected get selfPath() {
    return this.node.author.friendship === 'self'
      ? appPath(route.profile())
      : appPath(route.person(this.node.author.handle));
  }
  protected get body() {
    return this.showcase.t(this.node.comment.bodyKey);
  }
  protected get replyingTo() {
    return this.showcase.t('community.hint.replyingTo', {
      name: this.node.replyingTo?.displayName ?? '',
    });
  }
  protected get likeLabel() {
    return this.showcase.t('community.reaction.like');
  }
  protected get reactionsLabel() {
    return this.showcase.t('community.count.reactions');
  }
  protected get hideLabel() {
    return this.showcase.t('community.action.hideReplies');
  }
  protected get moreLabel() {
    return this.hiddenCount === 1
      ? this.showcase.t('community.action.viewRepliesOne')
      : this.showcase.t('community.action.viewReplies', {
          count: this.showcase.t.formatNumber(this.hiddenCount),
        });
  }
  protected toggle(): void {
    this.engagement.setCommentReaction(this.node.comment, this.mine ? null : 'like');
  }
}

@Component({
  selector: 'awc-comment-thread',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [ThreadBranchComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="thread">
      @if (roots.length === 0 && added.length === 0) {
        <div class="empty">
          <p>{{ emptyTitle }}</p>
          <p>{{ emptyHint }}</p>
        </div>
      } @else {
        @for (node of roots; track node.comment.id) {
          <awc-thread-branch [node]="node"></awc-thread-branch>
        }
      }

      @for (body of added; track $index) {
        <div class="comment" data-mine="">
          <div>
            <div class="comment__bubble">
              <span class="comment__author">{{ youLabel }}</span>
              <p class="comment__body">{{ body }}</p>
            </div>
          </div>
        </div>
      }

      <div class="comment-compose">
        <md-text-field
          variant="outlined"
          [attr.label]="commentLabel"
          [attr.value]="draft"
          multiline="auto-grow"
          rows="1"
          full-width
          (mdInput)="onInput($event)"
        ></md-text-field>
        <md-button
          variant="filled"
          icon="send"
          [attr.soft-disabled]="draft.trim() === '' ? '' : null"
          (mdClick)="post()"
          >{{ postLabel }}</md-button
        >
      </div>
    </div>
  `,
})
export class CommentThreadComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) postId!: string;
  @Output() readonly message = new EventEmitter<{
    key: string | null;
    params?: Record<string, string | number>;
  }>();

  protected added: string[] = [];
  protected draft = '';

  protected get roots() {
    return commentTree(this.postId);
  }
  protected get emptyTitle() {
    return this.showcase.t('community.empty.comments');
  }
  protected get emptyHint() {
    return this.showcase.t('community.empty.commentsHint');
  }
  protected get youLabel() {
    return this.showcase.t('community.common.you');
  }
  protected get commentLabel() {
    return this.showcase.t('community.action.comment');
  }
  protected get postLabel() {
    return this.showcase.t('community.action.post');
  }

  /* mdInput carries the BARE STRING as its detail, not a {value}. Binding the
     native input event instead is silent: the draft stays empty for ever. */
  protected onInput(event: Event): void {
    this.draft = String((event as CustomEvent<string>).detail ?? '');
  }

  protected post(): void {
    if (this.draft.trim() === '') return;
    this.added = [...this.added, this.draft.trim()];
    this.draft = '';
    this.message.emit({ key: 'community.msg.commentPosted' });
  }
}

/* ------------------------------------------------------------- post card */

@Component({
  selector: 'awc-post-card',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [
    PanelComponent,
    BylineComponent,
    PostBodyComponent,
    PostAttachmentComponent,
    ReactionSummaryComponent,
    ReactButtonComponent,
    CommentThreadComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <awc-panel>
      <article class="post-card" [attr.data-post]="item.post.id">
        @if (item.shared) {
          <p class="post-card__meta">{{ sharedLine }}</p>
        }

        <awc-byline [item]="item"></awc-byline>
        <awc-post-body [post]="item.post"></awc-post-body>
        <awc-post-attachment [item]="item"></awc-post-attachment>

        <awc-reaction-summary
          [summary]="summary"
          [commentCount]="item.post.commentCount"
          [shareCount]="item.post.shareCount"
          (openComments)="open = true"
        ></awc-reaction-summary>

        <div class="post-actions">
          <awc-react-button [mine]="mine" (pick)="react($event)"></awc-react-button>
          <md-button
            variant="text"
            icon="mode_comment"
            [attr.aria-expanded]="open"
            (mdClick)="open = !open"
            >{{ commentLabel }}</md-button
          >
          <md-button variant="text" icon="share" (mdClick)="share()">{{ shareLabel }}</md-button>
        </div>

        @if (open) {
          @if (item.post.commentsDisabled) {
            <p class="muted">{{ commentsOff }}</p>
          } @else {
            <awc-comment-thread
              [postId]="item.post.id"
              (message)="message.emit($event)"
            ></awc-comment-thread>
          }
        }
      </article>
    </awc-panel>
  `,
})
export class PostCardComponent {
  private readonly showcase = inject(ShowcaseService);
  private readonly engagement = inject(EngagementService);
  @Input({ required: true }) item!: FeedItem;
  @Input() showComments = false;
  @Output() readonly message = new EventEmitter<{
    key: string | null;
    params?: Record<string, string | number>;
  }>();

  protected open = false;
  ngOnInit(): void {
    this.open = this.showComments;
  }

  protected get mine() {
    return this.engagement.reactionFor(this.item.post);
  }
  protected get summary() {
    return reactionSummary(this.item.post.reactions, this.item.post.viewerReaction, this.mine);
  }
  protected get sharedLine() {
    return this.showcase.t(
      this.item.shared?.group
        ? 'community.hint.sharedGroupPost'
        : 'community.hint.sharedPost',
      { name: this.item.author.displayName, group: this.item.shared?.group?.name ?? '' },
    );
  }
  protected get commentLabel() {
    return this.showcase.t('community.action.comment');
  }
  protected get shareLabel() {
    return this.showcase.t('community.action.share');
  }
  protected get commentsOff() {
    return this.showcase.t('community.hint.commentsOff');
  }

  protected react(next: ReactionKind | null): void {
    const before = this.summary.total;
    this.engagement.setReaction(this.item.post, next);
    /* Reacting announces; taking it back does not — un-reacting is its own
       confirmation, the button goes grey. */
    this.message.emit({
      key: next ? 'community.reaction.summary' : null,
      params: { count: before + (next ? 1 : 0) },
    });
  }
  protected share(): void {
    this.message.emit({ key: 'community.msg.linkCopied' });
  }
}

/* -------------------------------------------------------------- timeline */

@Component({
  selector: 'awc-timeline',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [PostCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (post of posts; track post.id) {
      <awc-post-card [item]="itemFor(post)" (message)="message.emit($event)"></awc-post-card>
    }
  `,
})
export class TimelineComponent {
  @Input({ required: true }) posts!: Post[];
  @Output() readonly message = new EventEmitter<{
    key: string | null;
    params?: Record<string, string | number>;
  }>();
  /* `resolve()` is the same join `feedItems()` does, exposed for exactly this. */
  protected itemFor = (post: Post) => resolve(post);
}

/* ------------------------------------------------------------ event rows */

@Component({
  selector: 'awc-event-rail-row',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [RouterLink, DateTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="rail-row" [routerLink]="path">
      <span class="material-symbols-outlined" aria-hidden="true">event</span>
      <span class="rail-row__text">
        <span class="rail-row__name">{{ event.name }}</span>
        <span class="rail-row__meta"><awc-date-text [at]="event.startsAt"></awc-date-text></span>
      </span>
    </a>
  `,
})
export class EventRailRowComponent {
  /* A SECOND PRESENTATION, NOT A NARROWER FIRST ONE: a 300px rail cannot hold
     the list row's three tracks, and a rail states what is coming up rather
     than offering to answer it. */
  @Input({ required: true }) event!: CommunityEvent;
  protected get path() {
    return appPath(route.event(this.event.slug));
  }
}

/* ------------------------------------------------------------ right rail */

@Component({
  selector: 'awc-right-rail',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [RouterLink, PanelComponent, AvatarComponent, EventRailRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rail.birthdays.length > 0) {
      <awc-panel [title]="birthdaysLabel">
        <div class="rail-block">
          @for (person of rail.birthdays; track person.id) {
            <a class="rail-row" [routerLink]="personPath(person)">
              <span class="material-symbols-outlined" aria-hidden="true">cake</span>
              <span class="rail-row__text">
                <span class="rail-row__name">{{ person.displayName }}</span>
              </span>
            </a>
          }
          <span class="rail-row__meta">{{ todayLabel }}</span>
        </div>
      </awc-panel>
    }

    @if (rail.events.length > 0) {
      <awc-panel [title]="upcomingLabel">
        <div class="rail-block">
          @for (event of rail.events; track event.id) {
            <awc-event-rail-row [event]="event"></awc-event-rail-row>
          }
        </div>
      </awc-panel>
    }

    <awc-panel [title]="contactsLabel">
      <div class="rail-block">
        @for (person of rail.contacts; track person.id) {
          <a class="rail-row" [routerLink]="personPath(person)">
            <awc-avatar [person]="person" size="small"></awc-avatar>
            <span class="rail-row__text">
              <span class="rail-row__name">{{ person.displayName }}</span>
            </span>
          </a>
        }
      </div>
    </awc-panel>
  `,
})
export class RightRailComponent {
  /* THERE IS NO PRESENCE AND NO "ACTIVE NOW" DOT: nobody is online, there is no
     socket, and a green dot that is always on says something false. */
  private readonly showcase = inject(ShowcaseService);
  protected readonly rail = rightRail();
  protected personPath = (person: Person) => appPath(route.person(person.handle));
  protected get birthdaysLabel() {
    return this.showcase.t('community.panel.birthdays');
  }
  protected get todayLabel() {
    return this.showcase.t('community.hint.birthdayToday');
  }
  protected get upcomingLabel() {
    return this.showcase.t('community.panel.upcoming');
  }
  protected get contactsLabel() {
    return this.showcase.t('community.panel.contacts');
  }
}

/* -------------------------------------------------------------- composer */

@Component({
  selector: 'awc-composer',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [AvatarComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!open) {
      <div class="composer">
        <awc-avatar [person]="viewer" size="medium"></awc-avatar>
        <button type="button" class="composer__trigger" (click)="open = true">
          {{ triggerLabel }}
        </button>
      </div>
    } @else {
      <div class="composer__open">
        <div class="composer">
          <awc-avatar [person]="viewer" size="medium"></awc-avatar>
          <span class="post-card__names">
            <span class="post-card__name">{{ viewer.displayName }}</span>
            <span class="post-card__meta">
              <span class="material-symbols-outlined" aria-hidden="true">{{ glyph }}</span>
              {{ audienceLabel }}
            </span>
          </span>
        </div>

        <md-text-field
          variant="outlined"
          [attr.label]="composeLabel"
          [attr.value]="body"
          multiline="auto-grow"
          rows="3"
          full-width
          (mdInput)="onInput($event)"
        ></md-text-field>

        <div class="composer__foot">
          @for (option of audiences; track option.value) {
            <md-chip
              variant="filter"
              appearance="outlined"
              [attr.icon]="iconFor(option.value)"
              [attr.label]="label(option.labelKey)"
              [attr.selected]="audience === option.value ? '' : null"
              (click)="audience = option.value"
            ></md-chip>
          }
          <span class="composer__spacer"></span>
          <md-button variant="text" (mdClick)="cancel()">{{ cancelLabel }}</md-button>
          <md-button
            variant="filled"
            icon="send"
            [attr.soft-disabled]="body.trim() === '' ? '' : null"
            (mdClick)="post()"
            >{{ postLabel }}</md-button
          >
        </div>
      </div>
    }
  `,
})
export class ComposerComponent {
  /* A TRIGGER UNTIL IT IS PRESSED, which is why this vertical has no Create
     destination: an open textarea costs 180px at the top of every visit. */
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) viewer!: Person;
  @Output() readonly message = new EventEmitter<{
    key: string | null;
    params?: Record<string, string | number>;
  }>();

  protected open = false;
  protected body = '';
  protected audience: Audience = 'friends';
  protected readonly audiences = AUDIENCES;
  protected iconFor = (value: Audience) => audienceIcon[value];
  protected label = (key: string) => this.showcase.t(key);

  protected get glyph() {
    return audienceIcon[this.audience];
  }
  protected get audienceLabel() {
    const spec = AUDIENCES.find((a) => a.value === this.audience);
    return spec ? this.showcase.t(spec.labelKey) : '';
  }
  protected get triggerLabel() {
    return this.showcase.t('community.action.writeSomething', {
      name: this.viewer.displayName.split(' ')[0],
    });
  }
  protected get composeLabel() {
    return this.showcase.t('community.panel.compose');
  }
  protected get cancelLabel() {
    return this.showcase.t('community.action.cancel');
  }
  protected get postLabel() {
    return this.showcase.t('community.action.post');
  }

  protected onInput(event: Event): void {
    this.body = String((event as CustomEvent<string>).detail ?? '');
  }
  protected cancel(): void {
    this.open = false;
    this.body = '';
  }
  protected post(): void {
    if (this.body.trim() === '') {
      this.message.emit({ key: 'community.hint.needBody' });
      return;
    }
    this.message.emit({ key: 'community.msg.posted' });
    this.body = '';
    this.open = false;
  }
}

/* --------------------------------------------------------------- profile */

@Component({
  selector: 'awc-profile-header',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [PanelComponent, AvatarComponent, CountComponent, MediaComponent, VerifiedComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <awc-panel>
      <div class="profile-head">
        <awc-media
          [media]="summary.person.cover"
          className="profile-head__cover"
          [eager]="true"
        ></awc-media>
        <div class="profile-head__row">
          <span class="profile-head__avatar">
            <awc-avatar [person]="summary.person" size="large"></awc-avatar>
          </span>
          <div class="profile-head__text">
            <h2 class="profile-head__name">
              {{ summary.person.displayName }}
              <awc-verified [person]="summary.person"></awc-verified>
            </h2>
            <span class="profile-head__handle">&#64;{{ summary.person.handle }}</span>
          </div>
          <div class="profile-head__action"><ng-content select="[action]"></ng-content></div>
        </div>
      </div>

      <dl class="stat-row">
        <div>
          <dt>{{ label('community.count.friends') }}</dt>
          <dd><awc-count [value]="summary.person.friendCount"></awc-count></dd>
        </div>
        <div>
          <dt>{{ label('community.count.posts') }}</dt>
          <dd><awc-count [value]="summary.posts.length"></awc-count></dd>
        </div>
        <div>
          <dt>{{ label('community.count.reactions') }}</dt>
          <dd><awc-count [value]="summary.reactionsReceived" [compact]="true"></awc-count></dd>
        </div>
        @if (summary.person.friendship !== 'self') {
          <div>
            <dt>{{ label('community.count.mutualLabel') }}</dt>
            <dd><awc-count [value]="summary.person.mutualCount"></awc-count></dd>
          </div>
        }
      </dl>
    </awc-panel>
  `,
})
export class ProfileHeaderComponent {
  /* The avatar overlaps the cover by a negative margin rather than absolute
     positioning — out of flow, the text needs a hard-coded push that is wrong
     at every other avatar size. */
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) summary!: ProfileSummary;
  protected label = (key: string) => this.showcase.t(key);
}

@Component({
  selector: 'awc-about-panel',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [RouterLink, PanelComponent, DateTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <awc-panel [title]="label('community.panel.about')">
      <div class="profile-facts">
        <p class="profile-fact">{{ label(summary.person.bioKey) }}</p>
        @if (summary.person.workKey) {
          <p class="profile-fact">
            <span class="material-symbols-outlined" aria-hidden="true">work</span
            >{{ label(summary.person.workKey) }}
          </p>
        }
        @if (summary.person.locationKey) {
          <p class="profile-fact">
            <span class="material-symbols-outlined" aria-hidden="true">place</span
            >{{ label(summary.person.locationKey) }}
          </p>
        }
        <p class="profile-fact">
          <span class="material-symbols-outlined" aria-hidden="true">schedule</span
          >{{ joined }}<awc-date-text
            [at]="summary.person.joinedAt"
            format="long"
          ></awc-date-text>
        </p>
      </div>

      @if (summary.sharedGroups.length > 0) {
        <p class="muted">{{ label('community.panel.sharedGroups') }}</p>
        <div class="row">
          @for (group of summary.sharedGroups; track group.id) {
            <a class="post-card__group" [routerLink]="groupPath(group)">{{ group.name }}</a>
          }
        </div>
      }
    </awc-panel>
  `,
})
export class AboutPanelComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) summary!: ProfileSummary;
  protected label = (key: string) => this.showcase.t(key);
  protected groupPath = (group: Group) => appPath(route.group(group.slug));
  protected get joined() {
    return this.showcase.t('community.hint.joinedCorvus', { date: '' });
  }
}

@Component({
  selector: 'awc-photo-panel',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [RouterLink, PanelComponent, CountComponent, MediaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (summary.photos.length > 0) {
      <awc-panel [title]="label('community.panel.photos')">
        <awc-count actions [value]="summary.photos.length"></awc-count>
        <div class="photo-grid">
          @for (photo of summary.photos; track photo.media.id) {
            <a
              class="photo-grid__cell"
              [routerLink]="postPath(photo.postId)"
              [attr.aria-label]="label(photo.media.altKey)"
            >
              <awc-media [media]="photo.media"></awc-media>
            </a>
          }
        </div>
      </awc-panel>
    }
  `,
})
export class PhotoPanelComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) summary!: ProfileSummary;
  protected label = (key: string) => this.showcase.t(key);
  protected postPath = (id: string) => appPath(route.post(id));
}

/* ---------------------------------------------------------- event pieces */

@Component({
  selector: 'awc-event-date',
  standalone: true,
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <time class="event-date" [attr.datetime]="at">
      <span class="event-date__month">{{ month }}</span>
      <span class="event-date__day">{{ day }}</span>
    </time>
  `,
})
export class EventDateComponent {
  /* Month over day, fixed width, so every row's dates line up down the column.
     A date inside a paragraph cannot be SCANNED. */
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) at!: string;
  protected get month() {
    return new Intl.DateTimeFormat(this.showcase.t.locale, {
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(this.at));
  }
  protected get day() {
    return new Intl.DateTimeFormat(this.showcase.t.locale, {
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(this.at));
  }
}

@Component({
  selector: 'awc-event-row',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [RouterLink, CountComponent, RsvpChipComponent, TimeTextComponent, EventDateComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="event-row" [attr.data-event]="event.id">
      <awc-event-date [at]="event.startsAt"></awc-event-date>
      <div class="event-row__text">
        <a class="event-row__name" [routerLink]="path">{{ event.name }}</a>
        <span class="event-row__meta">
          <awc-time-text [at]="event.startsAt"></awc-time-text>
          <span aria-hidden="true">&middot;</span>
          <span class="material-symbols-outlined" aria-hidden="true">{{ placeGlyph }}</span>
          {{ placeText }}
        </span>
        <span class="event-row__counts">
          <awc-count [value]="event.goingCount"></awc-count>
          {{ goingWord }}{{ friendsText }}
        </span>
        <span class="row"><awc-rsvp-chip [rsvp]="rsvp"></awc-rsvp-chip></span>
      </div>

      <span class="event-row__action row">
        @for (choice of choices; track choice) {
          <md-icon-button
            [attr.icon]="rsvpGlyph(choice)"
            [attr.data-rsvp]="choice"
            [attr.data-on]="rsvp === choice ? '' : null"
            [attr.color]="rsvp === choice ? 'primary' : null"
            [attr.aria-label]="label('community.rsvp.' + choice)"
            [attr.aria-pressed]="rsvp === choice"
            (mdClick)="answer(choice)"
          ></md-icon-button>
        }
      </span>
    </div>
  `,
})
export class EventRowComponent {
  private readonly showcase = inject(ShowcaseService);
  private readonly engagement = inject(EngagementService);
  @Input({ required: true }) event!: CommunityEvent;
  @Output() readonly message = new EventEmitter<{
    key: string | null;
    params?: Record<string, string | number>;
  }>();

  /* THREE CHOICES, NOT FIVE: `invited` is a state somebody else put the reader
     in, and `none` is the absence of an answer rather than one. */
  protected readonly choices = RSVP_CHOICES;
  protected label = (key: string) => this.showcase.t(key);
  protected rsvpGlyph = (choice: Rsvp) => rsvpIcon[choice];

  protected get rsvp() {
    return this.engagement.rsvpFor(this.event);
  }
  protected get path() {
    return appPath(route.event(this.event.slug));
  }
  protected get placeGlyph() {
    return this.event.online ? 'videocam' : 'place';
  }
  protected get placeText() {
    return this.event.online
      ? this.showcase.t('community.hint.online')
      : this.showcase.t(this.event.placeKey ?? 'community.common.na');
  }
  protected get goingWord() {
    return this.showcase.t('community.count.going').toLocaleLowerCase(this.showcase.t.locale);
  }
  protected get friendsText() {
    if (this.event.friendsGoingCount === 0) return '';
    const t = this.showcase.t;
    return (
      ' · ' +
      (this.event.friendsGoingCount === 1
        ? t('community.hint.friendsGoingOne')
        : t('community.hint.friendsGoing', {
            count: t.formatNumber(this.event.friendsGoingCount),
          }))
    );
  }

  protected answer(choice: Rsvp): void {
    const next = this.rsvp === choice ? 'none' : choice;
    this.engagement.setRsvp(this.event, next);
    this.message.emit({
      key:
        next === 'going'
          ? 'community.msg.rsvpGoing'
          : next === 'interested'
            ? 'community.msg.rsvpInterested'
            : next === 'declined'
              ? 'community.msg.rsvpDeclined'
              : null,
      params: { name: this.event.name },
    });
  }
}
