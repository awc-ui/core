import { CommonModule } from '@angular/common';
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

/* ============================================================ compositions */
/*
 * Each is the SHAPE OF THE SCREEN IT COVERS, built from the screens' own
 * classes — `.skel-panel`, `.track-row`, `.shelf-card`, `.strip`, `.lane` — so
 * the placeholder inherits every one of those rules and cannot drift from the
 * layout at a breakpoint.
 *
 * `.skel-panel` carries an OUTLINED CARD'S BOX and pads by 16, because
 * `md-card` pads its own host by 16 ON TOP of `.panel__inner`'s 16. Both are
 * needed, or the placeholder is 32px shorter than the panel it covers, per
 * panel. The heights below are measured off the real screens at 1440px.
 */

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-panel-skeleton',
  standalone: true,
  imports: [CommonModule, SkelLineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  /* `head` is not decoration: `Panel` renders no head when it has no title,
     and a placeholder that draws one anyway is 32px too tall. */
  template: `
    <div class="skel-panel">
      <div class="panel__inner">
        <div class="panel__head" *ngIf="head">
          <awc-skel-line w="180px" [h]="20" />
          <awc-skel-line w="24px" [h]="20" />
        </div>
        <ng-content />
      </div>
    </div>
  `,
})
export class PanelSkeletonComponent {
  @Input() head = true;
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-track-row-skeleton',
  standalone: true,
  imports: [CommonModule, SkelLineComponent, SkelCircleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  /* MEASURED: title 20, artist 16, album 16, duration 16, buttons 40, row 56. */
  template: `
    <div class="track-row">
      <awc-skel-line w="100%" [h]="12" />
      <div class="track-row__text">
        <awc-skel-line w="54%" [h]="20" />
        <awc-skel-line w="32%" [h]="16" />
      </div>
      <awc-skel-line *ngIf="albums" w="46%" [h]="16" />
      <awc-skel-line w="32px" [h]="16" />
      <div class="row"><awc-skel-circle [size]="40" /><awc-skel-circle [size]="40" /></div>
    </div>
  `,
})
export class TrackRowSkeletonComponent {
  @Input() albums = false;
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-track-list-skeleton',
  standalone: true,
  imports: [CommonModule, TrackRowSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="track-list" [attr.data-albums]="albums ? '' : null">
    <awc-track-row-skeleton *ngFor="let i of range" [albums]="albums" />
  </div>`,
})
export class TrackListSkeletonComponent {
  @Input({ required: true }) rows!: number;
  @Input() albums = false;
  get range() { return Array.from({ length: this.rows }, (_, i) => i); }
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-shelf-skeleton',
  standalone: true,
  imports: [CommonModule, SkelBarComponent, SkelLineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  /* The card is the real `.shelf-card`, so the art keeps its ratio and the grid
     its `auto-fill` columns. 165px square, measured; the wide banner is half. */
  template: `<div class="shelf">
    <div class="shelf-card" *ngFor="let i of range">
      <awc-skel-bar [height]="wide ? '83px' : '165px'" radius="12px" />
      <awc-skel-line w="72%" [h]="20" />
      <awc-skel-line w="46%" [h]="16" />
    </div>
  </div>`,
})
export class ShelfSkeletonComponent {
  @Input() count = 6;
  @Input() wide = false;
  get range() { return Array.from({ length: this.count }, (_, i) => i); }
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-artist-row-skeleton',
  standalone: true,
  imports: [SkelLineComponent, SkelCircleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="artist-row">
    <awc-skel-circle [size]="48" />
    <div class="track-row__text"><awc-skel-line w="34%" [h]="20" /><awc-skel-line w="22%" [h]="16" /></div>
  </div>`,
})
export class ArtistRowSkeletonComponent {}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-project-list-skeleton',
  standalone: true,
  imports: [CommonModule, SkelBarComponent, SkelLineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stack">
    <div class="project-card" *ngFor="let i of range">
      <awc-skel-bar width="64px" height="64px" radius="8px" />
      <div class="track-row__text"><awc-skel-line w="30%" [h]="20" /><awc-skel-line w="18%" [h]="16" /></div>
    </div>
  </div>`,
})
export class ProjectListSkeletonComponent {
  @Input({ required: true }) count!: number;
  get range() { return Array.from({ length: this.count }, (_, i) => i); }
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-home-skeleton',
  standalone: true,
  imports: [CommonModule, PanelSkeletonComponent, TrackListSkeletonComponent, ShelfSkeletonComponent, ArtistRowSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stack">
    <awc-panel-skeleton><awc-track-list-skeleton [rows]="6" [albums]="true" /></awc-panel-skeleton>
    <awc-panel-skeleton><awc-shelf-skeleton /></awc-panel-skeleton>
    <awc-panel-skeleton><awc-shelf-skeleton [count]="4" [wide]="true" /></awc-panel-skeleton>
    <!-- ARTIST ROWS, not cards. ".stack" and not a bare div: the real list's
         12px gap is 24px over four rows. -->
    <awc-panel-skeleton>
      <div class="stack"><awc-artist-row-skeleton *ngFor="let i of four" /></div>
    </awc-panel-skeleton>
  </div>`,
})
export class HomeSkeletonComponent {
  readonly four = [0, 1, 2, 3];
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-library-skeleton',
  standalone: true,
  imports: [PanelSkeletonComponent, TrackListSkeletonComponent, ShelfSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stack">
    <awc-panel-skeleton><awc-track-list-skeleton [rows]="12" [albums]="true" /></awc-panel-skeleton>
    <awc-panel-skeleton><awc-shelf-skeleton [count]="5" [wide]="true" /></awc-panel-skeleton>
    <awc-panel-skeleton><awc-shelf-skeleton [count]="3" [wide]="true" /></awc-panel-skeleton>
    <!-- Sixteen, because the library lists every album. -->
    <awc-panel-skeleton><awc-shelf-skeleton [count]="16" /></awc-panel-skeleton>
  </div>`,
})
export class LibrarySkeletonComponent {}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-studio-skeleton',
  standalone: true,
  imports: [CommonModule, PanelSkeletonComponent, ProjectListSkeletonComponent, SkelBarComponent, SkelLineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stack">
    <!-- The project header carries no panel title. -->
    <awc-panel-skeleton [head]="false">
      <div class="studio-head">
        <div class="studio-head__facts">
          <awc-skel-bar width="64px" height="64px" radius="8px" />
          <div class="track-row__text"><awc-skel-line w="180px" [h]="28" /><awc-skel-line w="240px" [h]="20" /></div>
        </div>
        <div class="row">
          <awc-skel-bar width="84px" height="32px" radius="16px" />
          <awc-skel-bar width="84px" height="32px" radius="16px" />
        </div>
      </div>
    </awc-panel-skeleton>

    <!-- The arrangement in the REAL lane grid: a ruler with seven lanes says a
         timeline is coming and how many tracks are on it. -->
    <awc-panel-skeleton>
      <div class="lanes">
        <div class="lane-names">
          <div class="lane-names__pad"></div>
          <div class="lane-name" *ngFor="let i of seven"><awc-skel-line w="70%" [h]="16" /></div>
        </div>
        <div>
          <awc-skel-bar height="28px" radius="0" />
          <awc-skel-bar *ngFor="let i of seven" height="56px" radius="0" />
        </div>
      </div>
    </awc-panel-skeleton>

    <!-- The history opens empty, so this is the empty state's height. -->
    <awc-panel-skeleton><awc-skel-bar height="96px" radius="8px" /></awc-panel-skeleton>
    <awc-panel-skeleton><awc-project-list-skeleton [count]="4" /></awc-panel-skeleton>
  </div>`,
})
export class StudioSkeletonComponent {
  readonly seven = [0, 1, 2, 3, 4, 5, 6];
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-mixer-skeleton',
  standalone: true,
  imports: [CommonModule, PanelSkeletonComponent, SkelBarComponent, SkelLineComponent, SkelCircleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  /* Seven strips, each measured: the real strip is 435px and holds a name, a
     24px kind glyph, a 160px fader, a meter, two readouts, a 40px pan slider
     and two buttons. */
  template: `<awc-panel-skeleton>
    <div class="mixer">
      <div class="strip" *ngFor="let i of seven">
        <awc-skel-line w="70%" [h]="16" />
        <awc-skel-line w="40%" [h]="24" />
        <div class="strip__body"><awc-skel-bar width="48px" height="160px" radius="8px" /></div>
        <awc-skel-bar height="10px" radius="5px" />
        <awc-skel-line w="50%" [h]="16" />
        <awc-skel-bar height="40px" radius="20px" />
        <awc-skel-line w="50%" [h]="16" />
        <div class="row"><awc-skel-circle [size]="40" /><awc-skel-circle [size]="40" /></div>
      </div>
    </div>
  </awc-panel-skeleton>`,
})
export class MixerSkeletonComponent {
  readonly seven = [0, 1, 2, 3, 4, 5, 6];
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-release-skeleton',
  standalone: true,
  imports: [PanelSkeletonComponent, TrackListSkeletonComponent, ShelfSkeletonComponent, SkelBarComponent, SkelLineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stack">
    <awc-panel-skeleton [head]="false">
      <div class="release-head">
        <awc-skel-bar width="200px" height="200px" radius="16px" />
        <div class="stack">
          <awc-skel-line w="260px" [h]="28" />
          <awc-skel-line w="180px" [h]="16" />
          <awc-skel-line w="120px" [h]="16" />
          <awc-skel-bar width="140px" height="40px" radius="20px" />
        </div>
      </div>
    </awc-panel-skeleton>
    <awc-panel-skeleton><awc-track-list-skeleton [rows]="3" /></awc-panel-skeleton>
    <awc-panel-skeleton><awc-shelf-skeleton [count]="2" /></awc-panel-skeleton>
  </div>`,
})
export class ReleaseSkeletonComponent {}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-profile-skeleton',
  standalone: true,
  imports: [CommonModule, PanelSkeletonComponent, TrackListSkeletonComponent, ShelfSkeletonComponent, ProjectListSkeletonComponent, SkelBarComponent, SkelLineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stack">
    <awc-panel-skeleton [head]="false">
      <div class="release-head">
        <awc-skel-bar width="200px" height="200px" radius="16px" />
        <div class="stack">
          <awc-skel-line w="220px" [h]="28" />
          <awc-skel-line w="140px" [h]="16" />
          <div class="row">
            <div class="track-row__text" *ngFor="let i of four">
              <awc-skel-line w="70px" [h]="16" /><awc-skel-line w="46px" [h]="20" />
            </div>
          </div>
        </div>
      </div>
    </awc-panel-skeleton>

    <awc-panel-skeleton>
      <div class="stack">
        <div class="queue-row" *ngFor="let i of six">
          <awc-skel-line w="16px" [h]="14" />
          <div class="track-row__text"><awc-skel-line w="26%" [h]="20" /><awc-skel-line w="16%" [h]="16" /></div>
        </div>
      </div>
    </awc-panel-skeleton>

    <awc-panel-skeleton><awc-track-list-skeleton [rows]="6" [albums]="true" /></awc-panel-skeleton>
    <awc-panel-skeleton><awc-shelf-skeleton [count]="5" [wide]="true" /></awc-panel-skeleton>
    <awc-panel-skeleton><awc-project-list-skeleton [count]="4" /></awc-panel-skeleton>
  </div>`,
})
export class ProfileSkeletonComponent {
  readonly four = [0, 1, 2, 3];
  readonly six = [0, 1, 2, 3, 4, 5];
}

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-screen-skeleton',
  standalone: true,
  imports: [HomeSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [attr.aria-label]="label" aria-busy="true"><awc-home-skeleton /></div>`,
})
export class ScreenSkeletonComponent {
  @Input() label?: string;
}
