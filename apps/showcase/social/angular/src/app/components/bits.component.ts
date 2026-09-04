import { Component, CUSTOM_ELEMENTS_SCHEMA, EventEmitter, Input, Output } from '@angular/core';
import {
  accountKindTone,
  activityIcon,
  activityTone,
  countOptions,
  followAction,
  postKindIcon,
  REPORTING_INSTANT,
  type ActivityKind,
  type Media,
  type Person,
  type Post,
} from '@awc-ui/showcase-kit/social';
import { RouterLink } from '@angular/router';
import { ShowcaseComponent } from '../lib/screen.base';

/**
 * The small, repeated pieces, in one file — the same arrangement the three
 * verticals next door use, and for the same reason: fourteen files of six lines
 * each is fourteen import statements at every call site.
 *
 * EVERY ATTRIBUTE ON AN `md-*` ELEMENT IS AN `[attr.x]` BINDING. A plain
 * `[x]="…"` sets a PROPERTY, which a lazily-upgraded custom element does not
 * have yet at first paint — the value is dropped and never reappears. The
 * exceptions are the object-valued props (`series`, `data`), which have no
 * attribute form at all; this vertical has none of those.
 *
 * AND EVERY WRAPPER FORWARDS WHAT IT IS GIVEN. An attribute written on
 * `<awc-avatar>` stays on THAT host and never reaches the `md-avatar` inside
 * it — the banking port lost a donut's `inner-radius`, a chart's accessible
 * name and four size classes to exactly this. Anything a caller needs to set is
 * an `@Input` here.
 */

/* ------------------------------------------------------------- formatting */

/**
 * A count.
 *
 * COMPACT ABOVE A THOUSAND, EXACT BELOW IT, and `exact` forces the long form
 * where the reader would dispute the rounding — a follower total on a profile
 * header is a number people check, a like count on a feed post is not.
 */
@Component({
  selector: 'awc-count',
  standalone: true,
  styles: ':host { display: contents; }',
  template: `<span class="num">{{
    t.formatNumber(value, countOptions(value, exact ? 'exact' : 'compact'))
  }}</span>`,
})
export class CountComponent extends ShowcaseComponent {
  @Input({ required: true }) value!: number;
  @Input() exact = false;
  protected readonly countOptions = countOptions;
}

/**
 * How long ago, in words, inside a `<time>` that still carries the instant.
 *
 * THE MACHINE-READABLE VALUE SURVIVES: "3h ago" is useless to anything parsing
 * the page, so the ISO instant stays in `datetime` and the `title` carries the
 * full date. Measured against `REPORTING_INSTANT`, never the clock.
 */
@Component({
  selector: 'awc-when',
  standalone: true,
  styles: ':host { display: contents; }',
  template: `<time
    [attr.datetime]="at"
    [attr.title]="t.formatDate(at.slice(0, 10), 'long')"
    class="when"
    >{{ t.formatRelativeTime(at, instant, { style: style }) }}</time
  >`,
})
export class WhenComponent extends ShowcaseComponent {
  @Input({ required: true }) at!: string;
  @Input() style: 'narrow' | 'short' | 'long' = 'narrow';
  protected readonly instant = REPORTING_INSTANT;
}

/* ------------------------------------------------------------------ chips */

@Component({
  selector: 'awc-state-chip',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<md-chip
    variant="assist"
    [attr.appearance]="appearance"
    [attr.color]="color"
    [attr.icon]="icon"
    [attr.label]="t(labelKey)"
  ></md-chip>`,
})
export class StateChipComponent extends ShowcaseComponent {
  @Input({ required: true }) labelKey!: string;
  @Input() color?: string;
  @Input() icon?: string;
  @Input() appearance = 'outlined';
}

@Component({
  selector: 'awc-topic-chip',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  // `selected ? '' : null` — a boolean attribute is read by PRESENCE, and
  // `selected="false"` reads as true. `null` removes it.
  template: `<md-chip
    variant="filter"
    appearance="outlined"
    [attr.data-topic]="id"
    [attr.selected]="selected ? '' : null"
    [attr.label]="t('social.topic.' + id)"
  ></md-chip>`,
})
export class TopicChipComponent extends ShowcaseComponent {
  @Input({ required: true }) id!: string;
  @Input() selected = false;
}

@Component({
  selector: 'awc-account-kind-chip',
  standalone: true,
  imports: [StateChipComponent],
  styles: ':host { display: contents; }',
  template: `@if (tone) {
    <awc-state-chip [labelKey]="person.kindKey" [color]="tone" />
  }`,
})
export class AccountKindChipComponent {
  @Input({ required: true }) person!: Person;
  /** `personal` earns no chip — see the kit's tone map. */
  protected get tone(): string | null {
    return accountKindTone[this.person.kind];
  }
}

/* ----------------------------------------------------------------- people */

/**
 * An avatar, with the story ring when there is a story behind it.
 *
 * THE RING IS A CLASS, NOT A BORDER PROP. `md-avatar` has no ring of its own,
 * and giving it one with a `style` attribute would be refused outright by the
 * deployed Content-Security-Policy (`style-src-attr 'none'`).
 */
@Component({
  selector: 'awc-avatar',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <span class="avatar" [attr.data-ring]="state">
      <md-avatar
        [attr.src]="person.avatar"
        [attr.name]="person.displayName"
        [attr.initials]="person.initials"
        [attr.size]="size"
        [attr.label]="person.displayName"
        [attr.alt]="t('social.alt.arcs')"
      ></md-avatar>
      @if (state !== 'none') {
        <span class="visually-hidden">{{
          t(state === 'unseen' ? 'social.hint.storyUnseen' : 'social.hint.storySeen')
        }}</span>
      }
    </span>
  `,
})
export class AvatarComponent extends ShowcaseComponent {
  @Input({ required: true }) person!: Person;
  @Input() size: 'small' | 'medium' | 'large' = 'small';
  @Input() ring = false;

  protected get state(): 'none' | 'unseen' | 'seen' {
    if (!this.ring) return 'none';
    return this.person.storyUnseen ? 'unseen' : this.person.hasStory ? 'seen' : 'none';
  }
}

@Component({
  selector: 'awc-verified',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `@if (person.verified) {
    <md-tooltip [attr.text]="t('social.verified')">
      <span class="verified material-symbols-outlined" role="img" [attr.aria-label]="t('social.verified')"
        >verified</span
      >
    </md-tooltip>
  }`,
})
export class VerifiedComponent extends ShowcaseComponent {
  @Input({ required: true }) person!: Person;
}

/**
 * A person's name, tick and optional handle — WITH NO ANCHOR.
 *
 * Two callers are already links themselves. A post card's header wraps the
 * avatar AND the name in one target, and putting a link inside it produces an
 * `<a>` inside an `<a>`: invalid HTML that a framework builds happily and a
 * screen reader reads as two overlapping links.
 */
@Component({
  selector: 'awc-person-name',
  standalone: true,
  imports: [VerifiedComponent],
  styles: ':host { display: contents; }',
  template: `
    <span class="person-link__name">{{ person.displayName }}</span>
    <awc-verified [person]="person" />
    @if (showHandle) {
      <span class="person-link__handle">&#64;{{ person.handle }}</span>
    }
  `,
})
export class PersonNameComponent {
  @Input({ required: true }) person!: Person;
  @Input() showHandle = false;
}

/**
 * The follow button, in whichever of its four states applies.
 *
 * `toggle` emits the state the caller should move TO. The button holds none of
 * its own: the screen owns the override, so a reload is a reset.
 */
@Component({
  selector: 'awc-follow-button',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `@if (action; as a) {
    <md-button
      [attr.variant]="a.variant"
      [attr.size]="size"
      [attr.icon]="a.icon"
      (mdClick)="toggle.emit(!following)"
    >
      {{ t(a.labelKey) }}
    </md-button>
  }`,
})
export class FollowButtonComponent extends ShowcaseComponent {
  @Input({ required: true }) person!: Person;
  @Input({ required: true }) following!: boolean;
  @Input() size: 'sm' | 'md' = 'sm';
  @Output() toggle = new EventEmitter<boolean>();

  /* The kit's table answers for the FIXTURE's relationship; a viewer who has
     since pressed the button is either following or not, and those are the only
     two states reachable after an override. */
  protected get action() {
    const knownBoth =
      this.person.relationship === 'follower' || this.person.relationship === 'mutual';
    return this.following
      ? followAction[knownBoth ? 'mutual' : 'following']
      : followAction[knownBoth ? 'follower' : 'none'];
  }
}

/* ------------------------------------------------------------------ media */

/**
 * One picture, in a box whose height is reserved before it decodes.
 *
 * THIS IS THE WHOLE REASON THIS COMPONENT EXISTS. A feed that lets images size
 * themselves reflows every post below the one that just arrived. The aspect
 * ratio is known at build time, travels on the record, and is applied from a
 * CLASS (`data-aspect`) rather than an inline style, because
 * `style-src-attr 'none'` refuses the latter outright.
 */
@Component({
  selector: 'awc-media',
  standalone: true,
  styles: ':host { display: contents; }',
  template: `<img
    [class]="className ? 'media ' + className : 'media'"
    [attr.data-aspect]="media.aspect"
    [attr.src]="media.src"
    [attr.alt]="t(media.altKey)"
    [attr.loading]="eager ? 'eager' : 'lazy'"
    decoding="async"
    [attr.draggable]="false"
  />`,
})
export class MediaComponent extends ShowcaseComponent {
  @Input({ required: true }) media!: Media;
  @Input() className?: string;
  @Input() eager = false;
}

/**
 * A post's pictures: one image, or a pager over several.
 *
 * `href` PUTS THE ANCHOR AROUND THE IMAGE ONLY, and that is the whole reason it
 * is an input here rather than a wrapper at the call site. The feed card
 * wrapped this component in a link, which put the two pager buttons inside an
 * anchor — so paging to the next picture navigated to the post instead.
 */
@Component({
  selector: 'awc-post-media',
  standalone: true,
  imports: [MediaComponent, RouterLink],
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="post-media">
      @if (href) {
        <a class="post-media__link" [routerLink]="href">
          <awc-media [media]="current" [eager]="eager" />
        </a>
      } @else {
        <awc-media [media]="current" [eager]="eager" />
      }

      @if (post.kind === 'video' && current.durationSec !== null) {
        <span class="post-media__duration on-media">
          <span class="material-symbols-outlined" aria-hidden="true">{{ playIcon }}</span>
          {{ t('social.hint.videoDuration', { seconds: t.formatNumber(current.durationSec!) }) }}
        </span>
      }

      @if (post.media.length > 1) {
        <md-icon-button
          class="post-media__nav post-media__nav--prev"
          icon="chevron_left"
          [attr.aria-label]="t('social.action.previous')"
          [attr.soft-disabled]="index === 0 ? '' : null"
          (mdClick)="index = index - 1"
        ></md-icon-button>
        <md-icon-button
          class="post-media__nav post-media__nav--next"
          icon="chevron_right"
          [attr.aria-label]="t('social.action.next')"
          [attr.soft-disabled]="index === post.media.length - 1 ? '' : null"
          (mdClick)="index = index + 1"
        ></md-icon-button>
        <div class="post-media__dots" role="status">
          <span class="visually-hidden">{{
            t('social.postKind.carouselCount', { index: index + 1, total: post.media.length })
          }}</span>
          @for (item of post.media; track item.id; let i = $index) {
            <span class="post-media__dot" [attr.data-on]="i === index ? '' : null"></span>
          }
        </div>
      }
    </div>
  `,
})
export class PostMediaComponent extends ShowcaseComponent {
  @Input({ required: true }) set post(value: Post) {
    this._post = value;
    /* Reset when the post changes: a pager left on picture 4 of a post that has
       since been replaced by one with two pictures is the bug this avoids. */
    this.index = 0;
  }
  get post(): Post {
    return this._post;
  }
  private _post!: Post;

  @Input() eager = false;
  @Input() href?: string;

  protected index = 0;
  protected readonly playIcon = postKindIcon.video;

  protected get current(): Media {
    return this.post.media[Math.min(this.index, this.post.media.length - 1)];
  }
}

/* ---------------------------------------------------------------- actions */

/**
 * The row under a post: like, comment, share, save.
 *
 * THE HEART IS THE ONLY COLOURED CONTROL, and only when it is on. Every button
 * carries a real accessible name saying what pressing it will DO — "Like" when
 * off, "Unlike" when on — rather than naming the icon.
 */
@Component({
  selector: 'awc-post-actions',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="post-actions">
      <md-icon-button
        class="post-actions__like"
        [attr.icon]="liked ? 'favorite' : 'favorite_border'"
        [attr.color]="liked ? 'error' : null"
        [attr.data-on]="liked ? '' : null"
        [attr.aria-label]="t(liked ? 'social.action.unlike' : 'social.action.like')"
        (mdClick)="like.emit()"
      ></md-icon-button>
      <md-icon-button
        icon="mode_comment"
        [attr.aria-label]="t('social.action.comment')"
        (mdClick)="comment.emit()"
      ></md-icon-button>
      <md-icon-button
        icon="send"
        [attr.aria-label]="t('social.action.share')"
        (mdClick)="share.emit()"
      ></md-icon-button>
      <span class="post-actions__spacer"></span>
      <md-icon-button
        [attr.icon]="saved ? 'bookmark' : 'bookmark_border'"
        [attr.data-on]="saved ? '' : null"
        [attr.aria-label]="t(saved ? 'social.action.unsave' : 'social.action.save')"
        (mdClick)="save.emit()"
      ></md-icon-button>
    </div>
  `,
})
export class PostActionsComponent extends ShowcaseComponent {
  @Input({ required: true }) liked!: boolean;
  @Input({ required: true }) saved!: boolean;
  @Output() like = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() comment = new EventEmitter<void>();
  @Output() share = new EventEmitter<void>();
}

/* --------------------------------------------------------------- activity */

@Component({
  selector: 'awc-activity-icon',
  standalone: true,
  styles: ':host { display: contents; }',
  template: `<span class="activity-icon" [attr.data-tone]="tone" aria-hidden="true">
    <span class="material-symbols-outlined">{{ glyph }}</span>
  </span>`,
})
export class ActivityIconComponent {
  @Input({ required: true }) kind!: ActivityKind;
  protected get glyph() {
    return activityIcon[this.kind];
  }
  protected get tone() {
    return activityTone[this.kind];
  }
}
