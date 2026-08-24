import { Component, CUSTOM_ELEMENTS_SCHEMA, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BASE_CURRENCY, REPORTING_DATE, REPORTING_QUARTER } from '@awc-ui/showcase-kit/data';
import { ShowcaseComponent } from '../lib/screen.base';
import { BASE_PATH, appPath } from '../lib/routes';
import { DockComponent } from './dock.component';

export interface Crumb {
  label: string;
  /** Root-relative path WITHOUT the base path. Omit on the final crumb. */
  href?: string;
}

/**
 * The frame every screen sits in: masthead, section nav, breadcrumb trail,
 * screen heading, and the showcase dock.
 *
 * Not a single string is written here — the translator resolves all of them,
 * including the ones that look like constants (the brand name, the base-currency
 * note). The reporting date goes through `formatDate`, which is pinned to
 * `timeZone: 'UTC'`, so 2026-03-31 is 31 March in every locale and on every
 * machine that builds this.
 */
@Component({
  selector: 'awc-shell',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [DockComponent],
  styles: ':host { display: contents; }',
  template: `
    <div class="shell">
      <!--
        Identity, sections and reporting context share one bar. The nav is INSIDE
        the masthead rather than on its own row beneath it — it is still a real
        <nav> with its own accessible name, so nothing is lost to assistive tech
        by the two being visually joined.
      -->
      <header class="shell__masthead">
        <p class="shell__brand">{{ t('app.brand') }}</p>
        <span class="muted">{{ t('app.title') }}</span>

        <!-- mdClick bubbles from the button to the nav, so one listener is
             enough. The current section is tonal rather than text: without
             it three identical buttons give no feedback at all when one of them
             is the page you are already on. -->
        <nav class="shell__nav" [attr.aria-label]="t('nav.label')" (mdClick)="intercept($event)">
          @for (section of sections; track section.path) {
            <md-button
              [attr.variant]="isCurrent(section.path) ? 'tonal' : 'text'"
              size="sm"
              [attr.icon]="section.icon"
              [attr.href]="withBase(section.path)"
              [attr.aria-current]="isCurrent(section.path) ? 'page' : null"
            >
              {{ section.label }}
            </md-button>
          }
        </nav>

        <div class="shell__meta">
          <span>{{ t('app.reportingDate', { date: t.formatDate(reportingDate, 'medium') }) }}</span>
          <span>{{ t('app.reportingQuarter', { quarter: reportingQuarter }) }}</span>
          <span>{{ t('app.baseCurrency', { currency: baseCurrency }) }}</span>
        </div>
      </header>

      <!-- The trail has its own row above the heading.

           It appears on the drill path (sector → counterparty → facility), where
           it is the only thing showing where you are and the only way back up.
           Not on the three section screens: the nav already highlights the
           section, so a trail reading "Overview / Watchlist" would only say it
           twice.

           The ROW is always rendered even when empty, because a row that comes
           and goes is what was moving the heading and every panel under it by
           52px on each navigation. Its height is reserved in the stylesheet. -->
      <div class="shell__trail">
        @if (crumbs.length > 1) {
          <!-- mdSelect is cancelable and bubbles from the item to the strip, so
               one listener on the strip is enough. The trail still works with
               JavaScript off because the items carry real hrefs. -->
          <md-breadcrumbs
            [attr.label]="t('nav.breadcrumb')"
            max-items="4"
            items-before-collapse="1"
            items-after-collapse="2"
            (mdSelect)="intercept($event)"
          >
            @for (crumb of crumbs; track $index) {
              <md-breadcrumb-item [attr.href]="crumb.href ? withBase(crumb.href) : null">
                {{ crumb.label }}
              </md-breadcrumb-item>
            }
          </md-breadcrumbs>
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

      <ng-content />
    </div>

    <awc-dock />
  `,
})
export class ShellComponent extends ShowcaseComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() crumbs: Crumb[] = [];

  private readonly router = inject(Router);

  protected readonly reportingDate = REPORTING_DATE;
  protected readonly reportingQuarter = REPORTING_QUARTER;
  protected readonly baseCurrency = BASE_CURRENCY;

  protected get sections() {
    return [
      { path: this.route.overview(), icon: 'dashboard', label: this.t('nav.overview') },
      { path: this.route.watchlist(), icon: 'warning', label: this.t('nav.watchlist') },
      { path: this.route.stress(), icon: 'stacked_line_chart', label: this.t('nav.stress') },
    ];
  }

  /** The screen path, as Angular's router knows it — no base, no trailing slash. */
  private get here(): string {
    return this.router.url.split('?')[0] || '/';
  }

  // The overview owns `/` and would otherwise match every path.
  protected isCurrent(path: string): boolean {
    const target = appPath(path);
    return target === '/' ? this.here === '/' : this.here.startsWith(target);
  }

  /**
   * `href` on `md-button` and `md-breadcrumb-item` is a REAL anchor, which is why
   * both work with JavaScript off and honour ⌘-click. Left alone it also means
   * every nav click is a full page reload in a client-routed app, tearing down
   * and rebuilding the document and re-registering every component. This vetoes
   * the navigation and routes in place instead.
   *
   * MODIFIER KEYS PASS THROUGH. Cancelling unconditionally would route a
   * ⌘-click in place instead of opening a new tab — the link would look like a
   * link, carry a real href, and then quietly refuse to behave like one.
   * `originalEvent` is the MouseEvent or KeyboardEvent that produced the
   * selection, so one check covers the Enter path too.
   */
  protected intercept(event: Event): void {
    const detail = (
      event as CustomEvent<{ href?: string; originalEvent?: MouseEvent | KeyboardEvent }>
    ).detail;
    const href = detail?.href;
    if (!href) return;
    const original = detail?.originalEvent;
    if (original?.metaKey || original?.ctrlKey || original?.shiftKey) return;
    event.preventDefault();
    const bare = href.startsWith(BASE_PATH) ? href.slice(BASE_PATH.length) : href;
    void this.router.navigateByUrl(appPath(bare || '/'));
  }
}
