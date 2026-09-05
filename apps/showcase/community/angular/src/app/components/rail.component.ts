import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { Router } from '@angular/router';
import { getTotals } from '@awc-ui/showcase-kit/community';
import { ShowcaseComponent } from '../lib/screen.base';
import { ShellService } from '../lib/shell.service';
import { DESTINATIONS, destinationIndex, type Destination } from '../lib/routes';

/**
 * Top-level destinations at desktop width.
 *
 * `href` IS SET ON EVERY DESTINATION, and that has two consequences worth
 * knowing. It makes each tab a real anchor, so ⌘-click opens a tab and "copy
 * link address" copies something that resolves. And because a link cannot be an
 * ARIA `tab`, the rail drops the `tablist` role from its destinations region —
 * documented behaviour, and the right trade: these ARE links.
 *
 * Routing is driven from the NATIVE click rather than from `mdTabChange`. The
 * anchor is what navigates, so only `preventDefault()` on the click can stop a
 * full page reload — and `mdTabChange` does not fire when you re-activate the
 * destination you are already on, which would leave that one click doing a
 * reload while the other four routed in place. The click retargets across the
 * tab's shadow boundary, so the tab is found on `composedPath()`.
 *
 * `active-index` is CONTROLLED from the pathname, so the indicator is a
 * function of the URL and never of what was clicked last. Back and forward move
 * it correctly for free.
 *
 * THERE IS NO FAB IN THIS VERTICAL, and its absence is a decision rather than
 * an omission. Lyra puts one here because posting is unambiguously its primary
 * action and it has a Create DESTINATION for the FAB to point at. Corvus puts
 * the composer inline at the top of the feed — which is where this kind of app
 * has always put it, and why `route` has no `create()` to route to. A FAB would
 * therefore either duplicate a control already on screen, or point at a screen
 * that does not exist. `md-navigation-rail` renders nothing for an empty
 * `slot="fab"`, so leaving it out costs no layout.
 */
@Component({
  selector: 'awc-rail',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <md-navigation-rail
      class="shell__rail"
      [attr.label]="t('community.nav.label')"
      [attr.variant]="shell.railExpanded() ? 'expanded' : 'standard'"
      [attr.active-index]="activeIndex"
      label-visibility="all"
      (click)="intercept($event)"
    >
      @for (destination of destinations; track destination.value) {
        <md-navigation-rail-tab
          [attr.icon]="destination.icon"
          [attr.label]="t(destination.labelKey)"
          [attr.value]="destination.value"
          [attr.href]="withBase(destination.path)"
          [attr.badge-value]="badgeFor(destination)"
        ></md-navigation-rail-tab>
      }
    </md-navigation-rail>
  `,
})
export class RailComponent extends ShowcaseComponent {
  protected readonly shell = inject(ShellService);
  private readonly router = inject(Router);
  protected readonly destinations = DESTINATIONS;
  private readonly totals = getTotals();

  protected get activeIndex(): number {
    return destinationIndex(this.router.url.split('?')[0] || '/');
  }

  /** Never `"false"` into a badge — an absent attribute, or nothing shows. */
  protected badgeFor(destination: Destination): string | null {
    /* The badge counts what has not been read. It sits on Activity because
       that is the screen that shows the unread rows — a count on a destination
       that cannot show the thing it counts is a dead end. */
    return destination.value === 'friends' && this.totals.requestCount > 0
      ? String(this.totals.requestCount)
      : null;
  }

  protected intercept(event: Event): void {
    const mouse = event as MouseEvent;
    // Anything but a plain primary click is the browser's to handle: modifier
    // clicks open tabs and windows off the real anchor.
    if (mouse.button !== 0 || mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) {
      return;
    }
    const tab = mouse
      .composedPath()
      .find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node.tagName === 'MD-NAVIGATION-RAIL-TAB',
      );
    const value = tab?.getAttribute('value');
    const destination = DESTINATIONS.find((d) => d.value === value);
    if (!destination) return;
    event.preventDefault();
    void this.router.navigateByUrl(this.appPath(destination.path));
  }
}
