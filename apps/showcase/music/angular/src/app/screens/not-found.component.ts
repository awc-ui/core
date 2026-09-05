/**
 * ONE COMPONENT, USED FIVE TIMES: the wildcard route renders it, and each drill
 * screen renders it when the id in its own URL does not resolve. Written per
 * screen, four of the five ended up a bare message with NO WAY BACK — a dead
 * end with no control is worse than a 404.
 */
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ScreenComponent } from '../components/screen.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { ShowcaseService } from '../lib/showcase.service';
import { appPath, route } from '../lib/routes';

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-not-found-screen',
  standalone: true,
  imports: [ScreenComponent, EmptyStateComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <awc-screen [title]="t('music.screen.notFound.title')" [subtitle]="t('music.screen.notFound.subtitle')">
      <awc-empty-state [message]="t('music.screen.notFound.subtitle')" />
      <div class="row">
        <md-button class="notfound__home" variant="filled" icon="home" (click)="home()">
          {{ t('music.nav.home') }}
        </md-button>
      </div>
    </awc-screen>
  `,
})
export class NotFoundScreen {
  private readonly showcase = inject(ShowcaseService);
  private readonly router = inject(Router);
  t = (key: string) => this.showcase.t(key);
  home() { void this.router.navigateByUrl(appPath(route.home())); }
}
