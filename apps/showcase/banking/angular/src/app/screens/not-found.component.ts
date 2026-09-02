import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ShowcaseComponent } from '../lib/screen.base';
import { ScreenComponent } from '../components/screen.component';
import { EmptyStateComponent } from '../components/empty-state.component';

/**
 * Nothing is served at this address.
 *
 * Reachable in a client-routed app in a way it is not on the static host: under
 * `ng serve` any path under the mount lands here rather than 404ing, so it has
 * to offer a way back rather than being a dead end.
 *
 * `href` on the component, never a component inside an `<a>` (§7.3).
 */
@Component({
  selector: 'awc-not-found-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ScreenComponent, EmptyStateComponent],
  template: `
    <awc-screen
      [title]="t('banking.screen.notFound.title')"
      [subtitle]="t('banking.screen.notFound.body')"
    >
      <md-button
        aside
        variant="tonal"
        size="sm"
        icon="account_balance_wallet"
        [attr.href]="withBase(route.home())"
      >
        {{ t('banking.nav.home') }}
      </md-button>
      <awc-empty-state [message]="t('banking.screen.notFound.body')" />
    </awc-screen>
  `,
})
export class NotFoundScreen extends ShowcaseComponent {}
