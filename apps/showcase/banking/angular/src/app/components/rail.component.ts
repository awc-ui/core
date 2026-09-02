import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { Router } from '@angular/router';
import { getTotals } from '@awc-ui/showcase-kit/banking';
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
 * THE FAB is the one on the screen, and the rail is where M3 puts it: at the
 * top, above the destinations, in `slot="fab"` — the only slot it belongs in.
 * The rail drives its `extended` state from its own expansion, so `extended` is
 * never set here. `mdClick` on md-fab is dispatched cancelable but the
 * component never reads `defaultPrevented` — there is no veto hook — so this
 * listens and routes rather than pretending to intercept. It routes to the
 * exchange screen, a real destination with a real ticket on it, unlike
 * as in the React build.
 */
@Component({
  selector: 'awc-rail',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <md-navigation-rail
      class="shell__rail"
      [attr.label]="t('banking.nav.label')"
      [attr.variant]="shell.railExpanded() ? 'expanded' : 'standard'"
      [attr.active-index]="activeIndex"
      label-visibility="all"
      (click)="intercept($event)"
    >
      <md-fab
        slot="fab"
        icon="currency_exchange"
        [attr.label]="t('banking.action.exchange')"
        (mdClick)="newProposal()"
      ></md-fab>

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
    return destination.value === 'transactions' && this.totals.pendingCount > 0
      ? String(this.totals.pendingCount)
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

  protected newProposal(): void {
    void this.router.navigateByUrl(this.appPath(this.route.exchange()));
  }
}
