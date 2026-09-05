import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ShowcaseComponent } from '../lib/screen.base';
import { ScreenComponent } from '../components/screen.component';
import { EmptyStateComponent } from '../components/empty-state.component';

/**
 * The screen for a post or a person that does not exist.
 *
 * IT IS A REAL SCREEN, not a redirect to the feed. A reader who followed a
 * stale link needs to be told the thing is gone; silently landing them on the
 * feed makes it look as though the link worked and the app forgot where they
 * were going.
 */
@Component({
  selector: 'awc-not-found-screen',
  standalone: true,
  imports: [ScreenComponent, EmptyStateComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  template: `
    <awc-screen
      [title]="t('community.screen.notFound.title')"
      [subtitle]="t('community.screen.notFound.subtitle')"
    >
      <awc-empty-state [message]="t('community.screen.notFound.subtitle')" />
      <!-- A BUTTON, not a bare link. There is no trail on this screen — the
           path matched nothing, so there is no parent to name — and a lone
           underlined hyperlink under an empty state reads as a stray. -->
      <div class="row">
        <md-button variant="tonal" icon="arrow_back" (mdClick)="goHome()">
          {{ t('community.nav.feed') }}
        </md-button>
      </div>
    </awc-screen>
  `,
})
export class NotFoundScreen extends ShowcaseComponent {
  private readonly router = inject(Router);
  protected goHome() {
    void this.router.navigateByUrl(this.appPath(this.route.feed()));
  }
}
