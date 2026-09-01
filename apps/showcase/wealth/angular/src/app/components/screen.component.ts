import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  Input,
  signal,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import type { Subscription } from 'rxjs';
import { ShowcaseComponent } from '../lib/screen.base';
import type { CrumbSpec } from '../lib/routes';
import { BreadcrumbsComponent } from './breadcrumbs.component';
import { ScreenSkeletonComponent, SKELETON_MS } from './skeletons.component';

/**
 * Screens already visited in this session. Module scope, so it outlives every
 * component instance and every navigation.
 */
const seen = new Set<string>();

/**
 * `?skeleton=` — an inspection handle on a state that is otherwise 550ms long.
 *
 *   ?skeleton=hold   the placeholder stays up and never resolves
 *   ?skeleton=4000   the placeholder lasts 4000ms instead of 550
 *
 * Either form also defeats the once-per-screen rule, so the placeholder shows
 * again every time you navigate rather than only on a first visit.
 *
 * Read once, at module scope: it is a URL flag for looking at the app, not
 * state, and re-reading it per render would invite someone to treat it as
 * something that can change.
 */
const SKELETON_FLAG = (() => {
  if (typeof location === 'undefined') return null;
  const raw = new URLSearchParams(location.search).get('skeleton');
  if (raw === null) return null;
  if (raw === 'hold' || raw === '') return { hold: true, ms: 0 };
  const ms = Number.parseInt(raw, 10);
  return Number.isFinite(ms) && ms > 0 ? { hold: false, ms } : { hold: true, ms: 0 };
})();

/**
 * The per-screen frame: breadcrumb trail, heading, optional toolbar, and the
 * skeleton beat. The app-wide chrome (app bar, rail, bottom bar, dock) lives in
 * `AppComponent`, ABOVE the router, so it survives navigation — this component
 * is the part that legitimately belongs to each screen.
 *
 * THE SKELETON SHOWS ONCE PER SCREEN, EVER, for `SKELETON_MS` (550ms). These
 * screens read synchronous selectors out of the kit — there is no fetch — so a
 * placeholder on every navigation would not cover a wait, it would MANUFACTURE
 * one. The `seen` set is keyed on the PATHNAME, not on the component instance:
 * two visits to the same screen TYPE — one household then another — reuse the
 * Angular component, so the router-events subscription below is what restarts
 * the beat for the second household.
 *
 * THE LAYOUT IS ALWAYS THE REAL CONTENT'S; THE PLACEHOLDER IS PAINTED OVER IT.
 * The projected children are in the tree from the first frame — their lazy
 * `md-*` chunks load during the placeholder's window — and while the screen is
 * not ready `data-placeholder` makes the kit's CSS hide them with
 * `visibility: hidden` (box kept, no reflow on reveal, out of the
 * accessibility tree while the skeleton announces). The skeleton is absolutely
 * positioned over the stage. Revealing is a visibility flip: exactly 0px of
 * movement at every width, density and locale, by construction.
 *
 * The trail row is ALWAYS rendered, even when empty: a row that comes and goes
 * moves the heading and every panel under it on each navigation. Its height is
 * reserved in `.shell__trail`. A trail of ONE is shown rather than dropped —
 * the single crumb is link-less, so it reads as the current page.
 *
 * TWO CONTENT FLAGS, because Angular cannot ask whether a slot received
 * content the way JSX reads a prop:
 *
 *   - `hasActions`: set it when projecting `[actions]` content, so the
 *     `.screen-toolbar` band (ONE `md-toolbar variant="floating"
 *     color="vibrant"` — a toolbar is one tab stop with arrow-key movement)
 *     only exists on screens that have actions, exactly as in React.
 *   - `customSkeleton`: set it when projecting a `[skeleton]` placeholder
 *     measured for this screen; otherwise the generic `ScreenSkeleton` stands
 *     in. Every ported screen should bring its own.
 */
@Component({
  selector: 'awc-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [BreadcrumbsComponent, ScreenSkeletonComponent],
  template: `
    <div class="shell__trail">
      @if (crumbs.length > 0) {
        <awc-breadcrumbs [crumbs]="crumbs" />
      }
    </div>

    <div class="screen-head">
      <div class="screen-head__text">
        <h1>{{ title }}</h1>
        @if (subtitle) {
          <p>{{ subtitle }}</p>
        }
      </div>
      <div class="screen-head__aside"><ng-content select="[aside]" /></div>
    </div>

    @if (hasActions) {
      <div class="screen-toolbar">
        <!-- floating, not docked: a docked toolbar is sticky against the
             BOTTOM edge, where the navigation bar and the dock already are.
             vibrant puts the pill on primary-container; this is the app's
             ONLY md-toolbar, so one attribute is every toolbar. -->
        <md-toolbar variant="floating" color="vibrant" [attr.aria-label]="t('wealth.nav.toolbar')">
          <ng-content select="[actions]" />
        </md-toolbar>
      </div>
    }

    <div class="screen-stage">
      <div class="screen-body" [attr.data-placeholder]="ready() ? null : ''">
        <ng-content />
      </div>
      @if (!ready()) {
        <div class="screen-stage__placeholder">
          @if (customSkeleton) {
            <ng-content select="[skeleton]" />
          } @else {
            <awc-screen-skeleton [label]="title" />
          }
        </div>
      }
    </div>
  `,
})
export class ScreenComponent extends ShowcaseComponent implements OnInit, OnDestroy {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  /** From the kit's `crumbsFor()`. */
  @Input() crumbs: CrumbSpec[] = [];
  /** Set when projecting `[actions]` content — gates the toolbar band. */
  @Input() hasActions = false;
  /** Set when projecting a measured `[skeleton]` placeholder. */
  @Input() customSkeleton = false;

  protected readonly ready = signal(false);

  private readonly router = inject(Router);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private navigations?: Subscription;

  ngOnInit(): void {
    this.beat();
    // Same-component navigations (household → household) never re-create this
    // instance, so the beat is restarted from the router's own signal.
    this.navigations = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) this.beat();
    });
  }

  ngOnDestroy(): void {
    // Cleared on the way out, so a fast click-through does not leave a pending
    // timeout that flips a screen the reader has already left.
    if (this.timer !== null) clearTimeout(this.timer);
    this.navigations?.unsubscribe();
  }

  private beat(): void {
    const pathname = this.router.url.split('?')[0] || '/';
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // Held open on purpose — nothing to schedule, and nothing is ever marked
    // seen, so every navigation shows the placeholder again.
    if (SKELETON_FLAG?.hold) {
      this.ready.set(false);
      return;
    }
    if (!SKELETON_FLAG && seen.has(pathname)) {
      this.ready.set(true);
      return;
    }
    this.ready.set(false);
    this.timer = setTimeout(() => {
      seen.add(pathname);
      this.ready.set(true);
    }, SKELETON_FLAG?.ms ?? SKELETON_MS);
  }
}
