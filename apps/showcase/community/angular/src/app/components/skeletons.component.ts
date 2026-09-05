import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * The placeholder shapes every screen shows while it settles.
 *
 * PLAIN DOM, NOT `md-skeleton`. Every shape here is a `<div class="skel">`
 * styled from tokens in `app.css`, and that is the single most important thing
 * about this file: `md-skeleton` and `md-card` are lazily-hydrated custom
 * elements exactly like the content they stand in for, so a placeholder built
 * from them catches the same disease it is there to treat — measured on the
 * React build's holdings screen, such a placeholder was 172px tall for three
 * frames, 228px for one more, and only then its real 1986. Divs have their size
 * in the first paint, before a chunk has loaded, which is the only property a
 * placeholder actually needs.
 *
 * THE PLACEHOLDER DOES NOT HAVE TO BE THE RIGHT HEIGHT. It is absolutely
 * positioned over the real content, which keeps its own box the whole time (see
 * `ScreenComponent`), so revealing is a `visibility` flip with no reflow. The
 * heights below are still MEASURED rather than invented — copied from the React
 * build's skeletons — because the shape should look like what is coming.
 *
 * THE BEAT IS A CONSTANT, NEVER A MEASURED DURATION. These screens read
 * synchronous selectors out of the kit — there is no network here, and the
 * pause exists to demonstrate the pattern rather than to cover a real wait. A
 * clock-derived or random delay would also make two runs of the showcase
 * disagree, which the cross-framework parity check cannot tolerate.
 *
 * Exactly ONE shape per skeleton announces (`role="status"`), with the screen
 * name — more would be a chorus.
 */

/**
 * How long the placeholder layout is shown for, in milliseconds.
 *
 * Long enough to be seen — below ~300ms a placeholder only flashes — and short
 * enough not to be in the way. `?skeleton=hold` or `?skeleton=<ms>` overrides
 * it for inspection; see `ScreenComponent`.
 */
export const SKELETON_MS = 550;

/**
 * One placeholder bar with a corner of its own.
 *
 * A single `border-radius` for everything would be wrong in both directions:
 * measured off the real holdings filter bar, `md-search` is a 9999px pill, an
 * outlined text field is 4px, `md-chip` is 8px and `md-split-button` is 20px.
 *
 * `flex` is how a bar takes the SAME share of a `.row` its control does — the
 * fields in that bar are laid out by `flex: 1 1 260px` and friends, and a
 * placeholder that guessed a percentage instead would break at the first
 * breakpoint.
 */
@Component({
  selector: 'awc-skel-bar',
  standalone: true,
  styles: ':host { display: contents; }',
  template: `
    <div
      class="skel"
      [style.block-size]="height"
      [style.inline-size]="width ?? (flex ? null : '100%')"
      [style.border-radius]="radius"
      [style.flex]="flex ?? null"
    ></div>
  `,
})
export class SkelBarComponent {
  /** A CSS length. The control's own corner, measured, not a guess. */
  @Input({ required: true }) radius!: string;
  @Input({ required: true }) height!: string;
  /** Omit to let the bar fill its box. */
  @Input() width?: string;
  @Input() flex?: string;
}

/* ============================================================================
 * THE COMPOSITIONS.
 *
 * Each is the SHAPE OF THE SCREEN IT COVERS, not a grey rectangle of about the
 * right height — a placeholder that only says "something is coming" tells the
 * reader nothing they did not know, whereas one that says "a column of posts is
 * coming, with a picture in the second" lets them read the layout before the
 * content lands.
 *
 * They are built from the screens' OWN classes (`.columns`, `.person-grid`,
 * `.event-row`, `.photo-grid`), so a placeholder inherits every layout rule and
 * cannot drift from the screen at a breakpoint.
 * ========================================================================= */

@Component({
  selector: 'awc-skel-line',
  standalone: true,
  imports: [SkelBarComponent],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<awc-skel-bar [width]="w" [height]="h + \'px\'" radius="4px" />',
})
export class SkelLineComponent {
  @Input() w = '100%';
  @Input() h = 14;
}

@Component({
  selector: 'awc-skel-circle',
  standalone: true,
  imports: [SkelBarComponent],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<awc-skel-bar [width]="size + \'px\'" [height]="size + \'px\'" radius="50%" />',
})
export class SkelCircleComponent {
  @Input() size = 40;
}

@Component({
  selector: 'awc-post-card-skeleton',
  standalone: true,
  imports: [SkelBarComponent, SkelLineComponent, SkelCircleComponent],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="skel-card">
      <div class="row" style="align-items: center">
        <awc-skel-circle [size]="40" />
        <div class="stack" style="flex: 1; gap: 6px">
          <awc-skel-line w="38%" [h]="15" />
          <awc-skel-line w="22%" [h]="12" />
        </div>
      </div>
      <div class="stack" style="gap: 8px; margin-block-start: 12px">
        @for (i of range(lines); track i) {
          <awc-skel-line [w]="i === lines - 1 ? '64%' : '100%'" />
        }
      </div>
      @if (media) {
        <awc-skel-bar width="100%" height="240px" radius="12px" />
      }
      <div class="row" style="margin-block-start: 12px; gap: 24px">
        @for (i of range(3); track i) {
          <awc-skel-bar width="84px" height="20px" radius="4px" />
        }
      </div>
    </div>
  `,
})
export class PostCardSkeletonComponent {
  /* `media` is a real property of the post it stands for: roughly a third of
     this feed carries pictures, so a placeholder where every card had one would
     promise a feed that does not exist. */
  @Input() media = false;
  @Input() lines = 3;
  protected range = (n: number) => Array.from({ length: n }, (_, i) => i);
}

@Component({
  selector: 'awc-rail-panel-skeleton',
  standalone: true,
  imports: [SkelBarComponent, SkelLineComponent, SkelCircleComponent],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="skel-card">
      <awc-skel-line w="46%" [h]="16" />
      <div class="stack" style="gap: 12px; margin-block-start: 8px">
        @for (i of range(rows); track i) {
          <div class="row" style="gap: 8px; align-items: center">
            @if (avatars) {
              <awc-skel-circle [size]="28" />
            } @else {
              <awc-skel-bar width="20px" height="20px" radius="4px" />
            }
            <awc-skel-line [w]="58 + ((i * 13) % 26) + '%'" [h]="13" />
          </div>
        }
      </div>
    </div>
  `,
})
export class RailPanelSkeletonComponent {
  @Input() rows = 3;
  @Input() avatars = false;
  protected range = (n: number) => Array.from({ length: n }, (_, i) => i);
}

@Component({
  selector: 'awc-right-rail-skeleton',
  standalone: true,
  imports: [RailPanelSkeletonComponent],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="columns__rail">
      <awc-rail-panel-skeleton [rows]="2" />
      <awc-rail-panel-skeleton [rows]="3" />
      <awc-rail-panel-skeleton [rows]="5" [avatars]="true" />
    </aside>
  `,
})
export class RightRailSkeletonComponent {}

@Component({
  selector: 'awc-feed-skeleton',
  standalone: true,
  imports: [
    SkelBarComponent,
    SkelCircleComponent,
    PostCardSkeletonComponent,
    RightRailSkeletonComponent,
  ],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="columns">
      <div class="columns__main">
        <div class="skel-card">
          <div class="row" style="gap: 12px; align-items: center; flex-wrap: nowrap">
            <awc-skel-circle [size]="40" />
            <awc-skel-bar flex="1" height="44px" radius="9999px" />
          </div>
        </div>
        <awc-post-card-skeleton [lines]="3" />
        <awc-post-card-skeleton [media]="true" [lines]="2" />
        <awc-post-card-skeleton [lines]="4" />
      </div>
      <awc-right-rail-skeleton />
    </div>
  `,
})
export class FeedSkeletonComponent {}

@Component({
  selector: 'awc-friends-skeleton',
  standalone: true,
  imports: [SkelBarComponent, SkelLineComponent, SkelCircleComponent],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (count of [4, 2, 6]; track $index) {
      <div class="skel-card">
        <awc-skel-line w="28%" [h]="16" />
        <div class="person-grid" style="margin-block-start: 12px">
          @for (i of range(count); track i) {
            <div class="row" style="align-items: flex-start; gap: 12px">
              <awc-skel-circle [size]="40" />
              <div class="stack" style="flex: 1; gap: 6px">
                <awc-skel-line w="72%" [h]="15" />
                <awc-skel-line w="52%" [h]="12" />
                <awc-skel-bar height="32px" radius="9999px" />
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class FriendsSkeletonComponent {
  protected range = (n: number) => Array.from({ length: n }, (_, i) => i);
}

@Component({
  selector: 'awc-groups-skeleton',
  standalone: true,
  imports: [SkelBarComponent, SkelLineComponent],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (count of [6, 4]; track $index) {
      <div class="skel-card">
        <awc-skel-line w="24%" [h]="16" />
        <div class="card-grid" style="margin-block-start: 12px">
          @for (i of range(count); track i) {
            <div class="stack" style="gap: 8px">
              <awc-skel-bar width="100%" height="120px" radius="12px" />
              <awc-skel-line w="62%" [h]="17" />
              <div class="row" style="gap: 8px">
                <awc-skel-bar width="72px" height="28px" radius="9999px" />
                <awc-skel-bar width="84px" height="28px" radius="9999px" />
              </div>
              <awc-skel-line w="100%" [h]="12" />
              <awc-skel-line w="80%" [h]="12" />
              <awc-skel-bar width="100%" height="32px" radius="9999px" />
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class GroupsSkeletonComponent {
  protected range = (n: number) => Array.from({ length: n }, (_, i) => i);
}

@Component({
  selector: 'awc-events-skeleton',
  standalone: true,
  imports: [SkelBarComponent, SkelLineComponent, SkelCircleComponent],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (count of [2, 3, 3]; track $index) {
      <div class="skel-card">
        <awc-skel-line w="22%" [h]="16" />
        <div class="event-list" style="margin-block-start: 12px">
          @for (i of range(count); track i) {
            <div class="event-row">
              <awc-skel-bar width="56px" height="58px" radius="12px" />
              <div class="stack" style="gap: 6px">
                <awc-skel-line w="46%" [h]="15" />
                <awc-skel-line w="34%" [h]="12" />
                <awc-skel-line w="40%" [h]="12" />
                <awc-skel-bar width="104px" height="30px" radius="9999px" />
              </div>
              <div class="row" style="gap: 4px">
                @for (n of range(3); track n) {
                  <awc-skel-circle [size]="32" />
                }
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class EventsSkeletonComponent {
  /* The 56px square is the date block, the one element on that screen a reader
     navigates by — so the one the placeholder most needs to promise. */
  protected range = (n: number) => Array.from({ length: n }, (_, i) => i);
}

@Component({
  selector: 'awc-profile-skeleton',
  standalone: true,
  imports: [
    SkelBarComponent,
    SkelLineComponent,
    SkelCircleComponent,
    PostCardSkeletonComponent,
    RailPanelSkeletonComponent,
  ],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="columns">
      <div class="columns__main">
        <div class="skel-card" style="padding: 0">
          <awc-skel-bar width="100%" height="205px" radius="12px 12px 0 0" />
          <div
            class="row"
            style="align-items: flex-start; gap: 16px; padding: 0 16px 16px; margin-block-start: calc(var(--profile-overlap, 36px) * -1)"
          >
            <span class="profile-head__avatar" style="position: relative; z-index: 1">
              <awc-skel-circle [size]="62" />
            </span>
            <div
              class="stack"
              style="flex: 1; gap: 6px; padding-block-start: calc(var(--profile-overlap, 36px) + 8px)"
            >
              <awc-skel-line w="40%" [h]="24" />
              <awc-skel-line w="26%" [h]="14" />
            </div>
          </div>
          <div class="row" style="gap: 32px; padding: 0 16px 16px">
            @for (i of range(4); track i) {
              <div class="stack" style="gap: 4px">
                <awc-skel-line w="48px" [h]="20" />
                <awc-skel-line w="64px" [h]="12" />
              </div>
            }
          </div>
        </div>
        <awc-post-card-skeleton [lines]="2" />
        <awc-post-card-skeleton [media]="true" [lines]="3" />
      </div>
      <aside class="columns__rail">
        <awc-rail-panel-skeleton [rows]="4" />
        <div class="skel-card">
          <awc-skel-line w="40%" [h]="16" />
          <div class="photo-grid" style="margin-block-start: 8px; background: transparent">
            @for (i of range(6); track i) {
              <awc-skel-bar width="100%" height="86px" radius="0" />
            }
          </div>
        </div>
      </aside>
    </div>
  `,
})
export class ProfileSkeletonComponent {
  /* The ring is what makes the avatar visible: a grey disc on a grey band is
     one shape. It borrows the real header's own class rather than reinventing
     it, and the overlap comes from the same custom property. */
  protected range = (n: number) => Array.from({ length: n }, (_, i) => i);
}

@Component({
  selector: 'awc-post-skeleton',
  standalone: true,
  imports: [PostCardSkeletonComponent, RightRailSkeletonComponent],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="columns">
      <div class="columns__main">
        <awc-post-card-skeleton [media]="true" [lines]="3" />
      </div>
      <awc-right-rail-skeleton />
    </div>
  `,
})
export class PostSkeletonComponent {}

@Component({
  selector: 'awc-cover-skeleton',
  standalone: true,
  imports: [
    SkelBarComponent,
    SkelLineComponent,
    PostCardSkeletonComponent,
    RailPanelSkeletonComponent,
  ],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="columns">
      <div class="columns__main">
        <div class="skel-card">
          <awc-skel-bar width="100%" height="240px" radius="16px" />
          <awc-skel-line w="52%" [h]="26" />
          <div class="row" style="gap: 8px">
            <awc-skel-bar width="86px" height="30px" radius="9999px" />
            <awc-skel-bar width="104px" height="30px" radius="9999px" />
            <awc-skel-bar width="128px" height="36px" radius="9999px" />
          </div>
          <awc-skel-line w="100%" [h]="13" />
          <awc-skel-line w="88%" [h]="13" />
        </div>
        @if (timeline) {
          <awc-post-card-skeleton [lines]="2" />
          <awc-post-card-skeleton [media]="true" [lines]="3" />
        }
      </div>
      <aside class="columns__rail">
        <awc-rail-panel-skeleton [rows]="1" [avatars]="true" />
        <awc-rail-panel-skeleton [rows]="4" [avatars]="true" />
      </aside>
    </div>
  `,
})
export class CoverSkeletonComponent {
  @Input() timeline = false;
}

@Component({
  selector: 'awc-screen-skeleton',
  standalone: true,
  imports: [FeedSkeletonComponent],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<div [attr.aria-label]="label" aria-busy="true"><awc-feed-skeleton /></div>',
})
export class ScreenSkeletonComponent {
  /* The fallback is the FEED's shape rather than a neutral block: the feed is
     the screen a reader arrives on and the one any unnamed screen is most
     likely to resemble. */
  @Input() label?: string;
}
