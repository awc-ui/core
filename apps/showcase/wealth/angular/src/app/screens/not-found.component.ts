import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ShowcaseComponent } from '../lib/screen.base';
import { ScreenComponent } from '../components/screen.component';
import { EmptyStateComponent } from '../components/empty-state.component';

/**
 * Nothing is served at this address.
 *
 * Reachable in a client-routed app in a way it is not on the static host: under
 * `ng serve` any path under the mount lands here rather than 404ing, so it has
 * to offer a way back rather than being a dead end. The rail and the bar are
 * still rendered by `AppComponent`, so every destination is one click away —
 * the button is for the reader who is looking for one.
 *
 * `href` on the component, never a component inside an `<a>` — the same rule
 * the React build cites. The click is a full page load, exactly as in React,
 * where this screen's button is also unintercepted.
 */
@Component({
  selector: 'awc-not-found-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ScreenComponent, EmptyStateComponent],
  template: `
    <awc-screen
      [title]="t('wealth.screen.notFound.title')"
      [subtitle]="t('wealth.screen.notFound.subtitle')"
    >
      <md-button
        aside
        variant="tonal"
        size="sm"
        icon="dashboard"
        [attr.href]="withBase(route.overview())"
      >
        {{ t('wealth.nav.overview') }}
      </md-button>
      <awc-empty-state [message]="t('wealth.empty.generic')" />
    </awc-screen>
  `,
})
export class NotFoundScreen extends ShowcaseComponent {}
