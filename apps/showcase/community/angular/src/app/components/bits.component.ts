/**
 * The small, repeated pieces: a count, a relative timestamp, the person line,
 * the media frame, the chips and the reaction control.
 *
 * Each resolves BOTH halves of a domain value through the kit: the COLOUR and
 * ICON through status.ts, the LABEL through the dictionary key beside it.
 * Nothing here contains English.
 *
 * EVERY BINDING ONTO AN md-* ELEMENT IS [attr.x], NEVER [x].
 *
 * A lazily-hydrated custom element does not have the property yet when Angular
 * first binds, so a plain [icon] sets a field on a plain HTMLElement and the
 * component never sees it. The attribute form always lands, and Stencil reads
 * attributes on upgrade. This is the single most repeated correction in the
 * Angular ports and it fails silently every time.
 *
 * AND A BOOLEAN-ISH ATTRIBUTE IS ? '' : null, NOT ? true : false. Presence is
 * what these mean, and null is what removes an attribute in Angular — false
 * would render the literal string "false" and read as on.
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
import {
  REACTIONS,
  REPORTING_INSTANT,
  audienceIcon,
  friendAction,
  privacyIcon,
  privacyTone,
  reactionIcon,
  reactionTone,
  roleIcon,
  roleTone,
  rsvpIcon,
  rsvpTone,
  type Audience,
  type Friendship,
  type Group,
  type GroupRole,
  type Media,
  type Person,
  type ReactionKind,
  type ReactionSummary,
  type Rsvp,
} from '@awc-ui/showcase-kit/community';
import { ShowcaseService } from '../lib/showcase.service';

/* ------------------------------------------------------------------ count */

@Component({
  selector: 'awc-count',
  standalone: true,
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<span class="num">{{ text }}</span>',
})
export class CountComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) value!: number;
  /** Compact above ten thousand, exact below — see the React reference. */
  @Input() compact = false;

  protected get text(): string {
    return this.showcase.t.formatNumber(
        this.value,
        this.compact && this.value >= 10_000
          ? { notation: 'compact', maximumFractionDigits: 1 }
          : { maximumFractionDigits: 0 },
      );
  }
}

/* ------------------------------------------------------------------- when */

@Component({
  selector: 'awc-when',
  standalone: true,
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<time [attr.datetime]="at" [attr.title]="title" class="when">{{ text }}</time>',
})
export class WhenComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) at!: string;

  /* Measured against REPORTING_INSTANT, never the clock — every screenshot and
     every parity comparison would otherwise disagree a minute later. */
  protected get text(): string {
    return this.showcase.t.formatRelativeTime(this.at, REPORTING_INSTANT, { style: 'narrow' });
  }
  protected get title(): string {
    return this.showcase.t.formatDate(this.at.slice(0, 10), 'long');
  }
}

/* --------------------------------------------------------------- date/time */

@Component({
  selector: 'awc-date-text',
  standalone: true,
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<time [attr.datetime]="at">{{ text }}</time>',
})
export class DateTextComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) at!: string;
  /* AN EVENT IS NOT "IN 3 DAYS", IT IS ON A DATE — the exception convention 4
     in the kit calls out. */
  @Input() format: 'medium' | 'long' = 'medium';

  protected get text(): string {
    return this.showcase.t.formatDate(this.at.slice(0, 10), this.format);
  }
}

@Component({
  selector: 'awc-time-text',
  standalone: true,
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<time [attr.datetime]="at">{{ text }}</time>',
})
export class TimeTextComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) at!: string;

  protected get text(): string {
    return new Intl.DateTimeFormat(this.showcase.t.locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(this.at));
  }
}

/* ------------------------------------------------------------------ chips */

@Component({
  selector: 'awc-state-chip',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <md-chip
      variant="assist"
      [attr.appearance]="appearance"
      [attr.color]="color"
      [attr.icon]="icon"
      [attr.label]="t(labelKey)"
    ></md-chip>
  `,
})
export class StateChipComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) labelKey!: string;
  @Input() color: string | null = null;
  @Input() icon: string | null = null;
  @Input() appearance: 'outlined' | 'filled' = 'outlined';
  protected t = (key: string) => this.showcase.t(key);
}

@Component({
  selector: 'awc-privacy-chip',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [StateChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <awc-state-chip
      [labelKey]="group.privacyKey"
      [color]="tone"
      [icon]="glyph"
    ></awc-state-chip>
  `,
})
export class PrivacyChipComponent {
  @Input({ required: true }) group!: Group;
  protected get tone() {
    return privacyTone[this.group.privacy];
  }
  protected get glyph() {
    return privacyIcon[this.group.privacy];
  }
}

@Component({
  selector: 'awc-role-chip',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [StateChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tone) {
      <awc-state-chip [labelKey]="labelKey" [color]="tone" [icon]="glyph"></awc-state-chip>
    }
  `,
})
export class RoleChipComponent {
  @Input({ required: true }) role!: GroupRole;
  protected get tone() {
    return roleTone[this.role];
  }
  protected get glyph() {
    return roleIcon[this.role];
  }
  protected get labelKey() {
    return 'community.role.' + this.role;
  }
}

@Component({
  selector: 'awc-rsvp-chip',
  standalone: true,
  styles: ':host { display: contents; }',
  imports: [StateChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tone) {
      <awc-state-chip [labelKey]="labelKey" [color]="tone" [icon]="glyph"></awc-state-chip>
    }
  `,
})
export class RsvpChipComponent {
  @Input({ required: true }) rsvp!: Rsvp;
  protected get tone() {
    return rsvpTone[this.rsvp];
  }
  protected get glyph() {
    return rsvpIcon[this.rsvp];
  }
  protected get labelKey() {
    return 'community.rsvp.' + this.rsvp;
  }
}

/* ----------------------------------------------------------------- people */

@Component({
  selector: 'awc-avatar',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <md-avatar
      [attr.src]="person.avatar"
      [attr.name]="person.displayName"
      [attr.initials]="person.initials"
      [attr.size]="size"
      [attr.label]="person.displayName"
      [attr.alt]="alt"
    ></md-avatar>
  `,
})
export class AvatarComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) person!: Person;
  @Input() size: 'small' | 'medium' | 'large' = 'small';
  protected get alt() {
    return this.showcase.t('community.alt.arcs');
  }
}

@Component({
  selector: 'awc-verified',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (person.verified) {
      <md-tooltip [attr.text]="label">
        <span class="verified material-symbols-outlined" role="img" [attr.aria-label]="label"
          >verified</span
        >
      </md-tooltip>
    }
  `,
})
export class VerifiedComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) person!: Person;
  protected get label() {
    return this.showcase.t('community.verified');
  }
}

/* ------------------------------------------------------------------ media */

@Component({
  selector: 'awc-media',
  standalone: true,
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img
      [class]="className"
      [attr.data-aspect]="media.aspect"
      [attr.src]="media.src"
      [attr.alt]="alt"
      [attr.loading]="eager ? 'eager' : 'lazy'"
      decoding="async"
      [attr.draggable]="false"
    />
  `,
})
export class MediaComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) media!: Media;
  @Input() className = '';
  @Input() eager = false;
  protected get alt() {
    return this.showcase.t(this.media.altKey);
  }
}

/* --------------------------------------------------------------- audience */

@Component({
  selector: 'awc-audience-mark',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <md-tooltip [attr.text]="label">
      <span class="material-symbols-outlined" role="img" [attr.aria-label]="label">{{
        glyph
      }}</span>
    </md-tooltip>
  `,
})
export class AudienceMarkComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) audience!: Audience;
  @Input({ required: true }) labelKey!: string;
  protected get label() {
    return this.showcase.t(this.labelKey);
  }
  protected get glyph() {
    return audienceIcon[this.audience];
  }
}

/* -------------------------------------------------------------- friendship */

@Component({
  selector: 'awc-friend-button',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (action) {
      <md-button
        [attr.variant]="action.variant"
        [attr.size]="size"
        [attr.icon]="action.icon"
        [attr.data-person]="person.id"
        (mdClick)="act.emit(next)"
        >{{ label }}</md-button
      >
    }
  `,
})
export class FriendButtonComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) person!: Person;
  @Input({ required: true }) state!: Friendship;
  @Input() size: 'sm' | 'md' = 'sm';
  /* A real `@Output`, not an input that happens to carry an `emit`. The
     template binds `(act)="..."` like any other Angular event. */
  @Output() readonly act = new EventEmitter<Friendship>();

  protected get action() {
    return friendAction[this.state];
  }
  protected get label() {
    return this.action ? this.showcase.t(this.action.labelKey) : '';
  }
  /* `incoming` is handled by the screen's own Accept/Decline pair, so pressing
     this one only ever opens that choice — it never silently accepts. */
  protected get next(): Friendship {
    return this.state === 'none'
      ? 'outgoing'
      : this.state === 'outgoing'
        ? 'none'
        : this.state === 'friend'
          ? 'none'
          : 'incoming';
  }
}

/* -------------------------------------------------------------- reactions */

@Component({
  selector: 'awc-reaction-summary',
  standalone: true,
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (summary.total > 0 || commentCount > 0 || shareCount > 0) {
      <div class="reactions">
        @if (summary.total > 0) {
          <span class="reactions__glyphs" aria-hidden="true">
            @for (kind of summary.top; track kind) {
              <span class="reactions__glyph">
                <span class="material-symbols-outlined">{{ icon(kind) }}</span>
              </span>
            }
          </span>
          <span class="reactions__count">{{ totalText }}</span>
        }
        <span class="reactions__spacer"></span>
        @if (commentCount > 0) {
          <button type="button" class="reactions__count comment__act" (click)="openComments.emit()">
            {{ commentsText }}
          </button>
        }
        @if (shareCount > 0) {
          <span class="reactions__count">{{ sharesText }}</span>
        }
      </div>
    }
  `,
})
export class ReactionSummaryComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) summary!: ReactionSummary;
  @Input({ required: true }) commentCount!: number;
  @Input({ required: true }) shareCount!: number;
  @Output() readonly openComments = new EventEmitter<void>();

  protected icon = (kind: ReactionKind) => reactionIcon[kind];

  protected get totalText() {
    const t = this.showcase.t;
    return t('community.reaction.summary', { count: t.formatNumber(this.summary.total) });
  }
  protected get commentsText() {
    const t = this.showcase.t;
    return t('community.action.viewComments', { count: t.formatNumber(this.commentCount) });
  }
  protected get sharesText() {
    const t = this.showcase.t;
    return (
      t.formatNumber(this.shareCount) +
      ' ' +
      t('community.count.shares').toLocaleLowerCase(t.locale)
    );
  }
}

@Component({
  selector: 'awc-react-button',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="react">
      <md-button
        class="react__main"
        variant="text"
        [attr.icon]="mainIcon"
        [attr.color]="mine ? tone(mine) : null"
        [attr.data-on]="mine ? '' : null"
        [attr.aria-label]="mainLabel"
        (mdClick)="pick.emit(mine ? null : 'like')"
        >{{ mainText }}</md-button
      >

      <span
        class="react__picker"
        [attr.data-open]="open ? '' : null"
        role="group"
        [attr.aria-label]="pickLabel"
      >
        @for (kind of kinds; track kind) {
          <button
            type="button"
            class="react__option"
            [attr.data-tone]="tone(kind)"
            [attr.data-reaction]="kind"
            [attr.data-on]="mine === kind ? '' : null"
            [attr.aria-pressed]="mine === kind"
            [attr.aria-label]="label(kind)"
            (click)="choose(kind)"
          >
            <span class="material-symbols-outlined" aria-hidden="true">{{ icon(kind) }}</span>
          </button>
        }
      </span>

      <md-icon-button
        class="react__toggle"
        icon="add_reaction"
        [attr.aria-label]="pickLabel"
        [attr.aria-expanded]="open"
        (mdClick)="open = !open"
      ></md-icon-button>
    </span>
  `,
})
export class ReactButtonComponent {
  private readonly showcase = inject(ShowcaseService);
  @Input({ required: true }) mine!: ReactionKind | null;
  @Output() readonly pick = new EventEmitter<ReactionKind | null>();

  protected open = false;
  protected readonly kinds = REACTIONS;
  protected icon = (kind: ReactionKind) => reactionIcon[kind];
  protected tone = (kind: ReactionKind) => reactionTone[kind];
  protected label = (kind: ReactionKind) => this.showcase.t('community.reaction.' + kind);

  protected get mainIcon() {
    return reactionIcon[this.mine ?? 'like'];
  }
  protected get mainText() {
    return this.showcase.t('community.reaction.' + (this.mine ?? 'like'));
  }
  protected get mainLabel() {
    return this.showcase.t(
      this.mine ? 'community.reaction.' + this.mine : 'community.reaction.none',
    );
  }
  protected get pickLabel() {
    return this.showcase.t('community.reaction.pick');
  }

  protected choose(kind: ReactionKind): void {
    this.pick.emit(this.mine === kind ? null : kind);
    this.open = false;
  }
}
