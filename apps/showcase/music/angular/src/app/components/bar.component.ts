import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  ViewChild,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';
import { ShowcaseComponent } from '../lib/screen.base';
import { DESTINATIONS, destinationIndex, type Destination } from '../lib/routes';

/**
 * The same five destinations, docked at the bottom, below 900px (`app.css`
 * shows exactly one navigation surface at a time).
 *
 * FIVE IS THE CEILING. `md-navigation-bar` is specified for 3–5 destinations
 * and its manual says so twice; the kit's `DESTINATIONS` is sized for that,
 * which is why the household drill is not a destination.
 *
 * The click is vetoed in the CAPTURE phase, and that is not a style choice:
 * `md-navigation-tab` reads `event.defaultPrevented` before it acts, and with
 * `href` set it navigates by `window.location.assign()` — a full page load of a
 * single-page application. A bubbling listener would run after that has already
 * been decided. Angular's template event binding has no capture option, so the
 * listener is attached by hand in `ngAfterViewInit` (zone.js patches
 * `addEventListener`, so change detection still runs) and removed on destroy.
 *
 * There is no ⌘-click concession here as there is on the rail: the bar tab is
 * not an anchor at all (`href` does not render one), so the browser has nothing
 * to open in a new tab either way.
 *
 * `value` is not a prop on `md-navigation-tab` (the rail tab has one, this one
 * reports an index), so the routing key rides on a `data-value` attribute —
 * which `getAttribute` reads back without any coupling to the component.
 */
@Component({
  selector: 'awc-bar',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <md-navigation-bar
      #bar
      class="shell__bar"
      [attr.aria-label]="t('music.nav.label')"
      [attr.active-index]="activeIndex"
      label-behavior="always"
    >
      @for (destination of destinations; track destination.value) {
        <md-navigation-tab
          [attr.data-value]="destination.value"
          [attr.icon]="destination.icon"
          [attr.active-icon]="destination.activeIcon"
          [attr.label]="t(destination.labelKey)"
          [attr.href]="withBase(destination.path)"
        ></md-navigation-tab>
      }
    </md-navigation-bar>
  `,
})
export class BarComponent extends ShowcaseComponent implements AfterViewInit, OnDestroy {
  @ViewChild('bar') private bar?: ElementRef<HTMLElement>;

  private readonly router = inject(Router);
  protected readonly destinations = DESTINATIONS;

  private readonly onCapturedClick = (event: Event): void => {
    const tab = event
      .composedPath()
      .find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node.tagName === 'MD-NAVIGATION-TAB',
      );
    const value = tab?.getAttribute('data-value');
    const destination = DESTINATIONS.find((d) => d.value === value);
    if (!destination) return;
    event.preventDefault();
    void this.router.navigateByUrl(this.appPath(destination.path));
  };

  ngAfterViewInit(): void {
    this.bar?.nativeElement.addEventListener('click', this.onCapturedClick, true);
  }

  ngOnDestroy(): void {
    this.bar?.nativeElement.removeEventListener('click', this.onCapturedClick, true);
  }

  protected get activeIndex(): number {
    return destinationIndex(this.router.url.split('?')[0] || '/');
  }

}
